# Elasticache

Amazon provides Memcache (and Redis) as a hosted webservice they call
[Elasticache](https://aws.amazon.com/elasticache/).

Memcache Plus has some special enhancements which make connecting to Elasticache
a bit more easy.

### Auto Discovery

Amazon provides something called [Auto Discovery](https://aws.amazon.com/elasticache/faqs/#memcached-auto-discovery)
which is an enhancement to Memcache and basically allows you to specify a single
url for a cluster (rather than specifying each host url separately) and that single
url can be queried for information on the other nodes in your cluster.

Memcache Plus can handle the auto discovery for you!

Simply specify a single host when you create your client and enable the
`autodiscover` option:

```javascript
var MemcachePlus = require('memcache-plus');

var client = new MemcachePlus({
    hosts: ['victor-di6cba.cfg.use1.cache.amazonaws.com'],
    autodiscover: true
});
```

And that's it! Memcache Plus will use that discovery url to reach out to Amazon,
retrieve information on all other nodes in the cluster, then automatically
connect to all of them.
