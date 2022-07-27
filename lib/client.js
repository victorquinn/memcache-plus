/**
 * @file Main file for the Memcache Client
 */

var debug = require('debug')('memcache-plus:client');

var _ = require('lodash'),
    HashRing = require('hashring'),
    misc = require('./misc'),
    Immutable = require('immutable'),
    Promise = require('bluebird'),
    R = require('ramda');

var Connection = require('./connection');

function validateKey(key, operation) {
    misc.assert(key, 'Cannot "' + operation + '" without key!');
    misc.assert(typeof key === 'string', 'Key needs to be of type "string"');
    misc.assert(Buffer.byteLength(key) < 250, 'Key must be less than 250 characters long');
    misc.assert(key.length < 250, 'Key must be less than 250 characters long');
    misc.assert(!/[\x00-\x20]/.test(key), 'Key must not include control characters or whitespace');
}

/**
 * Constructor - Initiate client
 */
function Client(opts) {
    if (!(this instanceof Client)) {
        return new Client(opts);
    }

    var options = {};

    // If single connection provided, array-ify it
    if (typeof opts === 'string') {
        options.hosts = [opts];
        opts = options;
    } else if (typeof opts === 'undefined') {
        opts = {};
    } else if (_.isArray(opts)) {
        options.hosts = opts;
        opts = options;
    }

    _.defaults(opts, {
        autodiscover: false,
        bufferBeforeError: 1000,
        disabled: false,
        hosts: null,
        reconnect: true,
        onNetError: function onNetError(err) { console.error(err); },
        queue: true,
        netTimeout: 500,
        backoffLimit: 10000,
        maxValueSize: 1048576
    });

    // Iterate over options, assign each to this object
    R.keys(opts).forEach(function(key) {
        this[key] = opts[key];
    }, this);

    if (this.queue) {
        this.buffer = new Immutable.List();
    }

    debug('Connect options', opts);
    this.connect();
}

/**
 * connect() - Iterate over all hosts, connect to each.
 *
 * @api private
 */
Client.prototype.connect = function() {
    debug('starting connection');
    this.connections = {};

    if (this.hosts === null) {
        this.hosts = ['localhost:11211'];
    }

    if (this.autodiscover) {
        // First connect to the servers provided
        this.getHostList()
            .bind(this)
            .then(function() {
                debug('got host list, connecting to hosts');
                // Connect to these hosts
                this.connectToHosts();
                this.ring = new HashRing(_.keys(this.connections));
            });

        // Then get the list of servers

        // Then connect to those
    } else {
        this.connectToHosts();
    }
};

/**
 * disconnect() - Iterate over all hosts, disconnect from each.
 *
 * @api private
 */
Client.prototype.disconnect = function(opts) {
    debug('starting disconnection');
    var connections;

    if (typeof opts === 'string') {
        // If single connection provided, array-ify it
        connections = [opts];
    } else if (typeof opts === 'undefined') {
        // No connections specified so client wants to disconnect from all
        connections = R.keys(this.connections);
    } else if (_.isArray(opts)) {
        connections = opts;
    }

    if (connections.length === R.keys(this.connections).length) {
        // Fair to assume if client is requesting a full disconnect, they don't
        //  want it to just reconnect
        this.reconnect = false;
    }

    connections.map(function(ckey) {
        debug('disconnecting from %s', ckey);
        // Check that host exists before disconnecting from it
        if (this.connections[ckey] === undefined) {
            debug('failure trying to disconnect from server [%s] because not connected', ckey);
            throw new Error('Cannot disconnect from server unless connected');
        }
        this.connections[ckey].disconnect();
        // Remove this connection
        delete this.connections[ckey];

        // Remove this host from the list of hosts
        this.hosts = this.hosts.filter(function(host) {
            return host !== ckey;
        });
    }.bind(this));

    return Promise.resolve(null);
};

/**
 * getHostList() - Given a list of hosts, contact them via Elasticache
 *   autodiscover and retrieve the list of hosts
 *
 * @api private
 */
