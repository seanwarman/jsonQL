# jsonQL
A small framework for building MYSQL queries with json objects.

It allows you to build your database query in the frontend like...

```js
{
  database: 'bms_campaigns',
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
`bookingName`,
`bookingsKey`,
`assignedUserKey`

FROM
bms_campaigns.bookings

WHERE
`createdUserKey` = 'cafc9f20-deae-11e9-be90-7deb20e96c9e'
```

So all we need is one **GET** endpoint that accepts **jsonQL** objects and we can use it replace
hundreds of potential endpoints.

### Create

If you want to make a **CREATE** just add some `data`:

```js
{
  database: 'bms_campaigns',
  table: 'bookings',
  data: {
    bookingName: 'Cool Booking!',
    bookingsKey: '12345',
    tmpKey: '123'
  }
},
```

### Update

Then for an **UPDATE** just add a `where`:

```js
{
  database: 'bms_campaigns',
  table: 'bookings',
  data: {
    bookingName: 'Mega Cool Booking!',
  },
  where: [
    {
      name: 'bookingsKey',
      is: '12345'
    }
  ]
},
```

### Where

You'll notice `where` is an array. That's so we can add extra ones for multiple ANDs.

```js
{
    database: 'bms_campaigns',
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
        name: 'bookingsKey',
        is: 'd03563a1-2e2c-11ea-b3ec-a1387ad1100d',
      }
    ]
  },
```

### Joins

JOINs can be added as part of the `columns` array...

```js
{
  database: 'bms_booking',
  table: 'bookings',
  columns: [
    {name: 'bookingName'},
    {name: 'created'},
    {name: 'bookingsKey'},
    {name: 'assignedUserKey'},
    {join: {
      database: 'Biggly',
      table: 'partners',
      columns: [
        {name: 'partnerName'}
      ],
      where: {parent: 'createdPartnerKey', is: 'partnerKey'},
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

If you've had any experience with [https://serverless.com/](serverless) lambda functions
you'll know that if you want more than about 20 endpoints in a project, things start to
get pretty funky (the bad kind).

Lots of devs have turned to [https://graphql.org/](GraphQL) for this very reason but for
my particular needs I thought GraphQL was a bit overkill.

**jsonQL** is light, safe and fast because all it does is build mysql query strings. This means 
it can easily be added to your project without disrupting whatever structure you've already built.

## Node usage

```js
// Use any mysql package from npm...
const mysql = require('mysql2/promise');
const connection = require('../libs/connection');

// Import your schema, more on this later.
const schema = require('../schema');

// Import jsonQL...
const JsonQL = require('../libs/jsonQL');


async function example() {

  // Connect to mysql...
  const con = await mysql.createConnection(connection);

  // Make a new instance of jsonQL using your chosen schema.
  const jsonQL = new JsonQL(schema);

  // We're doing a get here so use selectQL and pass it your jsonQL object...
  let queryObj = jsonQL.selectQL({
    database: 'bms_campaigns',
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

## Schema

You'll need a schema for your database, this will prevent anyone from injecting dangerous
SQL into your db without **jsonQL** stamping it out.

The structure of your schema object should look like:

```js
{
  databaseName: {
    tableName1: {
      column1: {
        type: 'string'
      },
      column2: {
        type: 'string'
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

Any columns not included in the schema will be automatically omitted from your queries. Any
databases or tables not included will break **jsonQL** if you then try to query them.