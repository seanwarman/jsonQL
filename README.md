# jsonQL
A small framework for building MYSQL queries with json objects.

It allows you to build your database query in the frontend like...

```js
{
  db: 'bms_campaigns',
  table: 'bookings',
  columns: [
    {name: 'bookingName'},
    {name: 'bookingsKey'},
    {name: 'assignedUserKey'},
  ],
  where: [
    {
      name: 'createdUserKey',
      is: 'cafc9f20-deae-11e9-be90-7deb20e96c9e',
    },
  ]
}
```

Which get's parsed as the following once it reaches MYSQL...

```sql
SELECT
bms_campaigns.bookings.bookingName,
bms_campaigns.bookings.bookingsKey,
bms_campaigns.bookings.assignedUserKey

FROM
bms_campaigns.bookings

WHERE
bms_campaigns.bookings.createdUserKey = 'cafc9f20-deae-11e9-be90-7deb20e96c9e'
```

So all we need is one **GET** endpoint that accepts **jsonQL** objects and we can use it to replace
hundreds of potential endpoints.

**Note**: to return all the columns (eg `SELECT *`) just omit the columns param.

### Where

You'll notice `where` is an array. That's so we can add extra ones for multiple ANDs.
For an OR we can use the `or` key and put an array inside it...

```js
{
    db: 'bms_campaigns',
    table: 'bookings',
    columns: [
      {name: 'bookingName'},
      {name: 'bookingsKey'},
      {name: 'assignedUserKey'},
    ],
    where: [
      {
        name: 'createdUserKey',
        is: 'cafc9f20-deae-11e9-be90-7deb20e96c9e',
      },
      // ...AND
      {
        or: [
          {
            name: 'bookingsKey',
            is: '123',
          },
          // ...OR
          {
            name: 'bookingsKey',
            is: '321'
          },
          // ...OR
          {
            name: 'bookingsKey',
            is: 'd03563a1-2e2c-11ea-b3ec-a1387ad1100d',
          }
        ]
      }
    ]
  },
```

### Joins

JOINs can be added as part of the `columns` array...

```js
{
  db: 'bms_booking',
  table: 'bookings',
  columns: [
    {name: 'bookingName'},
    {name: 'created'},
    {name: 'bookingsKey'},
    {name: 'assignedUserKey'},
    {join: {
      db: 'Biggly',
      table: 'partners',
      columns: [
        {name: 'partnerName'}
      ],
      where: [{name: 'createdPartnerKey', is: 'partnerKey'}],
    }},
  ],
}
```

Which translates to...

```sql
SELECT
bms_booking.bookings.bookingName,
bms_booking.bookings.created,
bms_booking.bookings.bookingsKey,
bms_booking.bookings.assignedUserKey,
Biggly.partners.partnerName

FROM
bms_booking.bookings

LEFT JOIN Biggly.partners ON Biggly.partners.createdPartnerKey = bms_booking.bookings.partnerKey
```

If you've had any experience with [serverless](https://serverless.com/) lambda functions
you'll know that if you want more than about 20 endpoints in a project, things start to
get pretty funky (the bad kind).

