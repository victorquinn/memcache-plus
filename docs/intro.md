# Installation

Memcache Plus is available on npm:

[![NPM](https://nodei.co/npm/memcache-plus.png?downloads=true)](https://nodei.co/npm/memcache-plus?downloads=true)

# Usage

After installing, it's easy to start using Memcache Plus:

```javascript
var MemcachePlus = require('memcache-plus');

var client = new MemcachePlus();
```

Instantiating the client will automatically establish a connection between your
running application and your Memcache server. Make sure you do not have a
firewall rule blocking port 11211 on your Memcache server.

Then, right away you can start using its methods:

```javascript
client
    .get('my-key')
    .then(function(value) {
        console.log('my-key has a value of ', value);
    });
```

# Options
When instantiating Memcache Plus, you can optionally provide the client with an
object containing any of the following options (default values in parentheses):

| Key | Default Value | Description |
|---|---|--- |
|`autodiscover` | `false` | Whether or not to use [Elasticache Auto Discovery](http://docs.aws.amazon.com/AmazonElastiCache/latest/UserGuide/AutoDiscovery.html) |
|`backoffLimit`|10000| Memcache Plus uses an exponential backoff. This is the maximum limit in milliseconds it will wait before declaring a connection dead|
|`disabled` | `false` | Whether or not Memcache is disabled. If it is disabled, all of the commands will simply return `null` as if the key does not exist |
|`hosts` | `null` | The list of hosts to connect to. Can be a string for a single host or an array for multiple hosts. If none provided, defaults to `localhost` |
|`maxValueSize`|1048576| The max value that can be stored, in bytes. This is configurable in Memcache but this library will help prevent you from storing objects over the configured siize in Memcache |
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
