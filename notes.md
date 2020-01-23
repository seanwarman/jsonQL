```js
const TableObject = {
  name: String,
  where: [String/[String]],
  columns: [TableObject],
  as: String
}

const query = {
  name: 'bms_booking.booking',
  where: [
    'bookingsKey = "123"',
    'created = "2019"'
  ],
  columns: [
    {name: 'bookingName'},
    {name: 'created'},
    {
      name: 'Biggly.users', 
      where: [
        'bms_booking.booking.createdUserKey = userKey'
      ],
      columns: [
        {name: 'accessLevel'},
        {name: 'concat=>firstName lastName', as: 'fullName'}
      ]
    }
  ]
}
```
These could actually just be inline selects that repeat every time a column item is met.
```sql
SELECT
bookingName,
created,
(SELECT accessLevel FROM Biggly.users WHERE bms_booking.booking.createdUserKey = userKey) as accessLevel, 
-- ^ if no `as` value then use the `name` again.
(SELECT CONCAT(firstName, " ", lastName) FROM Biggly.users WHERE bms_booking.booking.createdUserKey = userKey) as fullName
FROM bms_booking.booking

HAVING bookingsKey = "123" AND created = "2019" 
-- ^ we could use HAVING rather than WHERE as it allows us to be more vague.
```

```js
const query = {
  name: 'bms_booking.booking',
  where: [
    'bookingName != "Bad Name"'
  ]
}

const query = {
  name: 'bms_booking.booking',
  where: [ 'bookingsKey = "123"' ],
  columns: [
    {name: 'bookingName'},
    {name: 'created'},
    {
      name: 'Biggly.uploads', 
      where: [
        'bms_booking.booking.bookingsKey = bookingsKey'
      ],
      columns: [
        {name: 'count=>*', as: 'uploadCount'}
      ]
    }
  ]
}
```
We could leave much of the details up to the user about whether they put the where assignments in the right order
or if the full db.table.column names are correctly selected.

That would give me space to simply create shorthands for many of the more laborious aspects of mysql syntax.

We should start by creating a function that deals with a single **TableObject** level. It should create a full SELECT
query with a WHERE.
















