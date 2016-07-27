# Delete

### Basic case

If you've got a key you want to delete, simply call the `delete()` method and
supply a key:

```javascript
client
    .delete('firstName')
    .then(function() {
        console.log('Successfully deleted the value associated with key firstName');
    });
```

### Delete Multi

However, if you need to delete multiple keys at once, calling `delete()` over
and over again can be rather inefficient. For this reason, Memcache Plus
supports `deleteMulti()` for which you provide an array of keys and that single
command will delete all of them at once from Memcache:

```javascript
client
    .deleteMulti(['firstName', 'middleName', 'lastName'])
    .then(function() {
        console.log('Successfully deleted all three values with the supplied keys');
    });
```

