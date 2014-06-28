
require('chai').should();

var Client = require('../lib/client');

describe('Client', function() {
    it('should initialize with defaults', function() {
        var cache = new Client();
        cache.should.have.property('hosts');
        cache.hosts.should.be.an('array');
    });
});
