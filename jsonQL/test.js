const mysql = require('mysql2/promise');
const schema = require('../schema');
const JsonQL = require('../libs/jsonQL');
const jsonQueries = require('./jsonQueries');
const connection = require('../libs/connection');

async function example() {

  const con = await mysql.createConnection(connection);
  
  const jsonQL = new JsonQL(schema);

  let queryObj = jsonQL.selectQL(jsonQueries.bookingsJoin);
  // let queryObj = jsonQL.createQL(jsonQueries.createBooking);
  // let queryObj = jsonQL.updateQL(jsonQueries.updateBooking);
  // let queryObj = jsonQL.deleteQL(jsonQueries.deleteBooking);
  
  console.log('queryObj :', queryObj);

  if (queryObj.status === 'error') {
    return;
  }

  let result;

  try {
    result = await con.query(queryObj.query)
  } catch (err) {
    console.log(err)
  }
  console.log('result :', result[0]);
  await con.end()

}

example();
