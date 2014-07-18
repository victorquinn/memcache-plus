/**
 * @file Main file for the Memcache Client
 */

var debug = require('debug')('memcache-plus:client');

var _ = require('lodash'),
    assert = require('assert'),
    HashRing = require('hashring'),
    misc = require('./misc'),
    Promise = require('bluebird'),
    Queue = require('collections/deque'),
    R = require('ramda');

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
        disabled: false,
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
    debug('starting connection');
    this.connections = {};

    if (this.hosts === null) {
        this.hosts = ['localhost:11211'];
    }

    if (this.autodiscover) {
        // First connect to the servers provided
        this.getHostList()
            .bind(this)
            .then(function() {
                debug('got host list, connecting to hosts');
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
 *
 * @api private
 */
Client.prototype.connectToHosts = function() {
    debug('connecting to all hosts');
    this.hosts.forEach(function(host) {
        var h = this.splitHost(host);
        var client = this;

        // Connect to host
        this.connections[host] = new Connection({
            host: h.host,
            port: h.port,
            reconnect: this.reconnect,
            onConnect: function() {
                client.flushBuffer();
            }
        });
    }, this);

    this.ring = new HashRing(_.keys(this.connections));
};

/**
 * flushBuffer() - Flush the current buffer of commands, if any
 *
 * @api private
 */
Client.prototype.flushBuffer = function() {
    if (this.buffer && this.buffer.length > 0) {
        debug('flushing client write buffer');
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
 * ready() - Predicate function, returns true if Client is ready, false otherwise.
 *   Client is ready when all of its connections are open and ready. If autodiscovery
 *   is enabled, Client is ready once it has contacted Elasticache and then initialized
 *   all of the connections
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
 * delete() - Delete an item from the cache
 *
 * @param {String} key - The key of the item to delete
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.delete = function(key, cb) {
    assert.ok(key, 'Cannot delete without key!');
    return this.run('delete', [key], cb);
};

/**
 * deleteMulti() - Delete multiple items from the cache
 *
 * @param {Array} keys - The keys of the items to delete
 * @param {Function} [cb] - Callback to call when we have a value
 * @returns {Promise}
 */
Client.prototype.deleteMulti = function(keys, cb) {
    var self = this;
    assert.ok(keys, 'Cannot delete without keys!');
    return Promise.props(R.reduce(function(acc, key) {
        acc[key] = self.run('delete', [key], null);
        return acc;
    }, {}, keys)).nodeify(cb);
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

    return this.run('set', [key, val, ttl], cb);
};


/**
 * get() - Get the value for the provided key
 *
 * @param {String} key - The key to get
 * @param {Function} [cb] - The (optional) callback called on completion
 * @returns {Promise}
 */
Client.prototype.get = function(key, cb) {
    assert.ok(key, 'Cannot get without key!');
    if (_.isArray(key)) {
        return this.getMulti(key, cb);
    } else {
        return this.run('get', [key], cb);
    }
};

/**
 * getMulti() - Get multiple values for the provided array of keys
 *
 * @param {Array} keys - The keys to get
 * @param {Function} [cb] - The value to set for this key. Can be of any type
 * @returns {Promise}
 */
Client.prototype.getMulti = function(keys, cb) {
    var self = this;
    assert.ok(keys, 'Cannot get without key!');
    
    return Promise.props(R.reduce(function(acc, key) {
        acc[key] = self.run('get', [key], null);
        return acc;
    }, {}, keys)).nodeify(cb);
};

/**
 * run() - Run this command on the appropriate connection. Will buffer command
 *   if connection(s) are not ready
 *
 * @param {String} command - The command to run
 * @param {Array} args - The arguments to send with this command
 * @returns {Promise}
 */
Client.prototype.run = function(command, args, cb) {
    var deferred = misc.defer(args[0]);

    if (this.ready()) {
        // First, retrieve the correct connection out of the hashring
        var connection = this.connections[this.ring.get(args[0])];

        // Run this command
        connection[command].apply(connection, args).then(deferred.resolve).catch(deferred.reject);
    } else {
        this.buffer = this.buffer || new Queue();

        this.buffer.push({
            cmd: command,
            args: args,
            key: args[0],
            deferred: deferred
        });
    }

    if (this.disabled) {
        return Promise.resolve(null).nodeify(cb);
    } else {
        return deferred.promise.nodeify(cb);
    }
};

module.exports = Client;
