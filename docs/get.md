# Get

### Basic case

Now that you've used `set()` to set some values, let's use `get()` to retrieve them!

```javascript
client
    .get('firstName')
    .then(function(firstName) {
        console.log('Successfully got the key firstName: ', firstName);
        // Would print: "Successfully got the key firstName: Victor"
    });
```

or with async/await

```javascript
const firstName = await client.get('firstName')
console.log(`Successfully got the key firstName: ${ firstName }`)
// Would print: "Successfully got the key firstName: Victor"
```

Get takes 1 argument, the key, and it returns a Promise. It has an optional
second argument which is an object to specify options for this retrieval.

The key must be a string. The value you get back from the resolution
of this promise will have the same type it had when you `set` it.

For example, if you had previously `set()` with an object, you'll get back an
object.

```javascript
client
    .get('user')
    .then(function(user) {
        console.log('Successfully got the object: ', user);
        // Would print: "Successfully got the object: { firstName: 'Victor', lastName: 'Quinn' }"
    });
```

or with async/await

```javascript
const user = await client.get('user')
console.log('Successfully got the object: ', user);
// Would print: "Successfully got the object: { firstName: 'Victor', lastName: 'Quinn' }"
```

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.get('firstName', function(firstName) {
    console.log('Successfully got the value for key firstName: ', firstName);
});
```

### No value

When there is no value set for a key, Memcache Plus will simply return `null` as
the value.

For example:

```javascript
client
    .get('keyThatDoesNotExist')
    .then(function(value) {
        console.log('The value is: ', value);
        // Would print: "The value is: null"
    });
```

with async/await

```javascript
const value = await client.get('keyThatDoesNotExist')
console.log('The value is: ', value);
// Would print: "The value is: null"
```

### Compression

If an item was written with `set()` with compression enabled, you can specify
that fact when retrieving the object or it will not be decompressed by Memcache
Plus:

```javascript
client.get('firstName', { compressed: true })
    .then(function(firstName) {
        console.log('Successfully got the key firstName as compressed data: ', firstName);
        // Would print: "Successfully got the key firstName as compressed data: Victor"
    });
```

with async/await

```javascript
const firstName = await client.get('firstName', { compressed: true })
console.log('Successfully got the key firstName as compressed data and automatically uncompressed it: ', firstName);
// Would print: "Successfully got the key firstName as compressed data: Victor"
```

However, compressed objects set by newer versions of Memcache Plus will
automatically be decompressed without having to provide this flag.

By enabling this option, every value will be compressed with Node's
[zlib](https://nodejs.org/api/zlib.html) library after being retrieved.

Notes:

1. Enabling compression will reduce the size of the objects stored but it will
also add a non-negligent performance hit to each `set()` and `get()` since
compression is rather CPU intensive so use it judiciously!
