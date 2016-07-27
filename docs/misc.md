# Miscellaneous

### Why are only string keys and values allowed?

#### Background

This is a debate we had when writing this module as we wanted to be able to set
anything (number, null, boolean, string, object, array) and get it back as the
same thing.

*tl;dr We made the decision to only allow string values as it simplifies things
and maintains maximum interoperability with other libraries/systems.*

The problem is that, as values are written to Memcache, they are written as just
byte buffers so they lose any of their "type" in the process. So if I write a
number like `34.29` to Memcache, it will come out as a Buffer containing `34.29`
but does not have a type. So the library can't distinguish whether what
originally was set was the number `34.29` or the string `"34.29"`.

We made the design decision to enforce the constraint that all things stored are
strings and leave it to the user to deal with the conversions. This way at least
it is consistent.

#### Other libraries

Some other Memcache modules will allow users to `set()` numbers and then return
strings back with `get()`. So you could do (in pseudocode since obviously the
following wouldn't work without promises or callbacks):

```javascript
// Set a number
client.set('myNumber', 12.54);

// Get back a string
var myNumber = client.get('myNumber')

console.log(typeof myNumber)
// Would print "string", wtf?
```

As you can see this is rather confusing! We think it makes more sense to just
enforce the constraint that all values must be strings, then there is never
confusion.

#### A possible solution

We have considered taking each value and storing it as a more complex object so
it could be deserialized later.

For instance, instead of writing just the raw value to Memcache, we'd do
something like the following:

```javascript
// Trying to set a number
client.set('myNumber', 12.54)

// Would actually do the following under the hood:
client.set('myNumber', JSON.stringify({ type: 'number', value: 12.54 });

// This way, when it's extracted from Memcache, we can reassemble it with the
// correct type
var myNumber = client.get('myNumber');

console.log(typeof myNumber);
// Would print "number" because this library would get back the stringified
// object which was set in Memcache and be able to re-constitute the value to
// the correct type.

// This would also enable things like the following to set and get appropriately:
client.set('myUser', { firstName: 'Victor', lastName: 'Quinn' });
client.set('myUser', ['Harley', 'Kawasaki', 'Triumph', 'BMW']);
client.set('myUser', 5);
client.set('myUser', true);
client.set('myUser', null);
```

However, it could break interoperability with other systems as they would expect
to retrieve just a value and instead get back a complex object.

So we'd like to get this enabled for this module at some point in the future as
an option (or more likely as a companion module dependent on Memcache Plus) but
for now we only allow string values.
