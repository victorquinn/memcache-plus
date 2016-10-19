# Replace

### Basic case

Replace sets a new value for a key if and only if that key already exists

```javascript
client
    .replace('firstName', 'Victor')
    .then(function() {
        console.log('Successfully replaced the value for the key firstName');
    });
```

### Error if key does not already exist

If a key does not already exist and you try to use the `replace` command,
Memcached will return an error which Memcache Plus will throw.

```javascript
// If 'firstName' does not already exist
client
    .replace('firstName', 'Victor')
    .then(function() {
        // This will not get hit because `replace` will throw on error
        console.log('Successfully replaced the key firstName');
    })
    .catch(function(err) {
        // Will print: 'Cannot "replace" for key "firstName" because it does not exist'
        console.error(err);
    });
```

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.replace('firstName', 'Victor, function(err) {
    console.log('Successfully replaced the key firstName');
});
```

And if you try to replace a key that does not already exist:

```javascript
// If 'firstName' does not already exist
client.replace('firstName', 'Victor', function(err) {
    // Will print: 'Cannot "replace" for key "firstName" because it does not exist'
    console.error(err);
});
```
