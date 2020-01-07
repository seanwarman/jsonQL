module.exports = {
  createBooking: {
    database: 'bms_campaigns',
    table: 'bookings',
    data: {
      bookingName: 'Cool Bookings!',
      bookingsKey: '12345',
      tmpKey: '123'
    }
  },

  updateBooking: {
    database: 'bms_campaigns',
    table: 'bookings',
    data: {
      bookingName: 'Mega Dega Cool Bookings!',
    },
    where: [
      {
        name: 'bookingsKey',
        is: '123'
      }
    ]
  },
  
  deleteBooking: {
    database: 'bms_campaigns',
    table: 'bookings',
    where: [
      {
        name: 'bookingsKey',
        is: '1234'
      }
    ]
  },

  bookingsWhere: {
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
      {
        or: [
          {
            name: 'bookingsKey',
            is: 'd03563a1-2e2c-11ea-b3ec-a1387ad1100d',
          },
          {
            name: 'bookingsKey',
            is: 'd03563a0-2e2c-11ea-b3ec-a1387ad1100d'
          }
        ]
      }
    ]
  },
  
  bookingsJoin: {
    database: 'bms_booking',
    table: 'bookings',
    jsonForm: [
      {
        name: 'Booking Month',
        as: 'bookingMonth'
      },
      {
        name: 'Strategy',
        as: 'strategy'
      }
    ],
    where: [
      {
        name: 'bookingName',
        is: 'As%20New%20Auto%20Recyclers%20%281%20of%202%29'
      }
    ],
    columns: [
      {name: 'bookingName'},
      {name: 'created'},
      {name: 'bookingsKey'},
      {name: 'assignedUserKey'},
      {join: {
        database: 'Biggly',
        table: 'partners',
        columns: [
          {name: 'partnerName', as: 'createdPartnerName'}
        ],
        where: {parent: 'createdPartnerKey', is: 'partnerKey'},
      }},
      {join: {
        database: 'Biggly',
        table: 'users',
        columns: [
          {name: 'firstName', as: 'createdFirstName'},
          {name: 'lastName', as: 'createdLastName'}
        ],
        where: {parent: 'createdUserKey', is: 'userKey'}
      }},
      {join: {
        database: 'Biggly',
        table: 'users',
        columns: [
          {name: 'firstName', as: 'assignedFirstName'},
          {name: 'lastName', as: 'assignedLastName'}
        ],
        where: {parent: 'assignedUserKey', is: 'userKey'}
      }}
    ],
    limit: [0,10]
  }
}