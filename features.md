# Features TODO

We need a `concat` option in the `columns` objects.
Possibly it would be very useful to have a `format` option for the returned value.

```js
{
  format: {
    fn: 'REPLACE',
    args: ['bookingName', '\'"\'', '\'\'']
  },
  as: 'bookingNameNoQuotes'
},
{
  format: {
    fn: 'CONCAT',
    args: ['firstName', '\' \'', 'lastName']
  },
  as: 'fullName'
}
```
**Note**: We have to put in the backslash quotes here (\') to denote a string value in the SQL.

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


