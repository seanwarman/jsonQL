const mysql = require('mysql2/promise');
const connection = require('./config');
const schema = require('./schema/admin');
const JsonQL = require('../');

async function main() {

  // Connect to mysql...
  const con = await mysql.createPool({...connection, connectionLimit: 900});

  const data = [
    {
      bookingName: 'multi bookings!',
      tmpKey: '1234890',
      units: 1,
    },
    {
      bookingName: 'multi bookings!',
      tmpKey: '1234 1234',
      units: 1,
    },
    {
      bookingName: 'multi bookings!',
      tmpKey: '1234 1234 0987',
      units: 1,
    }
  ]

  for await(let dat of data) {
    // Make a new JsonQL instance using your chosen schema.
    const jsonQL = new JsonQL(schema);

    console.log('dat: ', dat);

    // We're doing a get here so use selectQL and pass it your jsonQL object...
    let queryObj = jsonQL.createQL({
      db: 'bms_campaigns',
      table: 'bookings',
    }, dat);

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
  }

  await con.end()

}

main();