Lots of devs have turned to [GraphQL](https://graphql.org/) for this very reason but for
my particular needs I thought GraphQL was a bit overkill.

**JsonQL** is light and fast because all it does is build mysql query strings. This means 
it can easily be added to your project without disrupting whatever structure you've already built.
It also works with a schema so it's safe as well.

## Node usage

```js
// Use any mysql package from npm...
const mysql = require('mysql2/promise');
const connection = require('../libs/connection');

// Import your schema, more on this later.
const schema = require('../schema');

// Import jsonQL...
const JsonQL = require('@seanwarman/jsonql');


async function example() {

  // Connect to mysql...
  const con = await mysql.createConnection(connection);

  // Make a new JsonQL instance using your chosen schema.
  const jsonQL = new JsonQL(schema);

  // We're doing a get here so use selectQL and pass it your jsonQL object...
  let queryObj = jsonQL.selectQL({
    db: 'bms_campaigns',
    table: 'bookings',
    columns: [
      {name: 'bookingName'},
      {name: 'bookingsKey'},
      {name: 'assignedUserKey'},
    ],
    where: [
      {
        name: 'createdUserKey',
        is: 'cafc9f20-deae-11e9-be90-7deb20e96c9e',
      },
    ]
  });

  // Check the status of the returned object.
  if (queryObj.status === 'error') {
    console.log(queryObj);
    return;
  }

  let result;

  // jsonQL will put your mysql string onto a param called query...
  try {
    result = await con.query(queryObj.query)
  } catch (err) {
    console.log(err)
  }
  console.log('result :', result[0]);
  await con.end()

}
```

### Create

If you want to make a **CREATE** just add some `data`:

```js
let data = {
  bookingName: 'Cool Booking!',
  bookingsKey: '12345',
  tmpKey: '123'
}

jsonQL.createQL({
  db: 'bms_campaigns',
  table: 'bookings',
}, data);
```

### Update

Then for an **UPDATE** just add a `where`:

```js
let data = {
  bookingName: 'Really Cool Booking!'
}

jsonQL.updateQL({
  db: 'bms_campaigns',
  table: 'bookings',
  where: [
    {
      name: 'bookingsKey',
      is: '12345'
    }
  ]
}, data);
```

## Schema

You'll need a schema for your database, this will prevent anyone from injecting dangerous
SQL into your db without **jsonQL** stamping it out.

The structure of your schema object should look like:

```js
module.exports = {
  databaseName: {
    tableName1: {
      column1: {
        primaryKey: Function,
        type: 'string'
      },
      column2: {
        type: 'string',
        hidden: true
      }
    },
    tableName2: {
      column1: {
        type: 'number'
      }
    }
  }
  databaseName2: {
    // etc...
  }
}
```

Any columns not included in the schema will be automatically omitted from your queries.
Any columns with the `hidden` flag will only be retrieved if you specifically specify them in the `columns` array.
Return a string or number to add an automatic `primaryKey` to any field (see below **Primary Key** for details).
Any databases or tables not included will break **jsonQL** if you then try to query them.

## Fn (Functions)

To use slq functions you can use the fn String.

```js
columns: [
  {
    fn: 'REPLACE',
    args: [{name: 'bookingName'}, {string: '%20'}, {string: ' '}],
    as: 'bookingNameFormatted'
  },
],
```

This will also work with REPLACE and many other slq functions.
You can also put an `fn` into a `join`.

```js
{
  db: 'bms_booking',
  table: 'bookings',
  columns: [
    {join: {
      db: 'Biggly',
      table: 'users',
      columns: [
        {
          fn: 'CONCAT',
          args: [{name: 'firstName'}, {string: ' '}, {name: 'lastName'}],
          as: 'fullName'
        }
      ],
      where: {name: 'createdUserKey', is: 'userKey'}
    }},
  ]
}
```

You can even nest any number of `fn`s inside one-another.

```js
columns: [
  {
    fn: 'REPLACE',
    args: [
      {
        fn: 'REPLACE',
        args: [
          {name: 'bookingName'},
          {string: '%2F'},
          {string: '/'},
        ]
      }, 
      {string: '%20'}, 
      {string: ' '}
    ],
    as: 'fullName'
  }
],
```

Using `name` in a column or args object will target a column name from your db. If
you want to put an actual string in then use the `string` param instead.

## JsonExtract (Deprecated - \*use Json Query Strings instead)
To do a `JSON_EXTRACT` function with a `JSON_SEARCH` on a json column you can search for the object with your value
using `jsonExtract` in the `columns` array:

```js
{
  db: 'bms_booking',
  table: 'bookings',
  columns: [
    {
      name: 'jsonForm', 
      as: 'bookingMonth',
      jsonExtract: {search: 'Booking Month', target: 'value'}
    }
  ]
}
```

This finds an object in an array of objects by searching for the string 'Booking Month' then 
returns whatever is assigned to the key called `value`.

So if a `jsonForm` column in the db looks like:

```js
[
  {label: 'Booking Month', type: 'input', value: 'December'},
  {label: 'Keyword',       type: 'input', value: 'Christmas'}
]
```
The 'Booking Month' `search` will return the first object in this array and
the `target` of `value` will return 'December'.

## Count

The `count` param in the `ColumnsObject` can be used to count associated records
from another table by any matching column value.

```js
{
  db: 'bms_booking',
  table: 'bookings',
  columns: [
    {name: 'bookingName'},
    {name: 'colorLabel'},
    {name: 'bookingDivKey'},
    {
      count: {
        db: 'Biggly',
        table: 'uploads',
        where: [{name: 'bookingsKey', is: 'bookingsKey'}]
      },
      as: 'uploadsCount'
    },
  ],
  having: [{name: 'uploadsCount', is: '2'}],
}
```

Because `uploadsCount` doesn't really exist in our database the `where` object
won't work as our lookup condition so instead we can use `having`, which is able
to look up alias column names (or anything we name under an `as` value).

# JsonQL API

**JsonQL** interacts with three different types of object.

### JoinObject                           

The `JoinObject` is the top level object, you always start here. 
When at the top level `db` and `table` select the main table you want to retrieve from but
the same format object can also be used inside a `ColumnObject` to create table joins.    

```js
const JoinObject = {
  db: String,
  table: String,
  columns: [ColumnObject],
  where: [WhereObject],
  having: [WhereObject],
  limit: [Number, Number],
  orderBy: {name: String, desc: Boolean},
}
```

### ColumnObject                         

The `ColumnObject` goes inside the `columns` param of a `JoinObject`. But as you can see
it can also be an item in it's own `args` array and you can also add a `JoinObject` to `join`.  

This works because JsonQL is recursive. You can put a `ColumnObject` inside another
`ColumnObject` and keep going down until you break your computer.

```js
const ColumnObject = {
  name: String/JQString,
  string: String,
  number: Number,
  join: JoinObject,
  count: JoinObject,
  fn: String,
  args: [ColumnObject],
  jsonExtract: {search: String, target: String}, //< deprecated
  as: String
}
```

### WhereObject
              
```js
const WhereObject = {
  name: String,
  is: String,
  isnot: String,
  or: WhereObject/[WhereObject]
}
```

# JQString (Json Query Strings)

For tables with json type fields you can use a json query string to select specific values in an array.

```js
{
  db: 'bms_campaigns',
  table: 'bookings',
  columns: [
    {name: '$jsonStatus[0]', as: 'firstStatus'},
    {name: '$jsonForm[0].label', as: 'formLabel'}
  ]
}
```

All json query strings must start with a `$`.
You can also search the json column by any string value within using a string (starting with '?') rather than a number.

```js
{
  db: 'bms_campaigns',
  table: 'bookings',
  columns: [
    {name: '$jsonForm[?Booking Month].value', as: 'bookingMonth'}
  ]
}
```

Json query strings are also compatible with the `data` sent to an `updateQL` function.

```js
updateQL({
  db: 'bms_campaigns',
  table: 'bookings',
  where: [{name: 'bookingsKey', is: '123'}]
}, {
  "$jsonForm[?Booking Month].value": 'Jan'
});
```

# Primary Key

You can add an auto primary key to your schema that will allow you to have a key generated by the schema when a new record is created.

```js
// Import any key generator from an npm package of your choice...
const uuid = require('uuid');
module.exports = {
  databaseName: {
    tableName1: {
      column1: {
        // Add primaryKey to your column and return the value in a function call.
        primaryKey: () => {
          return uuid.v1();
        },
        type: 'string'
      },
      column2: {
        type: 'string'
      },
      column3: {
        type: 'string'
      }
    }
  }
}
```
