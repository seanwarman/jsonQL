const mysql = require('mysql2/promise');
const schema = require('../schema/admin/index');
const JsonQL = require('../libs/jsonQL');
const jsonQueries = require('./jsonQueries');
const connection = require('../config/connection');

async function example() {

  const jsonQL = new JsonQL(schema);

  // this query breaks the join...
  let queryObj = jsonQL.selectQL({ 
    database: 'bms_booking',
  table: 'divisionTemplates',
  columns: [
    {name: 'tmpDivKey'},
    {name: 'tmpName'},
    {name: 'tmpKey'},
    {name: 'colorLabel'},
    {name: 'jsonForm'},
    {name: 'bookingDivKey'},
    {join: {
      database: 'bms_booking',
      table: 'bookingDivisions',
      columns: [{name: 'jsonStatus'}],
      where: {parent: 'bookingDivKey', is: 'bookingDivKey', as: 'bookDivK'}
    }}
  ],
  where: [
    {name: 'bookingDivKey', is: this.props.match.params.bookingDivKey}
  ]});
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
