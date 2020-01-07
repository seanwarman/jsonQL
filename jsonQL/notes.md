Here's how I think the joins should work:

```js
jsonQuery = {
  database: 'bms_booking',
  table: 'bookings',
  columns: [
    {
      name: 'bookingName'
    },
    {
      name: 'bookingsKey'
    },
    {
      join: {
        database: 'Biggly', // << if no 'database' param then assume this database. DONE
        table: 'partners', // << if there's more than one join between the same table then we shouldnt need 'as' jsonQL should just deal with it. DONE
        columns: [
          {name: 'partnerName', as: 'createdPartnerName'}
        ],
        where: {parent: 'createdPartnerKey', is: 'partnerKey'}, // << instead of stupid 'on'. DONE
      },
    }
  ],
}
```

This could probably work by creating three strings...

- the SELECT string  < DONE
- the FROM string < DONE
- the JOIN string  < DONE

Everything will be done by looping over jsonQuery.columns.
If the item just has a 'name' then we add the SELECT
If it has a 'join' then dig down and build for the JOIN then when we get to the final 'as' we add that to the SELECT.
Then we just concat them together for the full query at the end.

jsonForm could work the same way as they do now except we could also add the ability to put them in the join objects
as well. << TODO

Rather than doing complicated 'on' and my made-up 'to', we just do 'where', which can have either 
`{name: 'bookingName', is: '"Cool name"'}` << TODO mysql allows for putting column values in here so we should as well.
...if we were doing a normal where on the top level or...
`{parent: 'createdPartnerKey', is: 'partnerKey'}`
...if we want to match the parent's createdPartnerKey value with this table's partnerKey.

This way each 'join' is just another nested jsonQuery object:

```js
jsonQuery = {
  database
  table
  where: {
    name/parent
    is/isnot
  }
  jsonForm: {
    name
    as
  }
  columns: [
    {
      name 
      as 
      join: jsonQuery
    }
  ]
}
```

Not only should the "where" accept an "is" and "isnot" but it should also accept OR and AND. << TODO

```js
where: [
  {
    name
    is/isnot
  },
  ...AND
  {
    name
    is/isnot
  },
  ...AND
  {
    or: [
      {
        name
        is/isnot
      },
      ...OR
      {
        name
        is/isnot
      }
    ]
  },
]
```

The next step is making a CREATE jsonQL query.
This should work like:

```js
jsonQuery: {
  database: 'bms_campaigns',
  table: 'bookings',
  data: {
    bookingName: 'Cool Bookings!'
  }
},
```

We also want a 'having' key so that we can look up records by there 'join' column names. TODO