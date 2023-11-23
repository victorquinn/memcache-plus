require('chai').should();
var _ = require('lodash'),
    chance = require('chance').Chance(),
    expect = require('chai').expect,
    misc = require('../lib/misc'),
    Promise = require('bluebird');

var Client = require('../lib/client');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
            var cache = new Client({
                hosts: ['localhost:11211', '127.0.0.1:11211'],
                onNetError: function() {}
            });
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
         *  To run this test, start up a local memcached server with TLS enabled
         *  on port 11212 with a trusted certificate
         */
        it('with TLS enabled', async function() {
            var cache_client = new Client({
                hosts: ['127.0.0.1:11212'],
                tls: {
                    checkServerIdentity: () => {
                        return undefined;
                    }
                }
            });
            var val = chance.word();
            await cache_client.set('key', val);
            let v = await cache_client.get('key');
            val.should.equal(v);
        });

        /**
         * Only comment this out when we have an Elasticache autodiscovery cluster to test against.
         *   Ideally one day this can be mocked, but for now just selectively enabling it
        it('supports autodiscovery', function() {
            var cache = new Client({ hosts: ['test-memcache.di6cba.cfg.use1.cache.amazonaws.com'], autodiscover: true });
            var val = chance.word();

            return cache.set('test', val)
                .then(function() {
                    return cache.get('test');
                })
                .then(function(v) {
                    val.should.equal(v);
                });
        });
        */

        it('throws on autodiscovery failure', function() {
            var cache = new Client({
                hosts: ['badserver:11211'],
                autodiscover: true,
                onNetError: function() {}
            });
            var val = chance.word();

            return cache.set('test', val)
                .then(function() { throw new Error('should not get here'); })
                .catch(function(err) {
                    err.should.be.ok;
                    err.should.be.an.instanceof(Error);
                    err.message.should.match(/Autodiscovery failed/);
                })
                .then(function() {
                    // try again to ensure that subsequent ops also fail
                    return cache.set('test', val);
                })
                .then(function() { throw new Error('should not get here'); })
                .catch(function(err) {
                    err.should.be.ok;
                    err.should.be.an.instanceof(Error);
                    err.message.should.match(/Autodiscovery failed/);
                });
        });
    });

    describe('set and get', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('set');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.set(); }).to.throw('AssertionError: Cannot "set" without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.set(chance.string({length: 251}), chance.word()); }).to.throw('less than 250 bytes');
            });

            it('with a non-string key', function() {
                expect(function() { cache.set({blah: 'test'}, 'val'); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.set([1, 2], 'val'); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.set(_.noop, 'val'); }).to.throw('AssertionError: Key needs to be of type "string"');
            });
        });

        it('should work', async function() {
            var key = getKey(), val = chance.word();

            await cache.set(key, val);
            let v = await cache.get(key);
            val.should.equal(v);
        });

        it.skip('works with values with newlines', async function() {
            var key = getKey(), val = 'value\nwith newline';

            await cache.set(key, val);
            let v = await cache.get(key);
            val.should.equal(v);
        });
    
        it('works with very large values', async function() {
            var key = getKey(), val = chance.word({ length: 1000000 });

            await cache.set(key, val);
            let v = await cache.get(key);
            val.should.equal(v);
        });

        describe('compression', function() {
            it('does not throw an error if compression specified', function() {
                var key = getKey(), val = chance.word({ length: 1000 });
                return cache.set(key, val, { compressed: true });
            });

            it('works of its own accord', async function() {
                var val = chance.word({ length: 1000 });

                let v = await misc.compress(Buffer.from(val));
                let d = await misc.decompress(v);
                d.toString().should.equal(val);
            });

            it('get works with compression', async function() {
                var key = getKey(), val = chance.word({ length: 1000 });

                await cache.set(key, val, { compressed: true });
                let v = await cache.get(key, { compressed: true });
                val.should.equal(v);
            });

            it('get works with compression without explicit get compressed flag', async function() {
                var key = getKey(), val = chance.word({ length: 1000 });

                await cache.set(key, val, { compressed: true });
                let v = await cache.get(key);
                val.should.equal(v);
            });

            it('getMulti works with compression', async function() {
                var key1 = getKey(), key2 = getKey(),
                    val1 = chance.word(), val2 = chance.word();

                await Promise.all([cache.set(key1, val1, { compressed: true }), cache.set(key2, val2, { compressed: true })]);
                let vals = await cache.getMulti([key1, key2], { compressed: true });
                vals.should.be.an('object');
                vals[key1].should.equal(val1);
                vals[key2].should.equal(val2);
            });

            it('get works with a callback', function(done) {
                var key = getKey(), val = chance.word({ length: 1000 });

                cache.set(key, val, { compressed: true }, function() {
                    cache.get(key, { compressed: true }, function(err, v) {
                      val.should.equal(v);
                      done(err);
                    });
                });
            });

            it('get for key that should be compressed but is not returns null', async function() {
                var key = getKey(), val = chance.word({ length: 1000 });

                await cache.set(key, val);
                let v = await cache.get(key, { compressed: true });
                expect(v).to.be.null;
            });
        });

        describe('with namespace', function () {
            it('should work', function () {
                var key = getKey(), ns = getKey(), val = chance.word();

                return cache.set(key, val, { namespace: ns })
                    .then(function () {
                        return cache.get(key, { namespace: ns });
                    })
                    .then(function (v) {
                        val.should.equal(v);
                    });
            });
        });

        it('does not throw an error when setting a value number', function() {
            var key = chance.guid(), val = chance.natural();

            expect(function() { cache.set(key, val); }).to.not.throw();
        });

        it('get for val set as number returns number', async function() {
            var key = getKey(), val = chance.integer();

            await cache.set(key, val);
            let v = await cache.get(key);
            expect(v).to.be.a('number');
            v.should.equal(val);
        });

        it('get for val set as floating number returns number', async function() {
            var key = getKey(), val = chance.floating();

            await cache.set(key, val);
            let v = await cache.get(key);
            expect(v).to.be.a.number;
            v.should.equal(val);
        });

        it('get for val set as object returns object', async function() {
            var key = getKey(), val = { num: chance.integer() };

            await cache.set(key, val);
            let v = await cache.get(key);
            expect(v).to.be.an.object;
            (v.num).should.equal(val.num);
        });

        it('get for val set as Buffer returns Buffer', async function() {
            var key = getKey(), val = Buffer.from('blah blah test');

            await cache.set(key, val);
            let v = await cache.get(key);
            expect(v).to.be.an.instanceof(Buffer);
            (v.toString()).should.equal(val.toString());
        });

        it('get for val set as null returns null', async function() {
            var key = getKey(), val = null;

            await cache.set(key, val);
            let v = await cache.get(key);
            expect(v).to.be.null;
        });

        it('get for val set as array returns array', async function() {
            var key = getKey(), val = [ chance.integer(), chance.integer() ];

            await cache.set(key, val);
            let v = await cache.get(key);
            expect(v).to.be.an.array;
            expect(v).to.deep.equal(val);
        });

        it('throws error with enormous values (over memcache limit)', async function() {
            // Limit is 1048577, 1 byte more throws error. We'll go up a few just to be safe
            var key = getKey(), val = chance.word({ length: 1048590 });
            try {
                await cache.set(key, val);
                throw new Error('this code should never get hit');
            } catch (err) {
                err.should.be.ok;
                err.should.be.an.instanceof(Error);
                err.should.deep.equal(new Error('Value too large to set in memcache'));
            }
        });

        it('works fine with special characters', async function() {
            var key = getKey(),
                val = chance.string({ pool: 'ÀÈÌÒÙàèìòÁÉÍÓÚáéíóúÂÊÎÔÛâêîôûÃÑÕãñõÄËÏÖÜŸäëïöüÿæ☃', length: 1000 });

            await cache.set(key, val);
            let v = await cache.get(key);
            val.should.equal(v);
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
            it('with Promise', async function() {
                let v = await cache.get(chance.guid());
                expect(v).to.be.null;
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

            it('works', async function() {
                var key1 = getKey(), key2 = getKey(),
                    val1 = chance.word(), val2 = chance.word();

                await Promise.all([cache.set(key1, val1), cache.set(key2, val2)]);
                let vals = await cache.getMulti([key1, key2]);
                vals.should.be.an('object');
                vals[key1].should.equal(val1);
                vals[key2].should.equal(val2);
            });

            it('get with array of keys delegates to getMulti', async function() {
                var key1 = getKey(), key2 = getKey(),
                    val1 = chance.word(), val2 = chance.word();

                await Promise.all([cache.set(key1, val1), cache.set(key2, val2)]);
                let vals = await cache.get([key1, key2]);
                vals.should.be.an('object');
                vals[key1].should.equal(val1);
                vals[key2].should.equal(val2);
            });

            it('works if some values not found', async function() {
                var key1 = getKey(), key2 = getKey(),
                    val = chance.word();

                await cache.set(key1, val);
                let vals = await cache.getMulti([key1, key2]);
                vals.should.be.an('object');
                vals[key1].should.equal(val);
                expect(vals[key2]).to.equal(null);
            });

            it('works if all values not found', async function() {
                var key = getKey(), key2 = getKey(), key3 = getKey(),
                    val = chance.word();

                await cache.set(key, val);
                let vals = await cache.getMulti([key2, key3]);
                vals.should.be.an('object');
                _.size(vals).should.equal(2);
                expect(vals[key2]).to.equal(null);
                expect(vals[key3]).to.equal(null);
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
            it('expires', async function() {
                var key = getKey(), val = chance.word();

                await cache.set(key, val, 1);
                let v = await cache.get(key);
                val.should.equal(v);
                await sleep(1001);
                v = await cache.get(key);
                expect(v).to.be.null;
            });
        });
    });

    describe('cas and gets', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('gets');
        });

        it('should return a cas value', async function() {
            var key = getKey(), val = chance.word();

            await cache.set(key, val);
            let [v, cas] = await cache.gets(key);
            val.should.equal(v);
            expect(cas).to.exist;
        });

        it('should store new value when given a matching cas', async function() {
            var key = getKey(), val = chance.word(), updatedVal = chance.word();

            await cache.set(key, val);
            let [v, cas] = await cache.gets(key);
            expect(v).to.not.be.null;
            let success = await cache.cas(key, updatedVal, cas);
            expect(success).to.be.true;
            let v2 = await cache.get(key);
            expect(v2).to.equal(updatedVal);
        });

        it('should not store the new value when given an invalid cas value', async function() {
            var key = getKey(), val = chance.word(), updatedVal = chance.word();

            await cache.set(key, val);
            let [v, cas] = await cache.gets(key);
            expect(v).to.not.be.null;
            var invalidCas;
            do {
                invalidCas = chance.string({pool: '0123456789', length: 15});
            } while (invalidCas === cas);

            let success = await cache.cas(key, updatedVal, invalidCas);
            expect(success).to.be.false;
        });

        it('should not store a value when given an invalid key value', async function() {
            var key = getKey(), invalidKey = getKey(),
                val = chance.word(), updatedVal = chance.word();

            await cache.set(key, val);
            let [v, cas] = await cache.gets(key);
            expect(v).to.not.be.null;
            let success = await cache.cas(invalidKey, updatedVal, cas);
            expect(success).to.be.false;
        });
    });

    // @todo should have cleanup jobs to delete keys we set in memcache
    describe('delete', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('delete');
            cache.delete.should.be.a('function');
        });

        it('works', async function() {
            var key = getKey();

            await cache.set(key, 'myvalue');
            await cache.delete(key);
            let v = await cache.get(key);
            expect(v).to.be.null;
        });

        it('does not blow up if deleting key that does not exist', function() {
            var key = chance.guid();
            return cache.delete(key);
        });
    });

    describe('deleteMulti', function() {
        var cache;
        beforeEach(function() {
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

    // @todo these are placeholders for now until I can figure out a good way
    // to adequeately test these.
    describe('Client buffer', function() {
        it('works');
        it('can be flushed');
    });

    describe('Connection buffer', function() {
        it('works');
        it('can be flushed');
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
        it('can be disabled', async function() {
            var client = new Client({ disabled: true });
            var key = getKey(), val = chance.word();

            await client.set(key, val);
            let v = await client.get(key);
            expect(v).to.be.null;
        });
    });

    describe('incr', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('incr');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.incr(); }).to.throw('AssertionError: Cannot "incr" without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.incr(chance.string({length: 251})); }).to.throw('less than 250 bytes');
            });

            it('with a non-string key', function() {
                expect(function() { cache.incr({blah: 'test'}); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.incr([1, 2]); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.incr(_.noop); }).to.throw('AssertionError: Key needs to be of type "string"');
            });

            it('with a val that is not a number', function() {
                expect(function() { cache.incr(chance.string(), chance.word()); }).to.throw('AssertionError: Cannot incr in memcache with a non number value');
            });
        });

        describe('should work', function() {
            it('without an increment value', async function() {
                var key = getKey(), val = chance.natural();

                await cache.set(key, val);
                let v = await cache.incr(key);
                v.should.equal(val + 1);
            });

            it('with an increment value', async function() {
                var key = getKey(), val = chance.natural({ max: 20000000}), incr = chance.natural({ max: 1000 });

                await cache.set(key, val);
                let v = await cache.incr(key, incr);
                v.should.equal(val + incr);
            });
        });
    });

    describe('decr', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('decr');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.decr(); }).to.throw('AssertionError: Cannot "decr" without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.decr(chance.string({length: 251})); }).to.throw('less than 250 bytes');
            });

            it('with a non-string key', function() {
                expect(function() { cache.decr({blah: 'test'}); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.decr([1, 2]); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.decr(_.noop); }).to.throw('AssertionError: Key needs to be of type "string"');
            });

            it('with a val that is not a number', function() {
                expect(function() { cache.decr(chance.string(), chance.word()); }).to.throw('AssertionError: Cannot decr in memcache with a non number value');
            });
        });

        describe('should work', function() {
            it('without a decrement value', async function() {
                var key = getKey(), val = chance.natural();

                await cache.set(key, val);
                let v = await cache.decr(key);
                v.should.equal(val - 1);
            });

            it('with a decrement value', async function() {
                var key = getKey(), val = chance.natural({ max: 20000000}), decr = chance.natural({ max: 1000 });

                await cache.set(key, val);
                let v = await cache.decr(key, decr);
                v.should.equal(val - decr);
            });
        });
    });

    describe('flush', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('flush');
        });

        describe('should work', function() {
            it('removes all data', async function () {
                var key = getKey(), val = chance.natural();

                await cache.set(key, val);
                let v = await cache.get(key);
                expect(v).to.equal(val);
                await cache.flush();
                let v2 = await cache.get(key);
                expect(v2).to.equal(null);
            });

            it('removes all data after a specified number of seconds', async function() {
                var key = getKey(), val = chance.natural();

                await cache.set(key, val);
                let v = await cache.get(key);
                expect(v).to.equal(val);

                await cache.flush(1);

                await sleep(1001);
                let v3 = await cache.get(key);
                expect(v3).to.be.null;
            });
        });
    });

    describe('add', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('add');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.add(); }).to.throw('AssertionError: Cannot "add" without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.add(chance.string({length: 251})); }).to.throw('less than 250 bytes');
            });

            it('with a non-string key', function() {
                expect(function() { cache.add({blah: 'test'}); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.add([1, 2]); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.add(_.noop); }).to.throw('AssertionError: Key needs to be of type "string"');
            });
        });

        describe('should work', function() {
            it('with a brand new key', async function() {
                var key = getKey(), val = chance.natural();

                await cache.add(key, val);
                let v = await cache.get(key);
                v.should.equal(val);
            });

            it('should behave properly when add over existing key', async function() {
                var key = getKey(), val = chance.natural();

                await cache.add(key, val);
                try {
                    await cache.add(key, val);
                } catch (err) {
                    expect(err.toString()).to.contain('it already exists');                  
                }
            });
        });
    });

    describe('replace', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('replace');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.replace(); }).to.throw('AssertionError: Cannot "replace" without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.replace(chance.string({length: 251})); }).to.throw('less than 250 bytes');
            });

            it('with a non-string key', function() {
                expect(function() { cache.replace({blah: 'test'}); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.replace([1, 2]); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.replace(_.noop); }).to.throw('AssertionError: Key needs to be of type "string"');
            });
        });

        describe('should work', function() {
            it('as normal', async function() {
                var key = getKey(), val = chance.natural(), val2 = chance.natural();

                await cache.set(key, val);
                await cache.replace(key, val2);
                let v = await cache.get(key);
                v.should.equal(val2);
            });

            it('should behave properly when replace over non-existent key', async function() {
                var key = getKey(), val = chance.natural();

                try {
                    await cache.replace(key, val);
                } catch (err) {
                    expect(err.toString()).to.contain('does not exist');
                }
            });
        });
    });

    describe('append', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('append');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.append(); }).to.throw('AssertionError: Cannot "append" without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.append(chance.string({length: 251})); }).to.throw('less than 250 bytes');
            });

            it('with a non-string key', function() {
                expect(function() { cache.append({blah: 'test'}); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.append([1, 2]); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.append(_.noop); }).to.throw('AssertionError: Key needs to be of type "string"');
            });
        });

        describe('should work', function() {
            it('as normal', function() {
                var key = getKey(), val = chance.string(), val2 = chance.string();

                return cache.set(key, val)
                            .then(function() {
                                return cache.append(key, val2);
                            })
                            .then(function() {
                                return cache.get(key);
                            })
                            .then(function(v) {
                                v.should.equal(val + val2);
                            });
            });

            it('should behave properly when append over non-existent key', function() {
                var key = getKey(), val = chance.natural();

                return cache.append(key, val)
                            .catch(function(err) {
                                expect(err.toString()).to.contain('does not exist');
                            });
            });
        });
    });

    describe('prepend', function() {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('prepend');
        });

        describe('should throw an error if called', function() {
            it('without a key', function() {
                expect(function() { cache.prepend(); }).to.throw('AssertionError: Cannot "prepend" without key!');
            });

            it('with a key that is too long', function() {
                expect(function() { cache.prepend(chance.string({length: 251})); }).to.throw('less than 250 bytes');
            });

            it('with a non-string key', function() {
                expect(function() { cache.prepend({blah: 'test'}); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.prepend([1, 2]); }).to.throw('AssertionError: Key needs to be of type "string"');
                expect(function() { cache.prepend(_.noop); }).to.throw('AssertionError: Key needs to be of type "string"');
            });
        });

        describe('should work', function() {
            it('as normal', function() {
                var key = getKey(), val = chance.string(), val2 = chance.string();

                return cache.set(key, val)
                            .then(function() {
                                return cache.prepend(key, val2);
                            })
                            .then(function() {
                                return cache.get(key);
                            })
                            .then(function(v) {
                                v.should.equal(val2 + val);
                            });
            });

            it('should behave properly when prepend over non-existent key', function() {
                var key = getKey(), val = chance.natural();

                return cache.prepend(key, val)
                            .catch(function(err) {
                                expect(err.toString()).to.contain('does not exist');
                            });
            });
        });
    });

    describe('items', function () {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('items');
        });

        describe('should work', function() {
            it('gets slab stats', function (done) {
                cache.set('test', 'test').then(function() {
                    return cache.items();
                }).then(function (items) {
                    expect(items.length).to.be.above(0);
                    expect(items[0].slab_id).to.exist;
                    expect(items[0].server).to.exist;
                    expect(items[0].data.number).to.exist;
                    expect(items[0].data.age).to.exist;
                    done();
                });
            });
        });
    });

    describe('cachedump', function () {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('items');
        });

        // Comment this test out because `stats cachedump` has been threatened to be removed
        // for years and does not appear to be present on the memcached in Github Actions
        // See https://groups.google.com/g/memcached/c/1-T8I-RVGKM?pli=1

        // describe('should work', function() {
        //     it('gets cache metadata', function (done) {
        //         var key = getKey();

        //         // guarantee that we will at least have one result
        //         cache.set(key, 'test').then(function() {
        //             return cache.items();
        //         }).then(function (items) {
        //             return cache.cachedump(items[0].slab_id);
        //         }).then(function (data) {
        //             expect(data[0].key).to.be.defined;
        //             done();
        //         });
        //     });

        //     it('gets cache metadata with limit', function (done) {
        //         var key = getKey();

        //         cache.set(key, 'test').then(function() {
        //             return cache.items();
        //         }).then(function (items) {
        //             return cache.cachedump(items[0].slab_id, 1);
        //         }).then(function (data) {
        //             expect(data.length).to.equal(1);
        //             done();
        //         });
        //     });
        // });
    });


    describe('namespace', function () {
        var cache;
        var savedPrefix;
        var namespace = getKey();
        beforeEach(function () {
            cache = new Client();
        });


        describe('getNamespacePrefix', function () {
            it('exists', function () {
                return cache.should.have.property('getNamespacePrefix');
            });

            it('when namespace is not already set', function () {
                return cache.getNamespacePrefix(namespace).then(function(prefix) {
                    expect(prefix).to.be.a('number');
                    savedPrefix = prefix;
                });
            });

            it('when namespace is already set', function () {
                return cache.getNamespacePrefix(namespace).then(function(prefix) {
                    expect(prefix).to.equal(savedPrefix);
                });
            });
        });

        describe('invalidateNamespace', function () {
            it('exists', function () {
                return cache.should.have.property('invalidateNamespace');
            });

            it('should invalidate previously stored keys', function () {
                var key = getKey(), ns = getKey(), val = chance.word();

                return cache.set(key, val, { namespace: ns })
                    .then(function () {
                        return cache.get(key, { namespace: ns });
                    })
                    .then(function (v) {
                        val.should.equal(v);
                    })
                    .then(function() {
                        return cache.invalidateNamespace(ns);
                    })
                    .then(function () {
                        return cache.get(key, { namespace: ns });
                    })
                    .then(function (v) {
                        expect(v).to.be.null;
                    });
            });
        });
    });

    describe('version', function () {
        var cache;
        beforeEach(function() {
            cache = new Client();
        });

        it('exists', function() {
            cache.should.have.property('version');
        });

        describe('should work', function() {
            it('gets version', function () {
                return cache.version().then(function(v) {
                    expect(v).to.be.a.string;
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
