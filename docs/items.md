# Items

### Basic case

Gets items statistics.

```javascript
client
    .items()
    .then(function(items) {
        /* Returns an (empty) array that looks like this:
         [{
            slab_id: 1,
            data: {
                number: 2,
                age: 4918,
                evicted: 0,
                evicted_nonzero: 0,
                evicted_time: 0,
                outofmemory: 0,
                tailrepairs: 0,
                reclaimed: 0,
                expired_unfetched: 0,
                evicted_unfetched: 0,
                crawler_reclaimed: 0,
                lrutail_reflocked: 0
            },
            server: 'localhost:11211'
         }]         
        */
    });
```

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.items(function(items) {
    ...
});
```
