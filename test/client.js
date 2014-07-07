
require('chai').should();

var Client = require('../lib/client');

describe('Client', function() {
    describe('initialization', function() {
        it('initializes with defaults', function() {
            var cache = new Client();
            cache.should.have.property('reconnect');
            cache.reconnect.should.be.a('boolean');
            cache.should.have.property('hosts');
            cache.hosts.should.be.an('array');
        });

        it('initiates connection', function(done) {
            var cache = new Client();
            cache.should.have.property('connections');
            cache.connections.should.be.an('object');
            cache.connections[':11211'].client.on('connect', function() {
                done();
            });
        });

        it('has a dictionary of connections', function() {
            var cache = new Client();
            cache.should.have.property('hosts');
            cache.connections.should.be.an('object');
        });

        it('has a hashring of connections', function() {
            var cache = new Client();
            cache.should.have.property('ring');
            cache.ring.should.be.an.instanceof(require('hashring'));
        });
    });

    describe('set and get', function() {
        before(function() {
            var cache = new Client();
        });
    });
});
