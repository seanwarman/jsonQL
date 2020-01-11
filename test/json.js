module.exports = {
  db: 'bms_booking',
  table: 'bookings',
  columns: [
    {name: 'bookingName'},
    // {
    //   format: {
    //     fn: 'JSON_EXTRACT',
    //     args: [{name: 'jsonStatus'},{string: '$[0]'}]
    //   },
    //   as: 'firstStatus',
    // },
    {
      join: {
        db: 'Biggly',
        table: 'users',
        columns: [{name: 'firstName'}],
        where: {name: 'createdUserKey', is: 'userKey'}
      }
    }
  ],
  limit: [0,2],



  // string: `
  //   SELECT
  //   JSON_EXTRACT(
  //     JSON_EXTRACT(
  //         bms_booking.bookings.jsonForm, concat('$[', substr(JSON_SEARCH(bms_booking.bookings.jsonForm, 'all', 'Booking Month'), 4, 1), ']')
  //       ), '$.value'
  //   ) AS bookingMonth
  //   FROM bms_booking.bookings
  //   LIMIT 0, 5;
  // `
};
const join = {
  db: String,
  table: String,
  columns: Array,
  where: Array
}

const columns = [
  {
    name: String, 
    string: String, 
    as: String, 
    format: Object,
    join: {
      db: String,
      table: String,
      columns: Array,
      where: Array //< although currently this is an object.
    }
  }
]

const format = {
  fn: String, 
  args: [
    {
      name: String,
      string: String,
      format: {
        fn: String,
        args: [
          {
            name: String,
            string: String,
            format: {}
          }
        ]
      }
    }
  ]
}