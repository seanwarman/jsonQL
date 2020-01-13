const mysql = require('mysql2/promise');
const connection = require('./config');
const schema = require('../../bms-api/general/schema/admin');
const JsonQL = require('./test2');

async function main() {

  // Make a new JsonQL instance using your chosen schema.
  const jsonQL = new JsonQL(schema);

  // We're doing a get here so use selectQL and pass it your jsonQL object...
  let queryObj = jsonQL.selectQL({
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
  });

  console.log('queryObj :', queryObj);

  // Check the status of the returned object.
  if (queryObj.status === 'error') {
    console.log(queryObj);
    return;
  }

  // Connect to mysql...
  const con = await mysql.createConnection(connection);

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

main();