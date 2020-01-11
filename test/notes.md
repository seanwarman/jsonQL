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

We also want a 'having' key so that we can look up records by their 'join' column names. TODO

We want to select json fields like the following:

```js
  {
    db: 'bms_booking',
    table: 'bookings',
    columns: [
      {
        name: 'jsonForm', 
        as: 'bookingMonth',
        jsonExtract: {search: 'Booking Month', target: 'value'}
      },
    ],
  }
```
translated:
```sql
  SELECT
    JSON_EXTRACT(
      JSON_EXTRACT(
          bms_booking.bookings.jsonForm, concat('$[', substr(JSON_SEARCH(bms_booking.bookings.jsonForm, 'all', 'Booking Month'), 4, 1), ']')
        ), '$.value'
    ) AS bookingMonth
  FROM bms_booking.bookings
  LIMIT 0, 5;
```
^^ DONE

We also want to be able to put an `index` param in here:

```js
{
  name: 'jsonForm', 
  as: 'bookingMonth',
  jsonExtract: {index: 2, target: 'value'}
},
```

translated: 
```sql
JSON_EXTRACT(
  JSON_EXTRACT(bms_booking.bookings.jsonForm, '$[2]'), '$.value'
) AS bookingMonth
```

or:

```js
{
  name: 'jsonForm', 
  as: 'bookingMonth',
  jsonExtract: {index: 2}
},
```
translated: 
```sql
  JSON_EXTRACT(bms_booking.bookings.jsonForm, '$[2]') AS bookingMonth
```

```js
const JsonQL = {
  db: String,
  table: String,
  columns: [
    {
      name: String, 
      string: String, 
      as: String, 
      format: {
        fn: String,
        args: [
          {
            name: String,
            string: String,
            format: Object
          }
        ]
      },
      join: {
        db: String,
        table: String,
        where: Array,
        columns: Array,
      }
    }
  ],
  where: [
    {
      name: String,
      is: String,
      isnot: String,
      or: [
        {
          name: String,
          is: String,
          isnot: String,
          or: Array,
        }
      ],
    }
  ]
}
```

There's a few types of objects here that I want to denote.

## JoinObject                           ## WhereObject
                                        
```js                                 
const JoinObject = {                    const WhereObject = {
  db: String,                             name: String,
  table: String,                          is: String,
  where: [WhereObject],                   isnot: String,
  columns: [ColumnObject]                 or: [WhereObject]
}                                       }
```                                  

## ColumnObject                         ## FormatObject
                                        
```js                                   
const ColumnObject = {                  const FormatObject = {
  name: String,                           fn: String,
  string: String,                         args: [ColumnObject]
  as: String,                           }
  format: FormatObject,                
  join: JoinObject
}
```

`WhereObject`s are self contained, which makes them easy, and so can be ignored for now.

`ColumnObject`s are the only objects that don't contain arrays.

`JoinObject`s are most like the top level objects because they have a `db` and `table`
field. That's probably where we should start.


Maybe the sections of the query string could start as objects that get concatinated at
the end. So this query:

```sql
SELECT
bms_booking.bookings.bookingName,
bms_booking.bookings.created,
bms_booking.bookings.bookingsKey,
bms_booking.bookings.assignedUserKey,
Biggly.partners.partnerName

FROM
bms_booking.bookings

LEFT JOIN Biggly.partners ON bms_booking.bookings.partnerKey = Biggly.partners.createdPartnerKey
```
Will look like:
```js
JsonQL = {
  select: [
    {db: String, table: String, name: String as: String},
    {db: String, table: String, name: String as: String}
  ],
  from: {db: String, table: String},
  join: [
    {onDb: String, onTable: String, onName: String, db: String, table: String, name: String}
  ]
}
```





