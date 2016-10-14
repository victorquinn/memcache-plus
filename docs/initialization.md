# Initialization

When you initialize Memcache Plus, you provide the address of the server(s) you
are connecting to along with a series of options which can alter the behavior of
the library.

Below is a description of the options and some details about initialization.

## Kicking it off
```javascript
var MemcachePlus = require('memcache-plus');

var client = new MemcachePlus();
```

Instantiating the client will automatically establish a connection between your
running application and your Memcache server. Make sure you do not have a
firewall rule blocking port 11211 on your Memcache server.

If you do not specify a host, Memcache Plus will default to connecting to
`localhost:11211`.

## Specifying a Host

#### As a string

You can optionally provide a host as a single string argument.

```javascript
var MemcachePlus = require('memcache-plus');

// Will initiate a connection to 'my-memcache-server.com' on port 11211
var client = new MemcachePlus('my-memcache-server.com');
```

If you do not specify a port with the host, Memcache Plus will attempt to
connect to port 11211, the default port.

You can also specify a port if for some reason your Memcached is running on
some other port:

```javascript
var MemcachePlus = require('memcache-plus');

// Will initiate a connection to 'my-memcache-server.com' on port 12345
var client = new MemcachePlus('my-memcache-server.com:12345');
```

#### As an array
You can optionally provide an array of hosts to connect to multiple.

More details on connecting to multiple hosts below, but the following will make
this happen:

```javascript
var MemcachePlus = require('memcache-plus');

// Will initiate connections to both 'my-memcache-server1.com' and
// 'my-memcache-server2.com' on port 11211
var client = new MemcachePlus([
    'my-memcache-server1.com',
    'my-memcache-server2.com'
]);
```

You can also specify ports if your Memcached servers are running on a
non-default port:

```javascript
var MemcachePlus = require('memcache-plus');

// Will initiate connections to both 'my-memcache-server1.com' and
// 'my-memcache-server2.com' on port 12345
var client = new MemcachePlus([
    'my-memcache-server1.com:12345',
    'my-memcache-server2.com:12345'
]);
```


#### As options
Below we'll lay out the available options, but one of them is a key of `hosts`
and you can provide an array of hosts to which you'd like to connect.

```javascript
var MemcachePlus = require('memcache-plus');

// Will initiate connections to both 'my-memcache-server1.com' and
// 'my-memcache-server2.com' on port 11211
var client = new MemcachePlus({
    hosts: [ 'my-memcache-server1.com', 'my-memcache-server2.com' ]
});
```

This is useful in case you also want to specify other options.

## Connecting to multiple hosts

Memcache Plus can automatically connect to multiple hosts.

In doing so, it will use a hash ring to handle even distribution of keys among
multiple servers. It is easy, simply specify multiple hosts when connecting and
Memcache Plus will automatically handle the rest!

```javascript
var MemcachePlus = require('memcache-plus');

var client = new MemcachePlus({
    // Specify 3 hosts
    hosts: ['10.0.0.1', '10.0.0.2', '10.0.0.3']
});
```
If you've using Amazon's Elasticache for your Memcache hosting, you can also
enable [Auto Discovery](elasticache.md) and Memcache Plus will automatically
connect to your discovery url, find all of the hosts in your cluster, and
establish connections to all of them.



## Command Queueing

Memcache Plus will automatically queue and then execute (in order) any commands
you make before a connection can be established. This means that you can
instantiate the client and immediately start issuing commands and they will
automatically execute as soon as a connection is established to your Memcache
server(s).

This makes it a lot easier to just get going with Memcache Plus than with many
other Memcache clients for Node since they either require you to write code to
ensure a connection is established before executing commands or they issue
failures when commands fail due to lack of connection.

Memcache Plus maintains an internal command queue which it will use until a
connection is established. This same command queue is utilized if there is a
momentary drop in the connection, so your code doesn't have to worry about a
momentary blip like this.

## Options
When instantiating Memcache Plus, you can optionally provide the client with an
object containing any of the following options (default values in parentheses):

| Key | Default Value | Description |
|---|---|--- |
|`autodiscover` | `false` | Whether or not to use [Elasticache Auto Discovery](http://docs.aws.amazon.com/AmazonElastiCache/latest/UserGuide/AutoDiscovery.html). [More details on this feature](elasticache.md). |
|`backoffLimit`|10000| Memcache Plus uses an exponential backoff. This is the maximum limit in milliseconds it will wait before declaring a connection dead|
|`bufferBeforeError`|1000|Memcache Plus will buffer and not reject or return errors until it hits this limit. Set to 0 to basically disable the buffer and throw an error on any single failed request.|
|`disabled` | `false` | Whether or not Memcache is disabled. If it is disabled, all of the commands will simply return `null` as if the key does not exist |
|`hosts` | `null` | The list of hosts to connect to. Can be a string for a single host or an array for multiple hosts. If none provided, defaults to `localhost` |
|`maxValueSize`|1048576| The max value that can be stored, in bytes. This is configurable on the Memcached server but this library will help prevent you from storing objects over the default size in Memcache. If you have increased this limit on your server, you'll need to increase it here as well before setting anything over the default limit. |
|`onNetError`| `function onNetError(err) { console.error(err); }`| Function to call in the event of a network error. |
|`queue`| `true` | Whether or not to queue commands issued before a connection is established or if the connection is dropped momentarily. |
|`netTimeout`|500| Number of milliseconds to wait before assuming there is a network timeout. |
|`reconnect` | `true` | Whether or not to automatically reconnect if the connection is lost. Memcache Plus includes an exponential backoff to prevent it from spamming a server that is offline |

Example:

```javascript
var MemcachePlus = require('memcache-plus');

var client = new MemcachePlus({
    // Specify 2 hosts
    hosts: ['10.0.0.1', '10.0.0.2'],
    // Decrease the netTimeout from the 500ms default to 200ms
    netTimeout: 200
});
```
