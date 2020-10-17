# Get Multiple

Let's say you want to get 5 keys at once. The following is rather onerous:

```javascript
Promise
    .all([
        client.get('hydrogen'), client.get('helium'),
        client.get('oxygen'), client.get('carbon'), client.get('nitrogen')
    ])
    .then(function(values) {
        console.log('Successfully retrieved these 5 keys');
    });
```

The above would also fire off 5 separate calls from your client to your Memcached
server.

Thankfully Memcache Plus provides a convenience method called `getMulti()` that
will combine these into a single call:

```javascript
client
    .getMulti(['hydrogen', 'helium', 'oxygen', 'carbon', 'nitrogen'])
    .then(function(values) {
        console.log('Successfully retrieved these 5 keys');
    });
```

or with async/await

```javascript
const values = await client.getMulti(['hydrogen', 'helium', 'oxygen', 'carbon', 'nitrogen'])
console.log('Successfully retrieved these 5 keys');

// You can also use destructuring if you'd like to get each of these as their
// own variable
const [hydrogen, lithium, sodium] = await client.get(['hydrogen', 'lithium', 'sodium'])
console.log(`${ hydrogen } and ${ lithium } and ${ sodium }`
```
