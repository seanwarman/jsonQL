const mysql = require('mysql2/promise');
const connection = require('./config');
const schema = require('../../bms-api/jsonql/schema/admin');
const JsonQL = require('../');

async function main() {

  // Connect to mysql...
  const con = await mysql.createPool({...connection, connectionLimit: 900});

  const jsonQL = new JsonQL(schema);

  let queryObj = jsonQL.selectQL({
    db: 'bms_booking',
    table: 'bookings',
    columns: [
      {name: 'bookingName'},
      {name: 'colorLabel'},
      {name: '$jsonForm[0]', as: 'item1'},
      {
        fn: 'CONCAT',
        args: [
          {
            name: '$jsonForm[0].label',
          },
          {
            name: '$jsonForm[1].label'
          },
          {
            name: '$jsonForm[1].value'
          }
        ],
        as: 'labelName'
      }
    ],
    limit: [0,5]
  });

  // Check the status of the returned object.
  if (queryObj.status === 'error') {
    console.log(queryObj);
    return;
  }

  console.log('queryObj :', queryObj);

  let result;
  // jsonQL will put your mysql string onto a param called query...
  try {
    result = await con.query(queryObj.query)
  } catch (err) {
    console.log(err)
  }
  console.log('result :', result[0]);
  console.log('length :', result[0].length);
  console.log(queryObj.query);

  await con.end()

}

main();
