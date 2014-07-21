/**
 * @file misc.js
 *
 * Miscellaneous utility methods
 */

var assert = require('chai').assert,
    Promise = require('bluebird'),
    zlib = Promise.promisifyAll(require('zlib'));

exports.defer = function(key) {
    key = key || null;

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
 * compress() - Compress the supplied value
 *
 * @param {Buffer} val - the buffer to compress
 * @returns {Promise} - Promise for the compressed buffer
 */
exports.compress = function(val) {
    assert.instanceOf(val, Buffer, 'Memcache-Plus can only compress a Buffer');
    return zlib.deflateAsync(val);
};

/**
 * decompress() - Decompress the supplied value
 *
 * @param {Buffer} val - the buffer to decompress
 * @returns {Promise} - Promise for the decompressed buffer
 */
exports.decompress = function(val) {
    assert.instanceOf(val, Buffer, 'Memcache-Plus can only decompress a Buffer');
    return zlib.inflateAsync(val);
};
