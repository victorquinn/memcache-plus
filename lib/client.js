
/**
 * @file Main file for the Memcache Client
 */

/**
 * Module dependencies
 */

function Client(options) {
    options = options || {};
    this.hosts = options.hosts || [":11211"];

    this.connect();
};

Client.prototype.connect = function() {

};

module.exports = Client;
