module.exports = class JsonQL {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
    this.fatalError = false;

    this.select = [];

    this.dbTableNames = [];
  }
  // name: 'bms_campaigns.bookings',
  // this name^ item will always target the db.table
  // columns: [
  //   {name: 'bookingName'} // will mean bms_campaigns.bookings.bookingName
  //   {name: 'created'}
  // it's columns will then always target the column names.
  //   {name: 'Biggly.users ... }
  // when we come to a dbTable type name we know this will be a join or subquery.
  // and so any subsequent columns names will be Biggly.users.column
  // ]


  // columns: [
  //   {name: 'bookingName'},
  //   {name: 'created'}
  // ],
  // name: 'bms_campaigns.bookings',
  // where: [
  //   'bookingName = "Cool Name"'
  // ]

  parseQueryObj(queryObj) {
    console.log(queryObj);
    const {db, table} = this.parseDbAndTableNames(queryObj.name);
    this.dbTableNames.push({db, table});

    const select = `SELECT ${
      queryObj.columns.length > 0 ? 
        queryObj.columns.map(col => {
          // Uncomment this below to add a sub-select to the query.

          if(/^\w+\.\w+$/g.test(col.name)) return this.parseQueryObj(col);
          // Check the db, table and name here because we know that queryObj.name will be the right db and table for this col.name.
          return col.name
        }).join() 
      : 
      '*'
    }`;

    const from = `FROM ${queryObj.name}`

    const where = (queryObj.where || []).length > 0 ? `WHERE ${queryObj.where.map(wh => {
      // We have to do more complicated validation for the where strings but it'll basically
      // amount to checking anyhting with 'commas' is a valid string and anything without 
      // is in the schema.
      // Maybe we could keep a simple list of db and table names to check all the values against as we go.
      if(wh.length && typeof wh === 'object') return wh.map(w => w).join(' OR ');
      return wh;
    }).join(' AND ')}` : '';

    const as = queryObj.as ? ` AS ${queryObj.as}` : '';

    return `(${select} ${from} ${where})${as}`;
  }

  parseDbAndTableNames(name) {
    const dbTable = /^\w+\.\w+$/
    if(!dbTable.test(name)) {
      this.fatalError = true;
      return null;
    }
    return {
      db: name.match(/^\w+|\w+$/)[0],
      table: name.match(/^\w+|\w+$/)[1]
    }
  }


  // █▀▀ █▀▀█ █░░█ █▀▀▄   █▀▄▀█ █▀▀ ▀▀█▀▀ █░░█ █▀▀█ █▀▀▄ █▀▀
  // █░░ █▄▄▀ █░░█ █░░█   █░▀░█ █▀▀ ░░█░░ █▀▀█ █░░█ █░░█ ▀▀█
  // ▀▀▀ ▀░▀▀ ░▀▀▀ ▀▀▀░   ▀░░░▀ ▀▀▀ ░░▀░░ ▀░░▀ ▀▀▀▀ ▀▀▀░ ▀▀▀
  selectQL(queryObj) {
    return this.parseQueryObj(queryObj);
  }
  create(queryObj) {
    this.parseQueryObj(queryObj);
  }
  update(queryObj) {
    this.parseQueryObj(queryObj);
  }
  delete(queryObj) {
    this.parseQueryObj(queryObj);
  }
}
