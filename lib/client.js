
/**
 * @file Main file for the Memcache Client
 */

var debug = require('debug')('memcache-plus:client');

var _ = require('lodash'),
    assert = require('assert'),
    HashRing = require('hashring');

var Connection = require('./connection');

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
        hosts: null,
        reconnect: true
    });

    // Iterate over options, assign each to this object
    _.forEach(opts, function(value, key) {
        this[key] = value;
    }, this);

    this.connect();
}

/**
 * connect() - Iterate over all hosts, connect to each.
 *
 * @api private
 */
Client.prototype.connect = function() {
    debug('Connecting...');
    this.connections = {};

    if (this.hosts === null) {
        this.hosts = ['localhost:11211'];
    }

    this.hosts.forEach(function(host) {
        var conn = host.split(':');
        // Default prot to 11211 if none provided
        if (conn.length === 1) {
            conn[1] = '11211';
        }

        // Connect to host
        this.connections[host] = new Connection({
            host: conn[0],
            port: conn[1],
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
