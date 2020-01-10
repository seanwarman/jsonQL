# Features TODO

A `count` option.

```js
{
  count: {
    database: 'Biggly',
    table: 'uploads',
    where: [{name: 'bookingsKey', is: 'bookingsKey'}]
  },
  as: 'uploadsCount'
}
```

Make the `join` `where` into an array like the top level `where`.

```js
where: [{name: 'bookingsKey', is: '123'}]
```

The `jsonExtract` needs to accept and `index` with and without a
`target`.

```js
{
  name: 'jsonForm',
  as: 'bookingMonth',
  jsonExtract: {index: 2, target: 'value'}
}
```

Also just an `index` to return the whole object at that index.

```js
{
  name: 'jsonForm',
  as: 'bookingMonth',
  jsonExtract: {index: 2}
}
```


