# Append

Will append data to the supplied key if and only if it already exists.

In other words, add the value you supply to the end of the value currently
residing in the supplied key.

### Basic case

```javascript
// Assuming you have a key called `milkshake` and it currently has the value
//   `vanilla`

client
    .append('milkshake', ' malt')
    .then(function() {
        // now milkshake has a value of `vanilla malt`
        console.log('Successfully appended to the key milkshake');
    });
```

### Error if key doesn't yet exist

If a key does not already exist and you try to use the `append` command,
Memcached will return an error which Memcache Plus will throw.

```javascript
// If 'milkshake' does not already exist
client
    .replace('milkshake', ' malt')
    .then(function() {
        // This will not get hit because `append` will throw on error
        console.log('Successfully replaced the key milkshake');
    })
    .catch(function(err) {
        // Will print: 'Cannot "replace" for key "milkshake" because it does not exist'
        console.error(err);
    });
```

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.append('milkshake', ' malt', function(err) {
    console.log('Successfully appended to the key milkshake');
});
```

And if you try to append a key that does not already exist:

```javascript
// If 'milkshake' does not already exist
client.append('milkshake', ' malt', function(err) {
    // Will print: 'Cannot "append" to key "milkshake" because it does not exist'
    console.error(err);
});
```

# Prepend

Will prepend data to the supplied key if and only if it already exists

### Basic case

```javascript
// Assuming you have a key called `gauge` and it currently has the value
//   `meter`

client
    .prepend('meter', 'thermo')
    .then(function() {
        // now milkshake has a value of `thermometer`
        console.log('Successfully prepended to the key meter');
    });
```

### Error if key doesn't yet exist

If a key does not already exist and you try to use the `prepend` command,
Memcached will return an error which Memcache Plus will throw.

```javascript
// If 'gauge' does not already exist
client
    .replace('gauge', 'thermo')
    .then(function() {
        // This will not get hit because `prepend` will throw on error
        console.log('Successfully replaced the key gauge');
    })
    .catch(function(err) {
        // Will print: 'Cannot "replace" for key "gauge" because it does not exist'
        console.error(err);
    });
```

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.prepend('gauge', 'thermo', function(err) {
    console.log('Successfully prepended to the key gauge');
});
```

And if you try to prepend a key that does not already exist:

```javascript
// If 'gauge' does not already exist
client.prepend('gauge', 'thermo', function(err) {
    // Will print: 'Cannot "prepend" to key "gauge" because it does not exist'
    console.error(err);
});
```
