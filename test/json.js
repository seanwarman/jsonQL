module.exports = {
  db: 'bms_booking',
  table: 'bookings',
  columns: [
    {name: 'bookingsKey'},
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
      where: [{name: 'createdUserKey', is: 'userKey'}]
    }},
    {
      name: 'jsonForm',
      as: 'bookingMonth',
      jsonExtract: {search: 'Booking Month', target: 'value'}
    },
    {
      fn: 'REPLACE',
      args: [{name: 'bookingName'}, {string: '%20'}, {string: ' '}],
      as: 'bookingNameFormatted'
    },
  ],
  limit: [0,5]
}
 