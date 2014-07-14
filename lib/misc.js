/**
 * @file misc.js
 *
 * Miscellaneous utility methods
 */

var Promise = require('bluebird');

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
