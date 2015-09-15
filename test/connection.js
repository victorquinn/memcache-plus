
require('chai').should();

var Connection = require('../lib/connection');

describe('Connection', function() {
    var connection;
    beforeEach(function() {
        connection = new Connection();
    });
    
    it('initializes with defaults', function() {
        connection.should.have.property('host');
        connection.host.should.be.a('string');
        connection.should.have.property('port');
        connection.port.should.be.a('string');
    });

    it('initiates connection', function() {
        connection.should.have.property('client');
        connection.client.should.be.ok;
        
    });

    it('does connect', function(done) {
        connection.on('connect', function() {
            done();
        });
    });

    it('reconnects, if enabled and connection lost', function(done) {
        connection.on('connect', function() {
            connection.client.end();
            connection.on('connect', function() {
                done();
            });
        });
    });

    describe('does not reconnect when', function() {
        it('reconnect is disabled and connection lost', function(done) {
            connection = new Connection({ reconnect: false });
            connection.on('connect', function() {
                connection.client.end();
                connection.on('connect', function() {
                    done(new Error('The client should not have attempted to reconnect'));
                });
                setTimeout(function() {
                    done();
                }, 50);
            });
        });

        it('intentionally disconnected', function(done) {
            connection = new Connection();
            connection.on('connect', function() {
                connection.disconnect();
                connection.on('connect', function() {
                    done(new Error('The client should not have attempted to reconnect'));
                });
                setTimeout(function() {
                    done();
                }, 50);
            });
        });
        
    });

    afterEach(function() {
        connection.disconnect();
    });
});
