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
    let queryObj = jsonQL.updateQL({
      db: 'bms_campaigns',
      table: 'bookings',
      where: [
        [
          {name: 'bookingsKey', is: "67fe209b-fbde-11e9-96d8-69859465d135"},
          {name: 'bookingsKey', is: "8daefb38-fbdd-11e9-96d8-69859465d135"},

        ]
      ]
    }, {
      dueDate: "2020-01-23T15:15:59+00:00"
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
  }

  await con.end()

}

main();
