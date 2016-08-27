# Disconnect

### Basic case

In order to disconnect and close any and all open connections, simply call the
`disconnect()` method on the client:

```javascript
client
    .disconnect()
    .then(function() {
        console.log('Successfully disconnected from all clients!');
    });
```

### Disconnect from a specific host or hosts

However, if you would like to disconnect from a single host or list of hosts
but keep connections to the rest, you can do so by calling disconnect and
specifying either a single connection (as a string) or multiple (as an array)
and Memcache Plus will disconnect from only those you specify

```javascript
// Single as a string
client
    .disconnect('myserver.com:11211')
    .then(function() {
        console.log('Successfully disconnected from only myserver.com:11211');
    });

// Multiple as an array
client
    .disconnect(['myserver.com:11211', 'myotherserver.com:11211'])
    .then(function() {
        console.log('Successfully disconnected from myserver.com:11211 AND myotherserver.com:11211');
    });
```

Note, if you specify a full disconnect `disconnect()` or specify all currently
open connections, the `reconnect` option will be automatically set to `false`.
Otherwise you'll close the connection and Memcache Plus will automatically try
to reconnect which of course you don't want!
