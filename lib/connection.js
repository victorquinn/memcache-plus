/**
 * @file Main file for a Memcache Connection
 */

var debug = require('debug')('memcache-plus:connection');

var _ = require('lodash'),
    net = require('net');

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
    var params = {
        port: this.port
    };

    if (this.host) {
        params.host = this.host;
    }

    // If a client already exists, we just want to reconnect
    if (this.client) {
        this.client.connect(params);
        this.client.on('connect', function() {
            debug('Successfully reconnected!');
        });

    } else {
        // Initialize a new client, connect
        this.client = net.connect(params);
        this.client.on('connect', function() {
            debug('Successfully connected!');
        });

        // If reconnect is enabled, we want to re-initiate connection if it is ended
        if (this.reconnect) {
            var self = this;
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
};

module.exports = Connection;