Client.prototype.getHostList = function() {

    var client = this;
    var connections = {};
    // Promise.any because we don't care which completes first, as soon as we get
    // a list of hosts we can stop
    return Promise.any(this.hosts.map(function(host) {
        var h = this.splitHost(host);
        var deferred = misc.defer();
        connections[host] = new Connection({
            host: h.host,
            port: h.port,
            netTimeout: this.netTimeout,
            reconnect: false,
            onConnect: function() {
                // Do the autodiscovery, then resolve with hosts
                return deferred.resolve(this.autodiscovery());
            },
            onError: function (err) {
                client.onNetError(err);
                deferred.reject(err);
            }
        });

        return deferred.promise;
    }, this)).bind(this).then(
        function(hosts) {
            this.hosts = hosts;
            this.connectToHosts();
            this.flushBuffer();
        },
        function (err) {
            var wrappedError = new Error('Autodiscovery failed. Errors were:\n' + err.join('\n---\n'));
            this.flushBuffer(wrappedError);
        }
    );
};

/**
 * connectToHosts() - Given a list of hosts, actually connect to them
 *
 * @api private
 */
Client.prototype.connectToHosts = function() {
    debug('connecting to all hosts');
    this.hosts.forEach(function(host) {
        var h = this.splitHost(host);
        var client = this;

        // Connect to host
        this.connections[host] = new Connection({
            host: h.host,
            port: h.port,
            reconnect: this.reconnect,
            onConnect: function() {
                client.flushBuffer();
            },
            bufferBeforeError: this.bufferBeforeError,
            netTimeout: this.netTimeout,
            onError: this.onNetError,
            maxValueSize: this.maxValueSize
        });
    }, this);

    this.ring = new HashRing(_.keys(this.connections));
};

/**
 * flushBuffer() - Flush the current buffer of commands, if any
 *
 * @api private
 */
Client.prototype.flushBuffer = function(err) {
    this.bufferedError = err;

    if (this.buffer && this.buffer.size > 0) {
        debug('flushing client write buffer');
        // @todo Watch out for and handle how this behaves with a very long buffer
        while(this.buffer.size > 0) {
            var item = this.buffer.first();
            this.buffer = this.buffer.shift();

            // Something bad happened before things got a chonce to run. We
            // need to cancel all pending operations.
            if (err) {
                item.deferred.reject(err);
                continue;
            }

            // First, retrieve the correct connection out of the hashring
            var connection = this.connections[this.ring.get(item.key)];

            var promise = connection[item.cmd].apply(connection, item.args);
            promise.then(item.deferred.resolve, item.deferred.reject);
        }
    }
};

/**
 * splitHost() - Helper to split a host string into port and host
 *
 * @api private
 */
Client.prototype.splitHost = function(str) {
    var host = str.split(':');

    if (host.length === 1 && host.indexOf(':') === -1) {
        host.push('11211');
    } else if (host[0].length === 0) {
        host[0] = 'localhost';
    }
    return {
        host: host[0],
        port: host[1]
    };
};

/**
 * ready() - Predicate function, returns true if Client is ready, false otherwise.
 *   Client is ready when all of its connections are open and ready. If autodiscovery
 *   is enabled, Client is ready once it has contacted Elasticache and then initialized
 *   all of the connections
 */
Client.prototype.ready = function() {
    var size = _.size(this.connections);

    if (size < 1) {
        return false;
    } else {
        return _.reduce(this.connections, function(ready, conn) {
            ready = ready && conn.ready;
            return ready;
        }, true);
    }
};

/**
 * delete() - Delete an item from the cache
 *
 * @param {String} key - The key of the item to delete
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.delete = function(key, cb) {
    validateKey(key, 'delete');

    return this.run('delete', [key], cb);
};

/**
 * deleteMulti() - Delete multiple items from the cache
 *
 * @param {Array} keys - The keys of the items to delete
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.deleteMulti = function(keys, cb) {
    var self = this;
    misc.assert(keys, 'Cannot delete without keys!');

    return Promise.props(R.reduce(function(acc, key) {
        validateKey(key, 'deleteMulti');
        acc[key] = self.run('delete', [key], null);
        return acc;
    }, {}, keys)).nodeify(cb);
};

/**
 * set() - Set a value for the provided key
 *
 * @param {String} key - The key to set
 * @param {*} value - The value to set for this key. Can be of any type
 * @param {Number|Object|Function} [ttl = 0] - The time to live for this key or callback
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.set = function(key, val, ttl, cb) {
    validateKey(key, 'set');

    if (typeof ttl === 'function') {
        cb = ttl;
        ttl = 0;
    }

    return this.run('set', [key, val, ttl], cb);
};

/**
 * cas() - Set a value for the provided key if the CAS value matches
 *
 * @param {String} key - The key to set
 * @param {*} value - The value to set for this key. Can be of any type
 * @param {String} cas - A CAS value returned from a 'gets' call
 * @param {Number|Object|Function} [ttl = 0] - The time to live for this key or callback
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise} with a boolean value indicating if the value was stored (true) or not (false)
 */
