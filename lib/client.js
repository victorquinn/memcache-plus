/**
 * @file Main file for the Memcache Client
 */

var debug = require('debug')('memcache-plus:client');

var _ = require('lodash'),
    assert = require('assert'),
    HashRing = require('hashring'),
    misc = require('./misc'),
    Promise = require('bluebird'),
    Queue = require('collections/deque');

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
        autodiscover: false,
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

    if (this.autodiscover) {
        // First connect to the servers provided
        this.getHostList()
            .bind(this)
            .then(function() {
                // Connect to these hosts
                this.connectToHosts();
                this.ring = new HashRing(_.keys(this.connections));
            });

        // Then get the list of servers

        // Then connect to those
    } else {
        this.connectToHosts();
    }
};

/**
 * getHostList() - Given a list of hosts, contact them via Elasticache
 *   autodiscover and retrieve the list of hosts
 *
 * @api private
 */
Client.prototype.getHostList = function() {

    var connections = {};
    // Promise.any because we don't care which completes first, as soon as we get
    // a list of hosts we can stop
    return Promise.any(this.hosts.map(function(host) {
        var h = this.splitHost(host);
        var deferred = misc.defer();
        connections[host] = new Connection({
            host: h.host,
            port: h.port,
            reconnect: false,
            onConnect: function() {
                // Do the autodiscovery, then resolve with hosts
                return deferred.resolve(this.autodiscovery());
            }
        });

        return deferred.promise;
    }, this)).bind(this).then(function(hosts) {
        this.hosts = hosts;
        this.connectToHosts();
        this.flushBuffer();
    });
};

/**
 * connectToHosts() - Given a list of hosts, actually connect to them
 */
Client.prototype.connectToHosts = function() {
    this.hosts.forEach(function(host) {
        var h = this.splitHost(host);

        // Connect to host
        this.connections[host] = new Connection({
            host: h.host,
            port: h.port,
            reconnect: this.reconnect
        });
    }, this);

    this.ring = new HashRing(_.keys(this.connections));
};

Client.prototype.flushBuffer = function() {
    if (this.buffer && this.buffer.length > 0) {
        // @todo Watch out for and handle how this behaves with a very long buffer
        while(this.buffer.length > 0) {
            var item = this.buffer.shift();

            // First, retrieve the correct connection out of the hashring
            var connection = this.connections[this.ring.get(item.key)];

            connection[item.cmd].apply(connection, item.args).then(item.deferred.resolve);
        }
    }
};

/**
 * splitHost() - Helper to split a host string into port and host
 *
 * @api private
 */
Client.prototype.splitHost = function(str) {
    var host = str.split(':');

    if (host.length === 1 && host.indexOf(':') === -1) {
        host.push('11211');
    } else if (host[0].length === 0) {
        host[0] = 'localhost';
    }
    return {
        host: host[0],
        port: host[1]
    };
};

/**
 * ready() - Predicate function, returns true if ready, false otherwise
 */
Client.prototype.ready = function() {
    var size = _.size(this.connections);

    if (size < 1) {
        return false;
    } else {
        return _.reduce(this.connections, function(ready, conn) {
            ready = ready && conn.ready;
            return ready;
        }, true);
    }
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
    var ready = this.ready();

    if (ready) {
        // First, retrieve the correct connection out of the hashring
        var connection = this.connections[this.ring.get(key)];

        // Do the set
        return connection.set(key, val, ttl).nodeify(cb);
    } else {
        this.buffer = this.buffer || new Queue();

        var deferred = misc.defer();

        this.buffer.push({
            cmd: 'set',
            args: Array.prototype.slice.call(arguments),
            key: key,
            deferred: deferred
        });

        return deferred.promise.nodeify(cb);
    }
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
