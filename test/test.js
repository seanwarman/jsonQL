const mysql = require('mysql2/promise');
const connection = require('./config');
const schema = require('../../bms-api/general/schema/admin');
const JsonQL = require('../');

async function main() {

  // Make a new JsonQL instance using your chosen schema.
  const jsonQL = new JsonQL(schema);

  // We're doing a get here so use selectQL and pass it your jsonQL object...
  let queryObj = jsonQL.selectQL({
    db: 'bms_booking',
    table: 'bookings',
    columns: [
      {name: 'bookingName'},
      {name: 'bookingsKey'},
      {
        name: '$jsonForm[?Bigg Spend].value', as: 'biggSpend'
      },
      {
        name: '$jsonForm[?Bigg Spend]', as: 'biggSpendItem'
      },
      {
        join: {
          db: 'bms_booking',
          table: 'bookingDivisions',
          columns: [{name: 'divName'}],
          where: [{name: 'bookingDivKey', is: 'bookingDivKey'}],
        }
      }
    ],
    having: [
      // {name: 'biggSpend', number: 50}
      {or: [
        {name: 'biggSpend', is: 50},
        {name: 'biggSpend', is: '50'}
      ]},
      {name: 'divName', is: 'Scribr'}

      // {name: 'biggSpend', is: '50'}
    ],
  });
  // }, {
  //   "$jsonForm[0]": 'Boom'
  // });

  // Check the status of the returned object.
  if (queryObj.status === 'error') {
    console.log(queryObj);
    return;
  } 
    // console.log('queryObj :', queryObj);
  

  // Connect to mysql...
  const con = await mysql.createConnection(connection);

  let result;

  // jsonQL will put your mysql string onto a param called query...
  try {
    result = await con.query(queryObj.query)
  } catch (err) {
    console.log(err)
  }
  console.log('result :', result[0][0]);
  console.log('length :', result[0].length);
  console.log(queryObj.query);
  await con.end()

}

main();