Client.prototype.cas = function(key, val, cas, ttl, cb) {
    validateKey(key, 'cas');

    if (typeof ttl === 'function') {
        cb = ttl;
        ttl = 0;
    }

    return this.run('cas', [key, val, cas, ttl], cb);
};


/**
 * gets() - Get the value and CAS id for the provided key
 *
 * @param {String} key - The key to get
 * @param {Object} opts - Any options for this request
 * @param {Function} [cb] - The (optional) callback called on completion
 * @returns {Promise} which is an array containing the value and CAS id
 */
Client.prototype.gets = function(key, opts, cb) {
    validateKey(key, 'gets');

    if (typeof opts === 'function' && typeof cb === 'undefined') {
        cb = opts;
        opts = {};
    }

    return this.run('gets', [key, opts], cb);
};

/**
 * get() - Get the value for the provided key
 *
 * @param {String} key - The key to get
 * @param {Object} opts - Any options for this request
 * @param {Function} [cb] - The (optional) callback called on completion
 * @returns {Promise}
 */
Client.prototype.get = function(key, opts, cb) {
    if (typeof opts === 'function' && typeof cb === 'undefined') {
        cb = opts;
        opts = {};
    }

    if (_.isArray(key)) {
        return this.getMulti(key, opts, cb);
    } else {
        validateKey(key, 'get');
        return this.run('get', [key, opts], cb);
    }
};

/**
 * getMulti() - Get multiple values for the provided array of keys
 *
 * @param {Array} keys - The keys to get
 * @param {Function} [cb] - The value to set for this key. Can be of any type
 * @returns {Promise}
 */
Client.prototype.getMulti = function(keys, opts, cb) {
    var self = this;
    misc.assert(keys, 'Cannot get without key!');

    if (typeof opts === 'function' && typeof cb === 'undefined') {
        cb = opts;
        opts = {};
    }

    return Promise.props(R.reduce(function(acc, key) {
        validateKey(key, 'getMulti');
        acc[key] = self.run('get', [key, opts], null);
        return acc;
    }, {}, keys)).nodeify(cb);
};

/**
 * incr() - Increment a value for the provided key
 *
 * @param {String} key - The key to incr
 * @param {Number|Function} [value = 1] - The value to increment this key by. Must be an integer
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.incr = function(key, val, cb) {
    validateKey(key, 'incr');

    if (typeof val === 'function' || typeof val === 'undefined') {
        cb = val;
        val = 1;
    }

    misc.assert(typeof val === 'number', 'Cannot incr in memcache with a non number value');

    return this.run('incr', [key, val], cb);
};

/**
 * decr() - Decrement a value for the provided key
 *
 * @param {String} key - The key to decr
 * @param {Number|Function} [value = 1] - The value to decrement this key by. Must be an integer
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.decr = function(key, val, cb) {
    validateKey(key, 'decr');

    if (typeof val === 'function' || typeof val === 'undefined') {
        cb = val;
        val = 1;
    }

    misc.assert(typeof val === 'number', 'Cannot decr in memcache with a non number value');

    return this.run('decr', [key, val], cb);
};

/**
 * flush() - Removes all stored values
 * @param {Number|Function} [delay = 0] - Delay invalidation by specified seconds
 * @param {Function} [cb] - The (optional) callback called on completion
 * @returns {Promise}
 */
Client.prototype.flush = function (delay, cb) {
    if (typeof delay === 'function' || typeof delay === 'undefined') {
        cb = delay;
        delay = 0;
    }

    return this.run('flush_all', [delay], cb);
};

