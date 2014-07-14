
/**
 * @file Main file for the Memcache Client
 */

var debug = require('debug')('memcache-plus:client');

var _ = require('lodash'),
    assert = require('assert'),
    HashRing = require('hashring');

var Connection = require('./connection');

function Client(opts) {
    if (!(this instanceof Client)) {
        return new Client(opts);
    }

    opts = opts || {};

    _.defaults(opts, {
        hosts: [':11211'],
        reconnect: true
    });

    // Iterate over options, assign each to this object
    _.forEach(opts, function(value, key) {
        this[key] = value;
    }, this);

    this.connect();
}

Client.prototype.connect = function() {
    debug('Connecting...');
    this.connections = {};

    this.hosts.forEach(function(host) {
        // Connect to host
        this.connections[host] = new Connection({
            host: host,
            reconnect: this.reconnect
        });
    }, this);

    this.ring = new HashRing(_.keys(this.connections));
};

/**
 * set() - Set a value for the provided key
 *
 * @param {String} key - The key to set
 * @param {*} value - The value to set for this key. Can be of any type
 * @param {Number|Function} [ttl = 0] - The time to live for this key or callback
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.set = function(key, val, ttl, cb) {
    assert.ok(key, 'Cannot set without key!');

    if (typeof ttl === 'function') {
        cb = ttl;
        ttl = 0;
    }

    // First, retrieve the correct connection out of the hashring
    var connection = this.connections[this.ring.get(key)];

    // Do the set
    return connection.set(key, val, ttl).nodeify(cb);
};

/**
 * get() - Get the value for the provided key
 *
 * @param {String} key - The key to set
 * @param {Function} [cb] - The value to set for this key. Can be of any type
 * @returns {Promise}
 */
Client.prototype.get = function(key, cb) {
    assert.ok(key, 'Cannot get without key!');

    // First, retrieve the correct connection out of the hashring
    var connection = this.connections[this.ring.get(key)];

    // Do the get
    return connection.get(key).nodeify(cb);
};

module.exports = Client;
