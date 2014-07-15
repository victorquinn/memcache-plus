# Memcache Plus

Memcache Plus - Better memcache for node

[![Build Status](https://travis-ci.org/socialradar/memcache-plus.svg?branch=master)](https://travis-ci.org/socialradar/memcache-plus)

[![NPM](https://nodei.co/npm/memcache-plus.png)](https://nodei.co/npm/memcache-plus?downloads=true)

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
