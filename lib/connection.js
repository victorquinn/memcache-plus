/**
 * @file Main file for a Memcache Connection
 */

var debug = require('debug')('memcache-plus:connection');

var net = require('net');

function Connection(opts) {
    opts = opts || {};

    var components = opts.host.split(':');
    this.host = components[0];
    this.port = components[1];


    this.connect();
}

/**
 * Initialize connection
 *
 * @api private
 */
Connection.prototype.connect = function() {
    var params = {
        port: this.port
    };

    if (this.host) {
        params.host = this.host;
    }
    
    this.client = net.connect(params);
    this.client.on('connect', function() {
        debug('Successfully connected!');
    });
};

module.exports = Connection;
