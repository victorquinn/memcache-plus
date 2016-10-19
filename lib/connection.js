
/**
 * @file Main file for a Memcache Connection
 */

var debug = require('debug')('memcache-plus:connection');

var _ = require('lodash'),
    assert = require('chai').assert,
    carrier = require('carrier'),
    misc = require('./misc'),
    net = require('net'),
    Immutable = require('immutable'),
    Promise = require('bluebird'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter;

// Note, these first few flags intentionally mirror the memcached module so
// they are cross compatible
var FLAG_JSON = 1<<1;
var FLAG_BINARY = 1<<2;
var FLAG_NUMERIC = 1<<3;
// These are new flags we add for Memcache Plus specific data
var FLAG_COMPRESSED = 1<<4;

var metadataTemp = {};

/**
 * Miscellaneous helper functions
 */

/**
 * getFlag() - Given a value and whether it's compressed, return the correct
 *   flag
 *
 * @param {*} val - the value to inspect and on which to set the flag
 * @param {bool} compressed - whether or not this value is to be compressed
 * @returns {Number} the value of the flag
 */
function getFlag(val, compressed) {
    var flag = 0;

    if (typeof val === 'number') {
        flag = FLAG_NUMERIC;
    } else if (Buffer.isBuffer(val)) {
        flag = FLAG_BINARY;
    } else if (typeof val !== 'string') {
        flag = FLAG_JSON;
    }

    if (compressed === true) {
        flag = flag | FLAG_COMPRESSED;
    }

    return flag;
}

/**
 * formatValue() - Given a value and whether it's compressed, return a Promise
 *   which will resolve to that value formatted correctly, either compressed or
 *   not and as the correct type of string
 *
 * @param {*} val - the value to inspect and on which to set the flag
 * @param {bool} compressed - whether or not this value is to be compressed
 * @returns {Promise} resolves to the value after being converted and, if
 *   necessary, compressed
 */
function formatValue(val, compressed) {
    var value = val;

    if (typeof val === 'number') {
        value = val.toString();
    } else if (Buffer.isBuffer(val)) {
        value = val.toString('binary');
    } else if (typeof val !== 'string') {
        value = JSON.stringify(val);
    }

    var bVal = new Buffer(value);

    var compression = Promise.resolve(bVal);

    if (compressed) {
        // Compress
        debug('compression enabled, compressing');
        compression = misc.compress(bVal);
    }

    return compression;
}

/**
 * Connection constructor
 *
 * With the supplied options, connect.
 *
 * @param {object} opts - The options for this Connection instance
 */
function Connection(opts) {

    EventEmitter.call(this);

    opts = opts || {};

    _.defaults(opts, {
        host: 'localhost',
        port: '11211',
        reconnect: true,
        maxValueSize: 1048576
    });

    this.host = opts.host;
    this.port = opts.port;

    this.buffer = new Immutable.List();

    if (opts.onConnect) {
        this.onConnect = opts.onConnect;
    }

    if (opts.onError) {
        this.onError = opts.onError;
    } else {
        this.onError = function onError(err) { this.emit('error'); console.error(err); };
    }
    this.bufferBeforeError = opts.bufferBeforeError;
    this.netTimeout = opts.netTimeout || 500;
    this.backoffLimit = opts.backoffLimit || 10000;
    this.reconnect = opts.reconnect;
    this.disconnecting = false;
    this.ready = false;
    this.backoff = opts.backoff || 10;
    this.maxValueSize = opts.maxValueSize;
    this.writeBuffer = new Immutable.List();

    this.connect();
}

util.inherits(Connection, EventEmitter);

/**
 * Disconnect connection
 */
Connection.prototype.disconnect = function() {
    this.ready = false;
    this.disconnecting = true;
    this.client.end();
};

/**
 * Destroy connection immediately
 */
Connection.prototype.destroy = function() {
    this.client.destroy();
    this.client = null;

    this.buffer.forEach(function(deferred) {
        deferred.reject(new Error('Memcache connection lost'));
    });
    this.buffer = this.buffer.clear();
};

/**
 * Initialize connection
 *
 * @api private
 */
Connection.prototype.connect = function() {
    var self = this;
    var params = {
        port: self.port
    };

    if (self.host) {
        params.host = self.host;
    }

    debug('connecting to host %s:%s', params.host, params.port);

    // If a client already exists, we just want to reconnect
    if (this.client) {
        this.client.connect(params);

    } else {
        // Initialize a new client, connect
        self.client = net.connect(params);
        self.client.setTimeout(self.netTimeout);
        self.client.on('error', self.onError);
        self.client.setNoDelay(true);

        // If reconnect is enabled, we want to re-initiate connection if it is ended
        if (self.reconnect) {
            self.client.on('close', function() {
                self.emit('close');
                self.ready = false;
                // Wait before retrying and double each time. Backoff starts at 10ms and will
                // plateau at 1 minute.
                if (self.backoff < self.backoffLimit) {
                    self.backoff *= 2;
                }
                debug('connection to memcache lost, reconnecting in %sms...', self.backoff);
                setTimeout(function() {
                    // Only want to do this if a disconnect was not triggered intentionally
                    if (!self.disconnecting) {
                        debug('attempting to reconnect to memcache now.', self.backoff);
                        self.destroy();
                        self.connect();
                    }
                }, self.backoff);
            });
        }
    }

    self.client.on('connect', function() {
        self.emit('connect');
        debug('successfully (re)connected!');
        self.ready = true;
        // Reset backoff if we connect successfully
        self.backoff = 10;

        // If an onConnect handler was specified, execute it
        if (self.onConnect) {
            self.onConnect();
        }
        self.flushBuffer();
    });

    carrier.carry(self.client, self.read.bind(self));
};

/**
 * read() - Called as soon as we get data back from this connection from the
 *   server. The response parsing is a bit of a beast.
 */
Connection.prototype.read = function(data) {
    debug('got data: "%s" and the queue now has "%d" elements',
          misc.truncateIfNecessary(data),
          this.buffer.size
    );

    var deferred = this.buffer.first();

    var done = true;
    var err = null;
    var resp = data;

    if (data.match(/^ERROR$/) && this.buffer.size > 0) {
        debug('got an error from memcached');
        // We only want to do this if the last thing was not an error,
        // as if it were, we already would have notified about the error
        // last time so now we want to ignore it
        err = new Error(util.format('Memcache returned an error: %s\r\nFor key %s', data, deferred.key));
    } else if (data.match(/^VALUE .+/)) {
        var spl = data.match(/^VALUE (.+) ([0-9]+) ([0-9]+)$/);
        debug('Got some metadata', spl);
        metadataTemp[spl[1]] = {
            flag: Number(spl[2]),
            len: Number(spl[3])
        };
        done = false;
    } else if (data.match(/^END$/)) {
        if (deferred.type === 'items') {
            deferred.resolve(this.data);
            this.data = null;
            return;
        }

        if (metadataTemp[deferred.key]) {
            var metadata = metadataTemp[deferred.key];
            resp = [ this.data, metadata.flag, metadata.len ];
            // After we've used this metadata, purge it
            delete metadataTemp[deferred.key];
        } else {
            resp = [ this.data ];
        }
    } else if (data.match(/^STAT items.+/)) {
        // format is
        // STAT items:SLAB_ID:<key> <value>

        var splData = data.match(/^STAT items:([0-9]+):(.+) ([0-9]+)$/);

        var slabId = splData[1];
        var slabName = splData[2];
        var slabValue = splData[3];

        if (!this.data) {
            this.data = {
                items: {},
                ids: []
            };
        }

        if (!this.data.items[slabId]) {
            this.data.items[slabId] = {};
            this.data.ids.push(slabId);
        }

        // set the slab key and value to the slab id
        this.data.items[slabId][slabName] = parseInt(slabValue, 10);
    } else if (data.match(/^SERVER_ERROR|CLIENT_ERROR .+/)) {
        err = new Error('Memcache returned an error: %s', data);
    } else {
        // If this is a special response that we expect, handle it
        if (data.match(/^(STORED|NOT_STORED|DELETED|EXISTS|TOUCHED|NOT_FOUND|OK|INCRDECR|ITEM|STAT|VERSION)$/)) {
            // Do nothing currently...
            debug('misc response, passing along to client');
        } else {
            if (data !== '') {
                if (deferred.type !== 'incr' && deferred.type !== 'decr') {
                    done = false;
                }
            }
        }
    }

    if (done) {
        // Pull this guy off the queue
        this.buffer = this.buffer.shift();
        // Reset for next loop
        this.data = null;
    } else {
        this.data = resp;
    }

    if (err) {
        // If we have an error, reject
        deferred.reject(err);
    } else {
        // If we don't have an error, resolve if done
        if (done) {
            deferred.resolve(resp);
        }
    }
    debug('responded and the queue now has "%s" elements', this.buffer.size);
};

/**
 * flushBuffer() - Flush the queue for this connection
 */
Connection.prototype.flushBuffer = function() {
    if (this.writeBuffer && this.writeBuffer.size > 0) {
        debug('flushing connection write buffer');
        // @todo Watch out for and handle how this behaves with a very long buffer
        while(this.writeBuffer.size > 0) {
            this.client.write(this.writeBuffer.first());
            this.writeBuffer = this.writeBuffer.shift();
            this.client.write('\r\n');
        }
    }
};

/**
 * write() - Write a command to this connection
 */
Connection.prototype.write = function(str) {
    // If for some reason this connection is not yet ready and a request is tried,
    // we don't want to fire it off so we write it to a buffer and then will fire
    // them off when we finally do connect. And even if we are connected we don't
    // want to fire off requests unless the write buffer is emptied. So if say we
    // buffer 100 requests, then connect and chug through 10, there are 90 left to
    // be flushed before we send it new requests so we'll just keep pushing on the
    // end until it's flushed
    if (this.ready && this.writeBuffer.size < 1) {
        debug('sending: "%s"', misc.truncateIfNecessary(str));
        this.client.write(str);
        this.client.write('\r\n');
    } else if (this.writeBuffer.size < this.bufferBeforeError) {
        debug('buffering: "%s"', misc.truncateIfNecessary(str));
        this.writeBuffer.push(str);
        // Check if we should flush this queue. Useful in case it gets stuck for
        // some reason
        if (this.ready) {
            this.flushBuffer();
        }
    } else {
        this.buffer.first().reject('Error, Connection to memcache lost and buffer over ' + this.bufferBeforeError + ' items');
        this.buffer = this.buffer.shift();
    }
};

Connection.prototype.autodiscovery = function() {
    debug('starting autodiscovery');
    var deferred = misc.defer('autodiscovery');
    this.buffer = this.buffer.push(deferred);

    this.write('config get cluster');
    return deferred.promise
        .then(function(data) {
            debug('got autodiscovery response from elasticache');
            // Elasticache returns hosts as a string like the following:
            // victor.di6cba.0001.use1.cache.amazonaws.com|10.10.8.18|11211 victor.di6cba.0002.use1.cache.amazonaws.com|10.10.8.133|11211
            // We want to break it into the correct pieces
            var hosts = data.toString().split(' ');
            return hosts.map(function(host) {
                host = host.split('|');
                return util.format('%s:%s', host[0], host[2]);
            });
        });
};

/**
 * set() - Set a value on this connection
 */
Connection.prototype.set = function(key, val, ttl) {
    var self = this;
    assert(typeof key === 'string', 'Cannot set in memcache with a not string key');
    assert(key.length < 250, 'Key must be less than 250 characters long');

    ttl = ttl || 0;
    var opts = {};

    if (_.isObject(ttl)) {
        opts = ttl;
        ttl = opts.ttl || 0;
    }

    var flag = getFlag(val, opts.compressed);

    return formatValue(val, opts.compressed)
        .bind(this)
        .then(function(v) {
            if (opts.compressed) {
                // Note, we use base64 encoding because this allows us to compress it
                // but also safely store/retrieve it in memcache. Not quite as efficient
                // as if we just used the zlib default, but it also includes a bunch of
                // funky characters that didn't seem to be safe to set/get from memcache
                // without messing with the data.
                v = new Buffer(v.toString('base64'));
            }
            if (v.length > self.maxValueSize) {
                throw new Error(util.format('Value too large to set in memcache: %s > %s', v.length, self.maxValueSize));
            }

            // What we're doing here is a bit tricky as we need to invert control.
            // We are going to basically return a Promise that itself is made up of a
            // chain of Promises, most resolved here (the initial communication with
            // memcache), but the last is not resolved until some time in the future.
            // This Promise is put into a queue which will be processed whenever the
            // socket responds (usually immediately). This because we don't know
            // exactly when it's going to respond since it's an event emitter. So we
            // are doing some funky promise trickery to convert event emmitter into
            // Promise/or Callback. Since all actions in this library share the same
            // queue, order should be maintained and this trick should work!

            var deferred = misc.defer(key);
            deferred.key = key;
            this.buffer = this.buffer.push(deferred);

            // First send the metadata for this request
            this.write(util.format('set %s %d %d %d', key, flag, ttl, v.length));

            // Then the actual value (as a string)
            this.write(util.format('%s', v));
            return deferred.promise
                           .then(function(data) {
                               // data will be a buffer
                               if (data !== 'STORED') {
                                   throw new Error(util.format('Something went wrong with the set. Expected STORED, got :%s:', data.toString()));
                               } else {
                                   return Promise.resolve();
                               }
                           });
        });
};

function convert(data, flag, length) {
    if (flag & FLAG_NUMERIC) {
        return Number(data);
    } else if (flag & FLAG_BINARY) {
        var buff = new Buffer(length);
        buff.write(data, 0, 'binary');
        return buff;
    } else if (flag & FLAG_JSON) {
        return JSON.parse(data);
    } else {
        return data.toString();
    }
}

/**
 * incr() - Increment a value on this connection
 */
Connection.prototype.incr = function(key, amount) {
    assert(typeof key === 'string', 'Cannot set in memcache with a not string key');
    assert(key.length < 250, 'Key must be less than 250 characters long');
    assert(typeof amount === 'number', 'Cannot incr in memcache with a non number value');
    // Do the delete
    var deferred = misc.defer(key);
    deferred.type = 'incr';
    this.buffer = this.buffer.push(deferred);

    this.write(util.format('incr %s %d', key, amount));

    return deferred.promise
                   .then(function(v) {
                       if (v === 'NOT FOUND') {
                           throw new Error('key %s not found to incr', key);
                       } else {
                           return Number(v);
                       }
                   });
    // .timeout() // @todo add this as a setting
};

/**
 * decr() - Decrement a value on this connection
 */
Connection.prototype.decr = function(key, amount) {
    assert(typeof key === 'string', 'Cannot set in memcache with a not string key');
    assert(key.length < 250, 'Key must be less than 250 characters long');
    assert(typeof amount === 'number', 'Cannot decr in memcache with a non number value');
    // Do the delete
    var deferred = misc.defer(key);
    deferred.type = 'decr';
    this.buffer = this.buffer.push(deferred);

    this.write(util.format('decr %s %d', key, amount));

    return deferred.promise
                   .then(function(v) {
                       if (v === 'NOT FOUND') {
                           throw new Error('key %s not found to decr', key);
                       } else {
                           return Number(v);
                       }
                   });
    // .timeout() // @todo add this as a setting
};

/**
 * get() - Get a value on this connection
 *
 * @param {String} key - The key for the value to retrieve
 * @param {Object} [opts] - Any additional options for this get
 * @returns {Promise}
 */
Connection.prototype.get = function(key, opts) {
    opts = opts || {};
    // Do the get
    var deferred = misc.defer(key);
    this.buffer = this.buffer.push(deferred);

    this.write('get ' + key);

    return deferred.promise
    // .timeout() // @todo add this as a setting
        .spread(function(data, flag, length) {
            if (data) {
                if (opts.compressed || (flag & FLAG_COMPRESSED)) {
                    // @todo compressed data should still be able to utilize the
                    //  flags to return data of same type set
                    return misc.decompress(new Buffer(data, 'base64'))
                        .then(function(d) {
                            return d.toString();
                        })
                        .catch(function(err) {
                            if (err.toString().indexOf('Error: incorrect header check') > -1) {
                                // Basically we get this OperationalError when we try to decompress a value
                                // which was not previously compressed. We return null instead of bubbling
                                // this error up the chain because we want to represent it as a cache miss
                                // rather than an actual error. By looking like a cache miss like this, it
                                // makes it so someone can turn on compression and it'll work fine, looking
                                // like a cache miss. So in the usual workflow the client tries to set it
                                // again which means the second time around the compressed version is set
                                // as the client wanted/expected.
                                return null;
                            } else {
                                throw err;
                            }
                        });
                } else {
                    return convert(data, flag, length);
                }
            } else {
                return null;
            }
        });
};

/**
 * flush() - delete all values on this connection
 * @param delay
 * @returns {Promise}
 */
Connection.prototype.flush_all = function(delay) {
    var deferred = misc.defer(delay);
    this.buffer = this.buffer.push(deferred);

    this.write(util.format('flush_all %s', delay));

    return deferred.promise
                   .then(function(v) {
                       return v === 'OK';
                   });
};

/**
 * add() - Add a value on this connection
 */
Connection.prototype.add = function(key, val, ttl) {
    var self = this;
    assert(typeof key === 'string', 'Cannot add in memcache with a not string key');
    assert(key.length < 250, 'Key must be less than 250 characters long');

    ttl = ttl || 0;
    var opts = {};

    if (_.isObject(ttl)) {
        opts = ttl;
        ttl = opts.ttl || 0;
    }

    var flag = getFlag(val, opts.compressed);

    return formatValue(val, opts.compressed)
        .bind(this)
        .then(function(v) {
            if (opts.compressed) {
                v = new Buffer(v.toString('base64'));
            }
            if (v.length > self.maxValueSize) {
                throw new Error(util.format('Value too large to set in memcache: %s > %s', v.length, self.maxValueSize));
            }

            var deferred = misc.defer(key);
            deferred.key = key;
            this.buffer = this.buffer.push(deferred);

            // First send the metadata for this request
            this.write(util.format('add %s %d %d %d', key, flag, ttl, v.length));

            // Then the actual value
            this.write(util.format('%s', v));
            return deferred.promise
                           .then(function(data) {
                               // data will be a buffer
                               if (data === 'NOT_STORED') {
                                   throw new Error(util.format('Cannot "add" for key "%s" because it already exists', key));
                               } else if (data !== 'STORED') {
                                   throw new Error(util.format('Something went wrong with the add. Expected STORED, got :%s:', data.toString()));
                               } else {
                                   return Promise.resolve();
                               }
                           });
        });
};

/**
 * replace() - Replace a value on this connection
 */
Connection.prototype.replace = function(key, val, ttl) {
    var self = this;
    assert(typeof key === 'string', 'Cannot replace in memcache with a not string key');
    assert(key.length < 250, 'Key must be less than 250 characters long');

    ttl = ttl || 0;
    var opts = {};

    if (_.isObject(ttl)) {
        opts = ttl;
        ttl = opts.ttl || 0;
    }

    var flag = getFlag(val, opts.compressed);

    return formatValue(val, opts.compressed)
        .bind(this)
        .then(function(v) {
            if (opts.compressed) {
                v = new Buffer(v.toString('base64'));
            }
            if (v.length > self.maxValueSize) {
                throw new Error(util.format('Value too large to replace in memcache: %s > %s', v.length, self.maxValueSize));
            }

            var deferred = misc.defer(key);
            deferred.key = key;
            this.buffer = this.buffer.push(deferred);

            // First send the metadata for this request
            this.write(util.format('replace %s %d %d %d', key, flag, ttl, v.length));

            // Then the actual value
            this.write(util.format('%s', v));
            return deferred.promise
                           .then(function(data) {
                               // data will be a buffer
                               if (data === 'NOT_STORED') {
                                   throw new Error(util.format('Cannot "replace" for key "%s" because it does not exist', key));
                               } else if (data !== 'STORED') {
                                   throw new Error(util.format('Something went wrong with the replace. Expected STORED, got :%s:', data.toString()));
                               } else {
                                   return Promise.resolve();
                               }
                           });
        });
};

/**
 * append() - Append a value on this connection
 */
Connection.prototype.append = function(key, val, ttl) {
    var self = this;
    assert(typeof key === 'string', 'Cannot append in memcache with a not string key');
    assert(key.length < 250, 'Key must be less than 250 characters long');

    ttl = ttl || 0;
    var opts = {};

    if (_.isObject(ttl)) {
        opts = ttl;
        ttl = opts.ttl || 0;
    }

    var flag = getFlag(val, opts.compressed);

    return formatValue(val, opts.compressed)
        .bind(this)
        .then(function(v) {
            if (opts.compressed) {
                v = new Buffer(v.toString('base64'));
            }
            if (v.length > self.maxValueSize) {
                throw new Error(util.format('Value too large to append in memcache: %s > %s', v.length, self.maxValueSize));
            }

            var deferred = misc.defer(key);
            deferred.key = key;
            this.buffer = this.buffer.push(deferred);

            // First send the metadata for this request
            this.write(util.format('append %s %d %d %d', key, flag, ttl, v.length));

            // Then the actual value
            this.write(util.format('%s', v));
            return deferred.promise
                           .then(function(data) {
                               // data will be a buffer
                               if (data === 'NOT_STORED') {
                                   throw new Error(util.format('Cannot "append" for key "%s" because it does not exist', key));
                               } else if (data !== 'STORED') {
                                   throw new Error(util.format('Something went wrong with the append. Expected STORED, got :%s:', data.toString()));
                               } else {
                                   return Promise.resolve();
                               }
                           });
        });
};

/**
 * prepend() - Prepend a value on this connection
 */
Connection.prototype.prepend = function(key, val, ttl) {
    var self = this;
    assert(typeof key === 'string', 'Cannot prepend in memcache with a not string key');
    assert(key.length < 250, 'Key must be less than 250 characters long');

    ttl = ttl || 0;
    var opts = {};

    if (_.isObject(ttl)) {
        opts = ttl;
        ttl = opts.ttl || 0;
    }

    var flag = getFlag(val, opts.compressed);

    return formatValue(val, opts.compressed)
        .bind(this)
        .then(function(v) {
            if (opts.compressed) {
                v = new Buffer(v.toString('base64'));
            }
            if (v.length > self.maxValueSize) {
                throw new Error(util.format('Value too large to prepend in memcache: %s > %s', v.length, self.maxValueSize));
            }

            var deferred = misc.defer(key);
            deferred.key = key;
            this.buffer = this.buffer.push(deferred);

            // First send the metadata for this request
            this.write(util.format('prepend %s %d %d %d', key, flag, ttl, v.length));

            // Then the actual value
            this.write(util.format('%s', v));
            return deferred.promise
                           .then(function(data) {
                               // data will be a buffer
                               if (data === 'NOT_STORED') {
                                   throw new Error(util.format('Cannot "prepend" for key "%s" because it does not exist', key));
                               } else if (data !== 'STORED') {
                                   throw new Error(util.format('Something went wrong with the prepend. Expected STORED, got :%s:', data.toString()));
                               } else {
                                   return Promise.resolve();
                               }
                           });
        });
};

/**
 * delete() - Delete value for this key on this connection
 *
 * @param {String} key - The key to delete
 * @returns {Promise}
 */
Connection.prototype.delete = function(key) {
    // Do the delete
    var deferred = misc.defer(key);
    this.buffer = this.buffer.push(deferred);

    this.write(util.format('delete %s', key));

    return deferred.promise
                   .then(function(v) {
                       if (v === 'DELETED') {
                           return true;
                       } else {
                           return false;
                       }
                   });
    // .timeout() // @todo add this as a setting
};

/**
 * 'stats items'() - return items statistics
 * @returns {Promise}
 */
Connection.prototype['stats items'] = function() {
    debug('stats items');

    var deferred = misc.defer();
    deferred.type = 'items';

    this.buffer = this.buffer.push(deferred);

    this.write(util.format('stats items'));

    return deferred.promise
        .then(function(slabData) {
            var slabItems = [];

            // slabData.items - object containing slab data
            // slabData.ids - array of slab ids in which the results came in

            if (slabData && slabData.ids) {
                slabData.ids.forEach(function(slabId) {
                    var item = {};

                    item.slab_id = parseInt(slabId, 10);
                    item.data = slabData.items[slabId];
                    item.server = this.host + ':' + this.port;

                    slabItems.push(item);
                }.bind(this));
            }

            return slabItems;
        }.bind(this));
};

module.exports = Connection;