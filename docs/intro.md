# Getting Started

## Installation

Memcache Plus is available on npm:

[![NPM](https://nodei.co/npm/memcache-plus.png?downloads=true)](https://nodei.co/npm/memcache-plus?downloads=true)

## Usage

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
|`autodiscover` | `false` | Whether or not to use [Elasticache Auto Discovery](http://docs.aws.amazon.com/AmazonElastiCache/latest/UserGuide/AutoDiscovery.html) |
|`backoffLimit`|10000| Memcache Plus uses an exponential backoff. This is the maximum limit in milliseconds it will wait before declaring a connection dead|
|`bufferBeforeError`|1000|Memcache Plus will buffer and not reject or return errors until it hits this limit. Set to 0 to basically disable the buffer and throw an error on any single failed request.|
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
## Connecting to multiple hosts

Memcache Plus can automatically connect to multiple hosts.

In doing so, it will use a hash ring to handle even distribution of keys among
multiple servers. It is easy, simply specify multiple hostswhen connecting and
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
