/**
 * @file Main file for a Memcache Connection
 */

var debug = require('debug')('memcache-plus:connection');

var _ = require('lodash'),
    assert = require('assert'),
    carrier = require('carrier'),
    net = require('net'),
    Promise = require('bluebird'),
    Queue = require('collections/deque'),
    util = require('util');

/**
 * Connection constructor
 *
 * With the supplied options, connect.
 *
 * @param {object} opts - The options for this Connection instance
 */
function Connection(opts) {
    opts = opts || {};

    _.defaults(opts, {
        host: 'localhost:11211',
        reconnect: true
    });

    var components = opts.host.split(':');
    this.host = components[0];
    this.port = components[1];

    this.queue = new Queue();

    this.reconnect = opts.reconnect;
    this.disconnecting = false;
    this.ready = false;

    this.connect();
}

/**
 * Disconnect connection
 */
Connection.prototype.disconnect = function() {
    this.ready = false;
    this.disconnecting = true;
    this.client.end();
};

/**
 * Initialize connection
 *
 * @api private
 */
Connection.prototype.connect = function() {
    var self = this;
    var params = {
        port: this.port
    };

    if (this.host) {
        params.host = this.host;
    }

    // If a client already exists, we just want to reconnect
    if (this.client) {
        this.client.connect(params);

    } else {
        // Initialize a new client, connect
        this.client = net.connect(params);

        // If reconnect is enabled, we want to re-initiate connection if it is ended
        if (this.reconnect) {
            this.client.on('close', function() {
                // Wait 10ms before retrying
                // @todo this should probably be an exponential backoff
                setTimeout(function() {
                    // Only want to do this if a disconnect was not triggered intentionally
                    if (!self.disconnecting) {
                        self.client.destroy();
                        self.connect();
                    }
                }, 10);
            });
        }
    }
    Promise.promisifyAll(this.client);

    this.client.on('connect', function() {
        debug('Successfully reconnected!');
        this.ready = true;
    }.bind(this));

    carrier.carry(this.client, this.read.bind(this));
//    this.client.on('data', this.read.bind(this));
};

Connection.prototype.read = function(data) {
    var deferred = this.queue.peek();
    if (data.toString().substr(0, 5) === 'ERROR') {
        if (this.queue.toArray().length > 0) {
            // We only want to do this if the last thing was not an error,
            // as if it were, we already would have notified about the error
            // last time so now we want to ignore it
            this.queue.shift();
            deferred.reject(new Error('Memcache returned an error: ' + data.toString()));
        }
    } else {
        if (data.toString().substr(0, 5) === 'VALUE') {
            // Do nothing, this is just metadata. May want to somehow store this
            // and send it back somehow in the future
            debug('Got some metadata');
        } else if (data.toString().substr(0, 3) === 'END') {
            this.queue.shift();
            deferred.resolve(this.data);
        } else if (data.toString().substr(0, 6) === 'STORED') {
            this.queue.shift();
            deferred.resolve(data);
        } else {
            this.data = data;
        }
    }
};

Connection.prototype.write = function(str) {
    this.client.write(str);
    this.client.write('\r\n');
};

var defer = function(key) {
    var resolve, reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        key: key,
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};

/**
 * set() - Set a value on this connection
 */
Connection.prototype.set = function(key, val, ttl) {
    assert(typeof key === 'string', 'Cannot set in memcache with a not string key');
    assert(key.length < 250, 'Key must be less than 250 characters long');

    // @todo ensure val is a string before saving

    // @todo generalize this to be a `write` function rather than a `set` so it can
    //   be used for writing all kinds of responses. Then have `set` delegate to that

    ttl = ttl || 0;

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
   
    var deferred = defer(key);
    this.queue.push(deferred);

    // First send the metadata for this request
    this.write(util.format('set %s 0 %d %d', key, ttl, val.length));
    // Then the actual value
    this.write(val);

    return deferred.promise
        .then(function(data) {
            // data will be a buffer
            if (data.toString() !== 'STORED') {
                throw new Error(util.format('Something went wrong with the set. Expected STORED, got :%s:', data.toString()));
            } else {
                return Promise.resolve();
            }
        });
};

/**
 * get() - Get a value on this connection
 */
Connection.prototype.get = function(key) {
    // Do the get
    var deferred = defer(key);
    this.queue.push(deferred);

    this.write(util.format('get %s', key));

    return deferred.promise
        // .timeout() // @todo add this as a setting
        .then(function(data) {
            return data.toString();
        });
};

module.exports = Connection;
