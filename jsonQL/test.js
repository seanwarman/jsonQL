const mysql = require('mysql2/promise');
const schema = require('../schema/admin/index');
const JsonQL = require('../libs/jsonQL');
const jsonQueries = require('./jsonQueries');
const connection = require('../config/connection');

async function example() {

  const jsonQL = new JsonQL(schema);

  let queryObj = jsonQL.selectQL({
    database: 'bms_notify',
    table: 'templates',
    columns: [
      { name: 'templateKey'},
      { name: 'templateName'},
      { name: 'created'},
      { name: 'templateCode'},
      { name: 'templateBg'},
      { name: 'contentBg'},
      { name: 'partnerKey'},
      { name: 'updated'},
    ]
  });
  // let queryObj = jsonQL.createQL(jsonQueries.createBooking);
  // let queryObj = jsonQL.updateQL(jsonQueries.updateBooking);
  // let queryObj = jsonQL.deleteQL(jsonQueries.deleteBooking);
  
  console.log('queryObj :', queryObj);

  if (queryObj.status === 'error') {
    return;
  }

  let result;
  const con = await mysql.createConnection(connection);
  
  try {
    result = await con.query(queryObj.query)
  } catch (err) {
    console.log(err)
  }
  console.log('result :', result[0]);
  await con.end()

}

example();
