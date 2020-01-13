module.exports = {
  db: 'bms_booking',
  table: 'bookings',
  columns: [
    {name: 'bookingName'},
    {name: 'bookingsKey'},
    {join: {
      db: 'Biggly',
      table: 'users',
      columns: [
        {
          fn: 'CONCAT',
          args: [
            {name: 'firstName'},
            {string: ' '},
            {name: 'lastName'},
          ],
          as: 'createdName'
        }
      ],
      where: [{name: 'createdUserKey', is: 'userKey'}]
    }},
    {join: {
      db: 'Biggly',
      table: 'users',
      columns: [
        {
          fn: 'CONCAT',
          args: [
            {name: 'firstName'},
            {string: ' '},
            {name: 'lastName'},
          ],
          as: 'assignedName'
        }
      ],
      where: [{name: 'assignedUserKey', is: 'userKey'}]
    }}
  ],
  where: [{name: 'bookingName', is: 'Barton%20Garage%20Services'}],
  having: [
    {name: 'createdName', is: 'Carl Williams'}
  ],
  limit: [0,5]
}
 