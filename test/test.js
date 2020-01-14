const mysql = require('mysql2/promise');
const connection = require('./config');
const schema = require('../../bms-api/general/schema/admin');
const JsonQL = require('../');

async function main() {

  // Make a new JsonQL instance using your chosen schema.
  const jsonQL = new JsonQL(schema);

  // We're doing a get here so use selectQL and pass it your jsonQL object...
  let queryObj = jsonQL.updateQL({
    db: 'bms_booking',
    table: 'bookings',
    where: [{name: 'bookingsKey', is: '67fe209d-fbde-11e9-96d8-69859465d135'}]
  }, {
    customerKey: '1e4e5880-7311-11e9-b7cf-850694c11c0f95'
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
