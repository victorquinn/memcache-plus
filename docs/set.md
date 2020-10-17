# Set

### Basic case

After you've created a client (which will automatically establish a connection),
you can start issuing commands! The most basic is to set a value:

```javascript
client
    .set('firstName', 'Victor')
    .then(function() {
        console.log('Successfully set the key firstName');
    });
```

or with async/await

```javascript
await client.set('firstName', 'Victor')
console.log('Successfully set the key firstName')
```

### Arguments

`set()` requires 2 arguments and could have up to 4.

The first is always the key and must be a string.  
The second is always the value and must be a string.  
The third is optional and could be either: (1) a ttl for this key (2) an options object or (3) a callback  
The fourth is only present if there is a third argument for ttl or options and a callback is provided.  

### Key must be a string

Non-string keys are not allowed and Memcache Plus will throw an error if you
try to provide a non-string key.

```javascript
client
    .set({ foo: 'bar' }, myVal)
    .then(function() {
        // This will never happen because an error will be thrown
    })
    .catch(function(err) {
        // This will get hit!
        console.error('Oops we have an error', err);
    });
```

or with async/await

```javascript
try {
    await client.set({ foo: 'bar' }, myVal)
    // This will never happen because an error will be thrown
} catch (err) {
    // This will get hit!
    console.error('Oops we have an error', err);
}
```

### Value can be of any type

The value can be of any type (numeric, string, object, array, null, etc.)

Memcache Plus will handle converting the value (if necessary) before sending to
the Memcached server and converting it back upon retrieval.

For instance, with Memcache Plus you can go ahead and set an object

```javascript
var myVal = {
    firstName: 'Victor',
    lastName: 'Quinn'
};

client
    .set('user', myVal)
    .then(function() {
        console.log('Successfully set the object');
    });
```

or with async/await

```javascript
var myVal = {
    firstName: 'Victor',
    lastName: 'Quinn',
}

await client.set('user', myVal)
console.log('Successfully set the object')
```

Then when you get it out it'll be an object:

```javascript
client
    .get('user')
    .then(function(user) {
        // The user is a JS object:
        // { firstName: 'Victor', lastName: 'Quinn' }
        console.log('Successfully got the object', user);
    });
```
with async/await

```javascript
let user = await client.get('user')
// The user is a JS object:
// { firstName: 'Victor', lastName: 'Quinn' }
console.log('Successfully got the object', user)
```

Same goes for numbers, arrays, etc. Memcache Plus will always return the exact
type you put into it.

### TTL

A key/value pair can be specified with an optional ttl which will specify how
long (in seconds) that object persists before it is automatically purged from the cache.

For example, to set a value that will stay around in the cache for only 10 seconds:

```javascript
client.set('firstName', 'Victor', 10)
```

If you perform a `get()` within 10 seconds for `firstName`, you'll get back
`"Victor"` but after 10 seconds, you will get `null`.

### Callbacks

Memcache Plus will always return a [Promise](https://www.promisejs.org), but it
can also take a traditional callback for any of its methods so it can work just
like most of the other Memcache modules out there. For example:

```javascript
client.set('firstName', 'Victor', function(err) {
    console.log('Successfully set the key firstName')
})
```

### Compression

Optionally you can request that compression be enabled for a given item:

```javascript
client.set('firstName', 'Victor', { compressed: true })
    .then(function() {
        console.log('Successfully set the key firstName as compressed data');
    });
```

or with async/await

```javascript
await client.set('firstName', 'Victor', { compressed: true })
console.log('Successfully set the key firstName as compressed data')
```

By enabling this option, every key will be compressed with Node's
[zlib](https://nodejs.org/api/zlib.html) library prior to being stored.

This is helpful in the event that you are attempting to store data (such as a
stringified object) which is too large for the standard Memcache value limit
size. It is also helpful in situations where the memory allocated to your
Memcache instance is limited, such as on a Raspberry Pi or some other embedded
hardware.

Note the maximum allowed value for a memcache item is set by the Memcached
server and not something that can be tuned on the client alone. The default
[is 1MB](https://docs.oracle.com/cd/E17952_01/mysql-5.6-en/ha-memcached-faq.html#faq-memcached-max-object-size)
but it can be increased to up to 5MB

For example, if your Memcache server is set with a limit of 1MB for a value and
you attempt to store a 1.2MB object, the set will fail. However, enabling
compression will cause the value to be compressed with zlib before it is stored
so the size may be reduced significantly and save successfully.

Notes:

1. If you store a value compressed with `set()` you have to `get()` it and
specify that it was compressed. There is no automatic inspection of values to
determine whether they were set with compression and decompress automatically
(as this would incur significant performance penalty)
1. Enabling compression will reduce the size of the objects stored but it will
also add a non-negligent performance hit to each `set()` and `get()` so use it
judiciously!
1. The maximum key size is 250 bytes. This is a Memcache limitation and this
library will throw an error if a key larger than that is provided.

### Errors

Memcache Plus will throw errors for any unexpected or broken behavior so you
know quickly if something is wrong with your application. These could be things
like: trying to `set()` an item without a key, trying to `set()` an item that
is too large, trying to `set()` with a key that is too long, and many more.
