/**
 * @file misc.js
 *
 * Miscellaneous utility methods
 */

var Promise = require('bluebird'),
    zlib = Promise.promisifyAll(require('zlib'));

function assert(cond, msg) {
    if(!cond) { throw new Error('AssertionError: ' + msg); }
}
exports.assert = assert;

exports.defer = function defer(key) {
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
exports.compress = function compress(val) {
    assert(val instanceof Buffer, 'Memcache-Plus can only compress a Buffer');
    return zlib.deflateAsync(val);
};

/**
 * decompress() - Decompress the supplied value
 *
 * @param {Buffer} val - the buffer to decompress
 * @returns {Promise} - Promise for the decompressed buffer
 */
exports.decompress = function decompress(val) {
    assert(val instanceof Buffer, 'Memcache-Plus can only decompress a Buffer');
    return zlib.inflateAsync(val);
};

/**
 * truncateIfNecessary() - Truncate string if too long, for display purposes
 *   only
 */
exports.truncateIfNecessary = function truncateIfNecessary(str, len) {
    assert(typeof str === 'string', 'str needs to be of type "string"');
    len = len || 100;
    return str && str.length > len ? str.substr(0, len) + '...' : str;
};
