# Miscellaneous

## Version

You can retrieve the version of Memcached currently running on the server by
running `version()`.

```javascript
// As a Promise
cache.version().then(function(v) {
    console.log('This server is running version %s of Memcached', v);
});

// With ESNext async/await
let version = await cache.version();

// With standard callback
cache.version(function(err, v) {
    console.log('This server is running version %s of Memcached', v);
});

```

Note, for simplicity, this will just query a single server and retrieve the
version, so if you are connected to multiple servers it will still only return
a single result (aka one version running on one of the servers).

We may introduce `versions()` at some point which would query all servers and
return the version running on each server but that seemed a bit complicated for
the most likely use case of getting the version for a single server.
