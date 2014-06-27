# Memcache Plus

Memcache Plus - Better memcache for node

## What makes it "Plus"?

* Native support for Promises or Callbacks
* Elasticache auto discovery baked in
* Actively developed and used
* Focus on cleanliness and simplicity
* Support for binaries (planned) which the other memcache libraries for Node don't support
* Cached retrieve - simply pass a function for retrieving a value and a key and memcache-plus will do the whole "check key, if it exists return it, if not run the function to retrieve it, set the value, and return it" for you
* Command buffering - start issuing commands right away, *memcache-plus* will automatically wait until connected then flush that buffer

Proudly developed in Washington, D.C. by:

[![SocialRadar](https://raw.github.com/socialradar/batch-request/master/social-radar-black-orange.png)](http://socialradar.com)
