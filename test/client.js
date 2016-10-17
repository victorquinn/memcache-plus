require('chai').should();
var _ = require('lodash'),
    chance = require('chance').Chance(),
    expect = require('chai').expect,
    misc = require('../lib/misc'),
    Promise = require('bluebird');

var Client = require('../lib/client');

describe('Client', function() {
    var keys = [];
    // We want a method for generating keys which will store them so we can
    // do cleanup later and not litter memcache with a bunch of garbage data
    var getKey = function(opts) {
        var key;
        if (opts) {
            key = chance.word(opts);
        } else {
            key = chance.guid();
        }
        keys.push(key);
        return key;
    };

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

        it('has a disconnect method', function(done) {
            var cache = new Client();
            cache.should.have.property('disconnect');
            cache.disconnect.should.be.a('function');
            _.sample(cache.connections).client.on('connect', function() {
                cache.disconnect()
                     .then(function() {
                         cache.connections.should.be.an('object');
                         _.keys(cache.connections).should.have.length(0);
                     })
                     .then(done);
            });
        });

        it('can disconnect from a specific client with string', function(done) {
            var cache = new Client({ hosts: ['localhost:11211', '127.0.0.1:11211'] });
            cache.should.have.property('disconnect');
            cache.disconnect.should.be.a('function');
            cache.disconnect('127.0.0.1:11211')
                 .then(function() {
                     cache.connections.should.be.an('object');
                     _.keys(cache.connections).should.have.length(1);
                     cache.hosts.should.have.length(1);
                     _.keys(cache.connections)[0].should.equal('localhost:11211');
                     cache.hosts[0].should.equal('localhost:11211');
                 })
                 .then(done);
        });

        it('can disconnect from a specific client with array', function(done) {
            var cache = new Client({ hosts: ['localhost:11211', '127.0.0.1:11211'] });
            cache.should.have.property('disconnect');
            cache.disconnect.should.be.a('function');
            cache.disconnect(['127.0.0.1:11211'])
                 .then(function() {
                     cache.connections.should.be.an('object');
                     _.keys(cache.connections).should.have.length(1);
                     _.keys(cache.connections)[0].should.equal('localhost:11211');
                 })
                 .then(done);
        });

        it('throws an error if attempting to disconnect from a bogus host', function() {
            var cache = new Client({ hosts: ['localhost:11211', '127.0.0.1:11211'] });
            cache.should.have.property('disconnect');
            cache.disconnect.should.be.a('function');
            expect(function() { cache.disconnect(['badserver:11211']); }).to.throw('Cannot disconnect from server unless connected');
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
        */
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
                expect(function() { cache.set(chance.string({length: 251}), chance.word()); }).to.throw('less than 250 characters');
            });

            it('with a non-string key', function() {
                expect(function() { cache.set({blah: 'test'}, 'val'); }).to.throw('not string key');
                expect(function() { cache.set([1, 2], 'val'); }).to.throw('not string key');
                expect(function() { cache.set(_.noop, 'val'); }).to.throw('not string key');
            });
        });

        it('should work', function() {
            var key = getKey(), val = chance.word();

            return cache.set(key, val)
                        .then(function() {
                            return cache.get(key);
                        })
                        .then(function(v) {
                            val.should.equal(v);
                        });
        });

        it('works with very large values', function() {
            var key = getKey(), val = chance.word({ length: 1000000 });

            return cache.set(key, val)
                .then(function() {
                    return cache.get(key);
                })
                .then(function(v) {
                    val.should.equal(v);
                });
        });

        describe('compression', function() {
            it('does not throw an error if compression specified', function() {
                var key = getKey(), val = chance.word({ length: 1000 });
                return cache.set(key, val, { compressed: true });
            });

            it('works of its own accord', function() {
                var val = chance.word({ length: 1000 });

                return misc.compress(new Buffer(val))
                    .then(function(v) {
                        return misc.decompress(v);
                    })
                    .then(function(d) {
                        d.toString().should.equal(val);
                    });
            });

            it('get works with compression', function() {
                var key = getKey(), val = chance.word({ length: 1000 });

                return cache.set(key, val, { compressed: true })
                            .then(function() {
                                return cache.get(key, { compressed: true });
                            })
                            .then(function(v) {
                                val.should.equal(v);
                            });
            });

            it('get works with compression without explicit get compressed flag', function() {
                var key = getKey(), val = chance.word({ length: 1000 });

                return cache.set(key, val, { compressed: true })
                            .then(function() {
                                return cache.get(key);
                            })
                            .then(function(v) {
                                val.should.equal(v);
                            });
            });

            it('getMulti works with compression', function() {
                var key1 = getKey(), key2 = getKey(),
                    val1 = chance.word(), val2 = chance.word();

                return Promise.all([cache.set(key1, val1, { compressed: true }), cache.set(key2, val2, { compressed: true })])
                    .then(function() {
                        return cache.getMulti([key1, key2], { compressed: true });
                    })
                    .then(function(vals) {
                        vals.should.be.an('object');
                        vals[key1].should.equal(val1);
                        vals[key2].should.equal(val2);
                    });
            });

            it('get works with a callback', function(done) {
                var key = getKey(), val = chance.word({ length: 1000 });

                return cache.set(key, val, { compressed: true })
                    .then(function() {
                        cache.get(key, { compressed: true }, function(err, v) {
                            val.should.equal(v);
                            done(err);
                        });
                    });
            });

            it('get for key that should be compressed but is not returns null', function() {
                var key = getKey(), val = chance.word({ length: 1000 });

                return cache.set(key, val)
                            .then(function() {
                                return cache.get(key, { compressed: true });
                            })
                            .then(function(v) {
                                expect(v).to.be.null;
                            });
            });
        });

        it('does not throw an error when setting a value number', function() {
            var key = chance.guid(), val = chance.natural();

            expect(function() { cache.set(key, val); }).to.not.throw();
        });

        it('get for val set as number returns number', function() {
            var key = getKey(), val = chance.integer();

            return cache.set(key, val)
                        .then(function() {
                            return cache.get(key);
                        })
                        .then(function(v) {
                            expect(v).to.be.a.number;
                            v.should.equal(val);
                        });
        });

        it('get for val set as floating number returns number', function() {
            var key = getKey(), val = chance.floating();

            return cache.set(key, val)
                        .then(function() {
                            return cache.get(key);
                        })
                        .then(function(v) {
                            expect(v).to.be.a.number;
                            v.should.equal(val);
                        });
        });

        it('get for val set as object returns object', function() {
            var key = getKey(), val = { num: chance.integer() };

            return cache.set(key, val)
                        .then(function() {
                            return cache.get(key);
                        })
                        .then(function(v) {
                            expect(v).to.be.an.object;
                            (v.num).should.equal(val.num);
                        });
        });

        it('get for val set as Buffer returns Buffer', function() {
            var key = getKey(), val = new Buffer('blah blah test');

            return cache.set(key, val)
                        .then(function() {
                            return cache.get(key);
                        })
                        .then(function(v) {
                            expect(v).to.be.an.instanceof(Buffer);
                            (v.toString()).should.equal(val.toString());
                        });
        });

        it('get for val set as null returns null', function() {
            var key = getKey(), val = null;

            return cache.set(key, val)
                        .then(function() {
                            return cache.get(key);
                        })
                        .then(function(v) {
                            expect(v).to.be.null;
                        });
        });

        it('get for val set as array returns array', function() {
            var key = getKey(), val = [ chance.integer(), chance.integer() ];

            return cache.set(key, val)
                        .then(function() {
                            return cache.get(key);
                        })
                        .then(function(v) {
                            expect(v).to.be.an.array;
                            expect(v).to.deep.equal(val);
                        });
        });

        it('throws error with enormous values (over memcache limit)', function() {
            // Limit is 1048577, 1 byte more throws error. We'll go up a few just to be safe
            var key = getKey(), val = chance.word({ length: 1048590 });
            return cache.set(key, val)
                .then(function() {
                    throw new Error('this code should never get hit');
                })
                .catch(function(err) {
                    err.should.be.ok;
                    err.should.be.an.instanceof(Error);
                    err.should.deep.equal(new Error('Value too large to set in memcache'));
                });
        });

        it('works fine with special characters', function() {
            var key = getKey(),
                val = chance.string({ pool: 'ÀÈÌÒÙàèìòÁÉÍÓÚáéíóúÂÊÎÔÛâêîôûÃÑÕãñõÄËÏÖÜŸäëïöüÿæ☃', length: 1000 });

            return cache.set(key, val)
                .then(function() {
                    return cache.get(key);
                })
                .then(function(v) {
                    val.should.equal(v);
                });
        });

        it('works with callbacks as well', function(done) {
            var key = getKey(), val = chance.word();

            cache.set(key, val, function(err) {
                if (err !== null) {
                    done(err);
                }
                cache.get(key, function(err, v) {
                    if (err !== null) {
                        done(err);
                    }
                    val.should.equal(v);
                    done();
                });
            });
        });

        it('multiple should not conflict', function() {
            var key1 = getKey(), key2 = getKey(), key3 = getKey(),
                val1 = chance.word(), val2 = chance.word(), val3 = chance.word();

            var item1 = cache.set(key1, val1)
                    .then(function() {
                        return cache.get(key1);
                    })
                    .then(function(v) {
                        val1.should.equal(v);
                    });

            var item2 = cache.set(key2, val2)
                    .then(function() {
                        return cache.get(key2);
                    })
                    .then(function(v) {
                        val2.should.equal(v);
                    });

            var item3 = cache.set(key3, val3)
                    .then(function() {
                        return cache.get(key3);
                    })
                    .then(function(v) {
                        val3.should.equal(v);
                    });

            return Promise.all([item1, item2, item3]);
        });

        it('many multiple operations should not conflict', function() {
            var key = getKey(), key1 = getKey(), key2 = getKey(), key3 = getKey(),
                val1 = chance.word(), val2 = chance.word(), val3 = chance.word();


            return cache.set(key, val1)
                .then(function() {
                    return Promise.all([
                        cache.delete(key),
                        cache.set(key1, val1),
                        cache.set(key2, val2),
                        cache.set(key3, val3)
                    ]);
                })
                .then(function() {
                    return Promise.all([cache.get(key1), cache.get(key2), cache.get(key3)]);
                })
                .then(function(v) {
                    v[0].should.equal(val1);
                    v[1].should.equal(val2);
                    v[2].should.equal(val3);

                    return Promise.all([
                        cache.get(key1),
                        cache.deleteMulti([key1, key3])
                    ]);
                })
                .then(function(v) {
                    v[0].should.equal(val1);
                });
        });

        describe('get to key that does not exist returns null', function() {
            it('with Promise', function() {
                return cache.get(chance.guid())
                    .then(function(v) {
                        expect(v).to.be.null;
                    });
            });

            it('with Callback', function(done) {
                cache.get(chance.word(), function(err, response) {
                    expect(response).to.be.null;
                    done(err);
                });
            });
        });

        describe('getMulti', function() {
            it('exists', function() {
                cache.should.have.property('getMulti');
            });

            it('works', function() {
                var key1 = getKey(), key2 = getKey(),
                    val1 = chance.word(), val2 = chance.word();

                return Promise.all([cache.set(key1, val1), cache.set(key2, val2)])
                    .then(function() {
                        return cache.getMulti([key1, key2]);
                    })
                    .then(function(vals) {
                        vals.should.be.an('object');
                        vals[key1].should.equal(val1);
                        vals[key2].should.equal(val2);
                    });
            });

            it('get with array of keys delegates to getMulti', function() {
                var key1 = getKey(), key2 = getKey(),
                    val1 = chance.word(), val2 = chance.word();

                return Promise.all([cache.set(key1, val1), cache.set(key2, val2)])
                    .then(function() {
                        return cache.get([key1, key2]);
                    })
                    .then(function(vals) {
                        vals.should.be.an('object');
                        vals[key1].should.equal(val1);
                        vals[key2].should.equal(val2);
                    });
            });

            it('works if some values not found', function() {
                var key1 = getKey(), key2 = getKey(),
                    val = chance.word();

                return cache.set(key1, val)
                    .then(function() {
                        return cache.getMulti([key1, key2]);
                    })
                    .then(function(vals) {
                        vals.should.be.an('object');
                        vals[key1].should.equal(val);
                        expect(vals[key2]).to.equal(null);
                    });
            });

            it('works if all values not found', function() {
                var key = getKey(), key2 = getKey(), key3 = getKey(),
                    val = chance.word();

                return cache.set(key, val)
                    .then(function() {
                        return cache.getMulti([key2, key3]);
                    })
                    .then(function(vals) {
                        vals.should.be.an('object');
                        _.size(vals).should.equal(2);
                        expect(vals[key2]).to.equal(null);
                        expect(vals[key3]).to.equal(null);
                    });
            });

            it('works if all values not found with callback', function(done) {
                var key = getKey(), key2 = getKey(), key3 = getKey(),
                    val = chance.word();

                cache.set(key, val)
                    .then(function() {
                        cache.getMulti([key2, key3], function(err, vals) {
                            vals.should.be.an('object');
                            _.size(vals).should.equal(2);
                            expect(vals[key2]).to.equal(null);
                            expect(vals[key3]).to.equal(null);
                            done(err);
                        });
                    });
            });
        });

        describe('works with expiration', function() {
            it('expires', function() {
                var key = getKey(), val = chance.word();

                return cache.set(key, val, 1)
                    .then(function() {
                        return cache.get(key);
                    })
                    .then(function(v) {
                        val.should.equal(v);
                    })
                    .delay(1001)
                    .then(function() {
                        return cache.get(key);
                    })
                    .then(function(v) {
                        expect(v).to.be.null;
                    });
            });
        });
    });
    // @todo should have cleanup jobs to delete keys we set in memcache
    describe('delete', function() {
        var cache;
        before(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('delete');
            cache.delete.should.be.a('function');
        });

        it('works', function() {
            var key = getKey();

            return cache.set(key, 'myvalue')
                .then(function() {
                    return cache.delete(key);
                })
                .then(function() {
                    return cache.get(key);
                })
                .then(function(v) {
                    expect(v).to.be.null;
                });
        });

        it('does not blow up if deleting key that does not exist', function() {
            var key = chance.guid();

            return cache.delete(key);
        });
    });

    describe('deleteMulti', function() {
        var cache;
        before(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('deleteMulti');
            cache.deleteMulti.should.be.a('function');
        });

        it('works', function() {
            var key1 = getKey(), key2 = getKey();

            return Promise.all([cache.set(key1, 'myvalue'), cache.set(key2, 'myvalue')])
                .then(function() {
                    return cache.deleteMulti([key1, key2]);
                })
                .then(function(d) {
                    d.should.be.an.object;
                    _.values(d).indexOf(null).should.equal(-1);
                    _.every(d).should.be.true;
                    return Promise.all([cache.get(key1), cache.get(key2)]);
                })
                .spread(function(v1, v2) {
                    expect(v1).to.be.null;
                    expect(v2).to.be.null;
                    return;
                });
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

    describe('Options', function() {
        it('can be disabled', function() {
            var client = new Client({ disabled: true });
            var key = getKey(), val = chance.word();

            return client.set(key, val)
                .then(function() {
                    return client.get(key);
                })
                .then(function(v) {
                    expect(v).to.be.null;
                });
        });
    });

    describe('incr', function() {
        var cache;
        before(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('incr');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.incr(); }).to.throw('Cannot incr without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.incr(chance.string({length: 251})); }).to.throw('less than 250 characters');
            });

            it('with a non-string key', function() {
                expect(function() { cache.incr({blah: 'test'}); }).to.throw('not string key');
                expect(function() { cache.incr([1, 2]); }).to.throw('not string key');
                expect(function() { cache.incr(_.noop); }).to.throw('not string key');
            });

            it('with a val that is not a number', function() {
                expect(function() { cache.incr(chance.string(), chance.word()); }).to.throw('AssertionError: Cannot incr in memcache with a non number value');
            });
        });

        describe('should work', function() {
            it('without an increment value', function() {
                var key = getKey(), val = chance.natural();

                return cache.set(key, val)
                            .then(function() {
                                return cache.incr(key);
                            })
                            .then(function(v) {
                                v.should.equal(val + 1);
                            });
            });

            it('with an increment value', function() {
                var key = getKey(), val = chance.natural({ max: 20000000}), incr = chance.natural({ max: 1000 });
                return cache.set(key, val)
                            .then(function() {
                                return cache.incr(key, incr);
                            })
                            .then(function(v) {
                                v.should.equal(val + incr);
                            });
            });
        });
    });

    describe('decr', function() {
        var cache;
        before(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('decr');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.decr(); }).to.throw('Cannot decr without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.decr(chance.string({length: 251})); }).to.throw('less than 250 characters');
            });

            it('with a non-string key', function() {
                expect(function() { cache.decr({blah: 'test'}); }).to.throw('not string key');
                expect(function() { cache.decr([1, 2]); }).to.throw('not string key');
                expect(function() { cache.decr(_.noop); }).to.throw('not string key');
            });

            it('with a val that is not a number', function() {
                expect(function() { cache.decr(chance.string(), chance.word()); }).to.throw('AssertionError: Cannot decr in memcache with a non number value');
            });
        });

        describe('should work', function() {
            it('without a decrement value', function() {
                var key = getKey(), val = chance.natural();

                return cache.set(key, val)
                            .then(function() {
                                return cache.decr(key);
                            })
                            .then(function(v) {
                                v.should.equal(val - 1);
                            });
            });

            it('with a decrement value', function() {
                var key = getKey(), val = chance.natural({ max: 20000000}), decr = chance.natural({ max: 1000 });
                return cache.set(key, val)
                            .then(function() {
                                return cache.decr(key, decr);
                            })
                            .then(function(v) {
                                v.should.equal(val - decr);
                            });
            });
        });
    });

    describe('flush', function() {
        var cache;
        before(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('flush');
        });

        describe('should work', function() {
            it('removes all data', function () {
                var key = getKey(), val = chance.natural();

                return cache.set(key, val)
                     .then(function() {
                         return cache.get(key);
                     })
                     .then(function(v) {
                         expect(v).to.equal(val);
                         return cache.flush();
                     })
                     .then(function () {
                         return cache.get(key);
                     })
                     .then(function (v) {
                         expect(v).to.equal(null);
                     });
            });

            it('removes all data after a specified seconds', function () {
                var key = getKey(), val = chance.natural();

                return cache.set(key, val)
                     .then(function() {
                         return cache.get(key);
                     })
                     .then(function(v) {
                         expect(v).to.equal(val);
                         return cache.flush(1);
                     })
                     .then(function () {
                         return cache.get(key);
                     })
                     .then(function (v) {
                         expect(v).to.equal(v);
                     })
                     .delay(1001)
                     .then(function() {
                         return cache.get(key);
                     })
                     .then(function (v) {
                         expect(v).to.equal(null);
                     });
            });
        });
    });

    describe('add', function() {
        var cache;
        before(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('add');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.add(); }).to.throw('Cannot add without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.add(chance.string({length: 251})); }).to.throw('less than 250 characters');
            });

            it('with a non-string key', function() {
                expect(function() { cache.add({blah: 'test'}); }).to.throw('not string key');
                expect(function() { cache.add([1, 2]); }).to.throw('not string key');
                expect(function() { cache.add(_.noop); }).to.throw('not string key');
            });
       });

        describe('should work', function() {
            it('with a brand new key', function() {
                var key = getKey(), val = chance.natural();

                return cache.add(key, val)
                            .then(function() {
                                return cache.get(key);
                            })
                            .then(function(v) {
                                v.should.equal(val);
                            });
            });

            it('should behave properly when add over existing key', function() {
                var key = getKey(), val = chance.natural();

                return cache.add(key, val)
                            .then(function() {
                                return cache.add(key, val);
                            })
                            .catch(function(err) {
                                expect(err.toString()).to.contain('it already exists');
                            });
            });
        });
    });

    after(function() {
        var cache = new Client();

        // Clean up all of the keys we created
        return cache.deleteMulti(keys);
    });

});
