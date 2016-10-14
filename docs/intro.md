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
running application and your Memcache server.

Then, right away you can start using its methods:

```javascript
client
    .get('my-key')
    .then(function(value) {
        console.log('my-key has a value of ', value);
    });
```
