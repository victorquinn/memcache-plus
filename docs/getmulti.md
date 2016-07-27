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

Thankfully Memcache Plus provides a convenience method called `getMulti()` that
will combine these into a single call:

```javascript
client
    .getMulti(['hydrogen', 'helium', 'oxygen', 'carbon', 'nitrogen'])
    .then(function(values) {
        console.log('Successfully retrieved these 5 keys');
    });
```