/**
 * items() - Gets items statistics
 * @param {Function} [cb] - The (optional) callback called on completion
 * @returns {Promise}
 */
Client.prototype.items = function(cb) {
    return this.run('stats items', [], cb);
};

/**
 * add() - Add value for the provided key only if it didn't already exist
 *
 * @param {String} key - The key to set
 * @param {*} value - The value to set for this key. Can be of any type
 * @param {Number|Object|Function} [ttl = 0] - The time to live for this key or callback
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.add = function(key, val, ttl, cb) {
    validateKey(key, 'add');

    if (typeof ttl === 'function') {
        cb = ttl;
        ttl = 0;
    }

    return this.run('add', [key, val, ttl], cb);
};

/**
 * replace() - Replace value for the provided key only if it already exists
 *
 * @param {String} key - The key to replace
 * @param {*} value - The value to replace for this key. Can be of any type
 * @param {Number|Object|Function} [ttl = 0] - The time to live for this key or callback
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.replace = function(key, val, ttl, cb) {
    validateKey(key, 'replace');

    if (typeof ttl === 'function') {
        cb = ttl;
        ttl = 0;
    }

    return this.run('replace', [key, val, ttl], cb);
};

/**
 * append() - Append value for the provided key only if it already exists
 *
 * @param {String} key - The key to append
 * @param {*} value - The value to append for this key. Can be of any type
 * @param {Number|Object|Function} [ttl = 0] - The time to live for this key or callback
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.append = function(key, val, ttl, cb) {
    validateKey(key, 'append');

    if (typeof ttl === 'function') {
        cb = ttl;
        ttl = 0;
    }

    return this.run('append', [key, val, ttl], cb);
};

/**
 * prepend() - Prepend value for the provided key only if it already exists
 *
 * @param {String} key - The key to prepend
 * @param {*} value - The value to prepend for this key. Can be of any type
 * @param {Number|Object|Function} [ttl = 0] - The time to live for this key or callback
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.prepend = function(key, val, ttl, cb) {
    validateKey(key, 'prepend');

    if (typeof ttl === 'function') {
        cb = ttl;
        ttl = 0;
    }

    return this.run('prepend', [key, val, ttl], cb);
};

/**
 * cachedump() - get cache information for a given slabs id
 * @param {number} slabsId
 * @param {number} [limit] Limit result to number of entries. Default is 0 (unlimited).
 * @param {Function} [cb] - The (optional) callback called on completion
 * @returns {Promise}
 */
Client.prototype.cachedump = function(slabsId, limit, cb) {
    misc.assert(slabsId, 'Cannot cachedump without slabId!');

    if (typeof limit === 'function' || typeof limit === 'undefined') {
        cb = limit;
        limit = 0;
    }

    return this.run('stats cachedump', [slabsId, limit], cb);
};

/**
 * version() - Get current Memcached version from the server
 * @param {Function} [cb] - The (optional) callback called on completion
 * @returns {Promise}
 */
Client.prototype.version = function(cb) {
    return this.run('version', [], cb);
};

/**
 * run() - Run this command on the appropriate connection. Will buffer command
 *   if connection(s) are not ready
 *
 * @param {String} command - The command to run
 * @param {Array} args - The arguments to send with this command
 * @returns {Promise}
 */
Client.prototype.run = function(command, args, cb) {
    if (this.disabled) {
        return Promise.resolve(null).nodeify(cb);
    }

    if (this.ready()) {
        // First, retrieve the correct connection out of the hashring
        var connection = this.connections[this.ring.get(args[0])];

        // Run this command
        return connection[command].apply(connection, args).nodeify(cb);
    } else if (this.bufferBeforeError === 0 || !this.queue) {
        return Promise.reject(new Error('Connection is not ready, either not connected yet or disconnected')).nodeify(cb);
    } else if (this.bufferedError) {
        return Promise.reject(this.bufferedError).nodeify(cb);
    } else {
        var deferred = misc.defer(args[0]);

        this.buffer = this.buffer.push({
            cmd: command,
            args: args,
            key: args[0],
            deferred: deferred
        });

        return deferred.promise.nodeify(cb);
    }
};

module.exports = Client;
