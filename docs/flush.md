# Flush

### Basic case

Flush removes all stored values.

```javascript
client
    .flush()
    .then(function() {
        console.log('Successfully cleared all data');
    });
```

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.flush('firstName', function() {
    console.log('Successfully cleared all data');
});
```
