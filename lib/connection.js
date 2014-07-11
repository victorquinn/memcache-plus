/**
 * @file Main file for a Memcache Connection
 */

var debug = require('debug')('memcache-plus:connection');

var _ = require('lodash'),
    assert = require('assert'),
    net = require('net'),
    Promise = require('bluebird'),
    Queue = require('collections/deque'),
    util = require('util');

/**
 * Connection constructor
 *
 * With the supplied options, connect.
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

    this.connect();
}

/**
 * Disconnect connection
 */
Connection.prototype.disconnect = function() {
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

    this.client.on('connect', function() {
        debug('Successfully reconnected!');
    });

    this.client.on('data', function(data) {
        var deferred = self.queue.pop();
        // @todo we need to wait until all data comes in here, since it may come in
        //   bit by bit
        deferred.resolve(data);
    });

    Promise.promisifyAll(this.client);
};

var write = function(client, val) {
    // Default to new line if no value is provided
    if (!val) {
        val = '\r\n';
    }
    return function() {
        return client.writeAsync(val);
    };
};

var defer = function() {
    var resolve, reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};

/**
 * set() - Set a value on this connection
 */
Connection.prototype.set = function(key, val, ttl, cb) {
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
   
    var deferred = defer();

    // Do the set
    var pWrite = write(this.client, util.format('set %s 0 %d %d', key, ttl, val.length))() // First write metadata
            .then(write(this.client)) // then crlf
            .then(write(this.client, val)) // then value
            .then(write(this.client)) // then crlf again to commit
            .then(function() {
                return deferred.promise;
            })
            .then(function(data) {

                // data will be a buffer
                if (data.toString() !== 'STORED\r\n') {
                    throw new Error('Something went wrong with the set');
                } else {
                    return Promise.resolve();
                }
            })
            .nodeify(cb);

    this.queue.unshift(deferred);

    return pWrite;
};

/**
 * get() - Get a value on this connection
 */
Connection.prototype.get = function(key, cb) {
    // Do the get

    var deferred = defer();

    var pRead = write(this.client, util.format('get %s', key))()
            .then(write(this.client)) // then crlf
            .then(function() {
                return deferred.promise;
            })
            // .timeout() // @todo add this as a setting
            .then(function(data) {
                var out = data.toString().split('\r\n');
                return out[1];
            })
            .nodeify(cb);

    this.queue.unshift(deferred);

    return pRead;
};

module.exports = Connection;
