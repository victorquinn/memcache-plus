require('chai').should();
var _ = require('lodash'),
    chance = require('chance').Chance(),
    expect = require('chai').expect,
    Promise = require('bluebird');

var Client = require('../lib/client');

describe('Client', function() {
    describe('initialization', function() {
        it('with defaults', function() {
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
            _.sample(cache.connections).client.on('connect', function() {
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

        it('with default port with single connection', function() {
            var cache = new Client('localhost');
            cache.connections['localhost'].should.have.property('port');
            cache.connections['localhost'].port.should.equal('11211');
        });

        it('with default port with multiple connections', function() {
            var cache = new Client(['localhost']);
            cache.connections['localhost'].should.have.property('port');
            cache.connections['localhost'].port.should.equal('11211');
        });

        /**
         * Only comment this out when we have an Elasticache autodiscovery cluster to test against.
         *   Ideally one day this can be mocked, but for now just selectively enabling it
         */
        it('supports autodiscovery', function(done) {
            var cache = new Client({ hosts: ['victor.di6cba.cfg.use1.cache.amazonaws.com'], autodiscover: true });
            var val = chance.word();

            cache.set('test', val)
                .then(function() {
                    return cache.get('test');
                })
                .then(function(v) {
                    val.should.equal(v);
                    done();
                });
        });
        /* */
    });

    describe('set and get', function() {
        var cache;
        before(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('set');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.set(); }).to.throw('Cannot set without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.set(chance.word({length: 251})); }).to.throw('less than 250 characters');
            });

            it('with a non-string key', function() {
                expect(function() { cache.set({blah: 'test'}, 'val'); }).to.throw('not string key');
                expect(function() { cache.set([1, 2], 'val'); }).to.throw('not string key');
                expect(function() { cache.set(_.noop, 'val'); }).to.throw('not string key');
            });
        });

        it('should work', function() {
            var val = chance.word();
            return cache.set('mykey', val)
                .then(function() {
                    return cache.get('mykey');
                })
                .then(function(v) {
                    val.should.equal(v);
                });
        });

        it('works with callbacks as well', function(done) {
            var val = chance.word();
            cache.set('mykey', val, function(err) {
                if (err !== null) {
                    done(err);
                }
                cache.get('mykey', function(err, v) {
                    if (err !== null) {
                        done(err);
                    }
                    val.should.equal(v);
                    done();
                });
            });
        });

        it('multiple should not conflict', function() {
            var val1 = chance.word(), val2 = chance.word(), val3 = chance.word();

            var item1 = cache.set('mykey1', val1)
                    .then(function() {
                        return cache.get('mykey1');
                    })
                    .then(function(v) {
                        val1.should.equal(v);
                    });

            var item2 = cache.set('mykey2', val2)
                    .then(function() {
                        return cache.get('mykey2');
                    })
                    .then(function(v) {
                        val2.should.equal(v);
                    });

            var item3 = cache.set('mykey3', val3)
                    .then(function() {
                        return cache.get('mykey3');
                    })
                    .then(function(v) {
                        val3.should.equal(v);
                    });

            return Promise.all([item1, item2, item3]);
        });

    });

    describe('Helpers', function() {
        describe('splitHost()', function() {
            it('exists', function() {
                var client = new Client();
                client.should.have.property('splitHost');
            });

            it('works with no port', function() {
                var client = new Client();
                var hostName = chance.word();

                var host = client.splitHost(hostName);
                host.should.have.property('host');
                host.should.have.property('port');
                host.host.should.equal(hostName);
                host.port.should.equal('11211');
            });

            it('works with just a port', function() {
                var client = new Client();
                var port = chance.natural({ max: 65536 }).toString();

                var host = client.splitHost(':' + port);
                host.should.have.property('host');
                host.should.have.property('port');
                host.host.should.equal('localhost');
                host.port.should.equal(port);
            });

            it('works with both a host and port', function() {
                var client = new Client();
                var hostName = chance.word();
                var port = chance.natural({ max: 65536 }).toString();

                var host = client.splitHost(hostName + ':' + port);
                host.should.have.property('host');
                host.should.have.property('port');
                host.host.should.equal(hostName);
                host.port.should.equal(port);
            });
        });
    });
});
