const mysql = require('mysql2/promise');
const connection = require('./config');
const schema = require('../../bms-api/jsonql/schema/admin');
const JsonQL = require('../');

//     SELECT 
//
//     page.name as Page,
//     page.key as PageKey,
//     round(page.override_price/30,2) as OverridePrice
//     site.name as Client,
//     (select name from packages where id = page.selected_package_id) as Package,
//
//     (select count(page_key) from page_view where created between '" . $from . "' and '" . $to. "' and page_key = page.key) as Visits,
//
//     (select count(page_key) from formfill where created between '" . $from . "' and '" . $to. "' and page_key = page.key) as Form,
//     (select count(page_key) from click_email where created between '" . $from . "' and '" . $to. "' and page_key = page.key) as Email,
//     (select count(page_key) from click_phone where created between '" . $from . "' and '" . $to. "' and page_key = page.key) as ClickToCall,
//     (select count(page_key) from `call` where call_start between '" . $from . "' and '" . $to. "' and page_key = page.key) as TrackedCall,
//     (select round(rrp/30,2) from packages where id = page.selected_package_id) as RetailPrice,
//
//     FROM page
//
//     join site on site.key = page.site_key
//     join client on client.key = site.client_key
//
//     WHERE
//
//     page.status = 'Active' AND page.campaign is not null
//     order by client.name, site.name, page.name";
async function main() {

  // Connect to mysql...
  const con = await mysql.createPool({...connection, connectionLimit: 900});

  const jsonQL = new JsonQL(schema);

  let queryObj = jsonQL.selectQL({
    db: 'bms_leadsbox',
    table: 'page',
    columns: [
      {name: 'name', as: 'Page'},
      {name: 'key', as: 'PageKey'},
      {
        fn: 'ROUND', 
        args: [{name: 'override_price/30'}, {number: 2}],
        as: 'OverridePrice'
      },
      {join: {
        db: 'bms_leadsbox',
        table: 'site',
        columns: [{name: 'name', as: 'Client'}],
        where: [{name: 'site_key', is: 'key'}]
      }},
      {join: {
        db: 'bms_leadsbox',
        table: 'packages',
        columns: [{name: 'name', as: 'Package'}],
        where: [
          {name: 'selected_package_id', is: 'id'},
          // This won't work :( the name here is always the parent column but here we need it to be the join column 
          {name: 'created', isbetween: ['\'2018\'', '\'2019\'']}
        ]
      }},
      {count: {
        db: 'bms_leadsbox',
        table: 'page_view',
        where: [
          {name: 'page_key', is: 'key'}
        ]
      }, as: 'Visits'}
    ],
    // limit: [0,5]
    where: [{name: 'key', is: '\'CM4N8jJVDL\''}]
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
