const mysql = require('mysql2/promise');
const connection = require('./config');
const schema = require('../../bms-api/general/schema/admin');
const JsonQL = require('../');

async function main() {

  // Make a new JsonQL instance using your chosen schema.
  const jsonQL = new JsonQL(schema);

  // We're doing a get here so use selectQL and pass it your jsonQL object...
  let queryObj = jsonQL.updateQL({
    db: 'bms_campaigns',
    table: 'bookings',
    where: [
      {name: 'bookingsKey', is: 'fd6bd940-2e26-11ea-b768-834e18b87afe'},
      // [
      // {name: 'bookingsKey', is: '0021ecb0-20ee-11ea-8236-771da2034d25'},
      // ]
    ],
    // having: [
    //   [
    //     {name: 'biggSpend', is: 50},
    //     {name: 'biggSpend', is: '50'}
    //   ],
    //   {name: 'divName', is: 'Scribr'}
    // ],
    // limit: [0,5]
  // });
  }, {
    "$jsonForm[?Target Keywords].value": 'nadda'
  });

  // Check the status of the returned object.
  if (queryObj.status === 'error') {
    console.log(queryObj);
    return;
  } 
    console.log('queryObj :', queryObj);
  

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
  console.log('length :', result[0].length);
  console.log(queryObj.query);
  await con.end()

}

main();
