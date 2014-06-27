
/**
 * @file Main file for the Memcache Client
 */

var debug = require('debug')('memcache-plus:client');

var assert = require('assert'),
    Promise = require('bluebird');

function Client(opts) {
    if (!(this instanceof Client)) {
        return new Client(opts);
    }
    opts = opts || {};
    this.hosts = opts.hosts || [':11211'];

    this.connect();
}

Client.prototype.connect = function() {
    this.hosts.forEach(function(host) {
        // Connect to host
    });
};

/**
 * poll() - Poll to ensure the connection is still open
 *
 * @param {Number} [interval = 60] - The polling interval
 * @returns {Promise}
 * @api private
 */
Client.prototype.poll = function(interval) {
    debug('polling every %dms', interval);

    setInterval(function() {
        // Poll to ensure connections open and all is well in the land
    }, interval);
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
    ttl = ttl || 0;
    return new Promise(function(reject, resolve) {
        // Do the set

        // Then resolve
        resolve();

        // If error, reject
    }).nodeify(cb);
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

    return new Promise(function(reject, resolve) {
        // Do the set

        // Then resolve
        resolve();

        // If error, reject
    }).nodeify(cb);
};

module.exports = Client;
