
require('chai').should();

var Client = require('../lib/client');

describe('Client', function() {
    it('initializes with defaults', function() {
        var cache = new Client();
        cache.should.have.property('hosts');
        cache.hosts.should.be.an('array');
    });

    it('initiates connection', function() {
        var cache = new Client();
        cache.should.have.property('connections');
        cache.connections.should.be.an('array');
    });
});
