
/**
 * Module dependencies
 */

var Client = require("./lib/client");

/**
 * Create a new Memcache Client
 *
 * @param {object} options
 * @return {Client} - A memcache client
 * @api public
 */

exports.client = function(options) {
    return new Client(options);
};
