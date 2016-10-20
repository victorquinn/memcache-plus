# Flush

### Basic case

Flush causes all items to expire. It does not free up or flush memory.

```javascript
client
    .flush()
    .then(function() {
        console.log('Successfully cleared all data');
    });
```

### Delayed flush

You can add a delay in seconds before the flush is executed.

```javascript
client
    .flush(1)
    .then(function() {
        console.log('Successfully cleared all data');
    });
```

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.flush(function() {
    console.log('Successfully cleared all data');
});
```
