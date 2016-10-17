# Add

### Basic case

Add sets a new value for a key if and only if that key doesn't already exist

```javascript
client
    .add('firstName', 'Victor')
    .then(function() {
        console.log('Successfully added the key firstName');
    });
```

### Error if key already exists

If a key already exists and you try to use the `add` command, Memcached will
return an error which Memcache Plus will throw.

```javascript
// If 'firstName' already exists
client
    .add('firstName', 'Victor')
    .then(function() {
        // This will not get hit because `add` will throw on error
        console.log('Successfully added the key firstName');
    })
    .catch(function(err) {
        // Will print: 'Cannot "add" for key "firstName" because it already exists'
        console.error(err);
    });
```

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.add('firstName', 'Victor, function(err) {
    console.log('Successfully added the key firstName');
});
```

And if you try to add to a key that already exists:

```javascript
// If 'firstName' already exists
client.add('firstName', 'Victor', function(err) {
    // Will print: 'Cannot "add" for key "firstName" because it already exists'
    console.error(err);
});
```
