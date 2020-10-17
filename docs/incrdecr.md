# Incr/Decr

## Incr
`incr` can be used to increment the value of a given key in a single command.

```javascript
// Increment myCountValue by 1, returns a promise
client.incr('myCountValue')
```

with async/await

```javascript
// Increment myCountValue by 1, wait for it
await client.incr('myCountValue')
console.log('myCountValue increased by 1')
```

## Decr
`decr` can be used to decrement the value of a given key in a single command.

```javascript
// Decrement myCountValue by 1, returns a promise
client.decr('myCountValue')
```

with async/await

```javascript
// Decrement myCountValue by 1, wait for it
await client.decr('myCountValue')
console.log('myCountValue decreased by 1')
```

## Notes

In cases where you just want to increase or decrease the value of an item, using
incr/decr makes a lot more sense than performing a `get` then increasing or
decreasing its value then performing a `set`.

It is also helpful to eliminate race conditions since it is an atomic operation.
For example, if your Memcached server is shared by multiple hosts and multiple
want to increment a key, you could have a scenario where both hosts perform the
`get`, then increment then both perform the `set`. In this case where you'd
expect the value to be incremented by 2, it may instead be incremented only by 1
because the two fought and neither won.

Using increment eliminates those kinds of race conditions since the whole thing
is performed in a single Memcached command.

#### Defaults to 1

In the simplest case, if you provide no increment amount, Memcache Plus will
increment or decrement the supplied key by `1`. It will then resolve the Promise
with the updated value of that item.

```javascript
client
    .incr('myCountValue')
    .then(function(val) {
        // The new value will be exactly 1 more than the old one
        console.log('the new value of myCountValue is', val)
    })
```

with async/await

```javascript
const val = await client.incr('myCountValue')
// The new value will be exactly 1 more than the old one
console.log('the new value of myCountValue is', val)
```

#### Can specify incr/decr amount

However, you can also specify an increment/decrement amount. For instance, to
decrement a number by 5:

```javascript
client
    .decr('myCountValue', 5)
    .then(function(val) {
        // The new value will be exactly 5 less than the old one
        console.log('the new value of myCountValue is', val);
    });
```

with async/await

```javascript
const val = await client.decr('myCountValue', 5)
// The new value will be exactly 5 less than the old one
console.log('the new value of myCountValue is', val)
```

#### Only works on numeric types

Since it makes no sense to increment something like `"banana"` or
`{ "foo": "bar" }`, `incr` and `decr` can only be used to increment numeric
types.
