# Items

`cachedump(<slabsId>, [<noOfResults>])`

### Basic case

Gets cache data for a given slabs id.

```javascript
client
    .cachedump(1)
    .then(function(items) {
        /* Returns an (empty) array that looks like this:
        [{ 
            key: 'test', 
            bytes: 4, 
            expiry_time_secs: 1476901980 
        } ]     
        */
    });
```

### Limit items returned

```javascript
client
    .cachedump(1, 1)
    .then(function(items) {
        /* Returns an (empty) array that looks like this:
        [{ 
            key: 'test', 
            bytes: 4, 
            expiry_time_secs: 1476901980 
        } ]     
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
