module.exports = class JsonQL {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
    this.fatalError = false;

    this.select = ''
    this.from = '';
    this.where = '';
    this.join = [];

    this.dbTableNames = [];
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


    // let query = jsonQL.selectQL({
    //   name: 'bms_campaigns.bookings',
    //   columns: [
    //     {name: 'bookingName', as: 'booky'},
    //     {name: 'bookingsKey', as: 'keykey'},
    //     {
    //       name: 'Biggly.users',
    //       columns: [
    //         {name: 'firstName'}
    //       ],
    //       where: [
    //         'createdUserKey = userKey'
    //       ], 
    //       as: 'userName'
    //     }
    //   ],
    //   where: [
    //     'bookingsKey = "123"'
    //   ]
    // });
  }

  validateQueryObject(queryObj) {
    const {db,table} = this.parseDbAndTableNames(queryObj.name);
    this.dbTableNames.push({db, table});

    if(!this.schema[db][table]) {
      this.fatalError = true;
      this.errors.push(`${db}.${table} is not in the schema`);
      return;
    }
    // We have to check the where first so it'll still have the relevent db and table names
    if(queryObj.where) {
      // Now to validate the where strings
      queryObj.where = queryObj.where.filter(wh => {
        if(this.validWhereString(wh)) return true;
        return false;
      });
    }

    const dbTableColumn = /^\w+\.\w+\.\w+$/;
    const twoSelections = /^\w+\.\w+$/;
    const column = /^\w+$/;
    const string = /^['"`].+['"`]$/g;

    // Remove all invalid columns from the queryObject.
    queryObj.columns = queryObj.columns.filter(col => {
      if(typeof col.name === 'number') return true;

      if(twoSelections.test(col.name) && this.dbTableSelection(col.name)) {
        // Now check the nested object.
        this.validateQueryObject(col);
        return true;
      }

      if(string.test(col.name) && this.validString(col.name)) return true;
      if(dbTableColumn.test(col.name) && this.dbTableColumnValid(col.name)) return true;
      if(twoSelections.test(col.name) && this.tableColumnValid(db, col.name)) return true;
      if(column.test(col.name) && this.columnValid(db, table, col.name)) return true;
      return false;

    });


    return queryObj;
  }
  // We need to make another function that returns a string for the select and then also creates
  // a string for the join, which can be added on to the end of the whole query at the build stage.
  parseJoinObject(joinObj) {

    const {db, table} = this.parseDbAndTableNames(joinObj.name);

    this.join.push(
      `LEFT JOIN ${db}.${table} ON ${joinObj.where.map(wh => 
        typeof wh === 'object' ?
        wh.map(w => w).join(' OR ')
        :
        wh
      ).join(' AND ')}`
    )

    const select = `${
      joinObj.columns.length > 0 ? 
        joinObj.columns.map(col => {

          if(/^\w+\.\w+$/g.test(col.name)) return this.parseJoinObject(col);
          // Check the db, table and name here because we know that joinObj.name will be the right db and table for this col.name.
          let name = `${db}.${table}.${col.name}`
          if(col.as) {
            name += ` AS ${col.as}`;
          }
          return name
        }).join() 
      : 
      '*'
    }`;

    const as = joinObj.as ? ` AS ${joinObj.as}` : '';

    return `${select}${as}`;
  }

  parseQueryObj(queryObj) {
    const {db, table} = this.parseDbAndTableNames(queryObj.name);

    this.select = `${
      queryObj.columns.length > 0 ? 
        queryObj.columns.map(col => {

          if(/^\w+\.\w+$/g.test(col.name)) return this.parseJoinObject(col);
          // Check the db, table and name here because we know that queryObj.name will be the right db and table for this col.name.
          let name = `${db}.${table}.${col.name}`
          if(col.as) {
            name += ` AS ${col.as}`;
          }
          return name
        }).join() 
      : 
      ''
    }`;

    this.from = `${queryObj.name}`

    this.where = (queryObj.where || []).length > 0 ? `${queryObj.where.map(wh => {
      // We have to do more complicated validation for the where strings but it'll basically
      // amount to checking anything with 'commas' is a valid string and anything without 
      // is in the schema.
      // Maybe we could keep a simple list of db and table names to check all the values against as we go.
      if(wh.length && typeof wh === 'object') return wh.map(w => w).join(' OR ');
      return wh;
    }).join(' AND ')}` : '';

  }

  parseDbAndTableNames(name) {
    const dbTable = /^\w+\.\w+$/
    if(!dbTable.test(name)) {
      this.fatalError = true;
      return null;
    }
    return {
      db: name.match(/^\w+|\w+$/g)[0],
      table: name.match(/^\w+|\w+$/g)[1]
    }
  }


  // █▀▀ █▀▀█ █░░█ █▀▀▄   █▀▄▀█ █▀▀ ▀▀█▀▀ █░░█ █▀▀█ █▀▀▄ █▀▀
  // █░░ █▄▄▀ █░░█ █░░█   █░▀░█ █▀▀ ░░█░░ █▀▀█ █░░█ █░░█ ▀▀█
  // ▀▀▀ ▀░▀▀ ░▀▀▀ ▀▀▀░   ▀░░░▀ ▀▀▀ ░░▀░░ ▀░░▀ ▀▀▀▀ ▀▀▀░ ▀▀▀
  selectQL(queryObj) {
    this.validateQueryObject(queryObj);
    // return;
    this.parseQueryObj(queryObj);

    let select = '';
    if(this.select.length > 0) {
      select = `SELECT ${this.select}`;
    }

    let from = '';
    if(this.from.length > 0) {
      from = ` FROM ${this.from}`;
    }

    let join = '';
    if(this.join.length > 0) {
      join = ` ${this.join.map(j => j).join(' ')}`;
    }

    let where = '';
    if(this.where.length > 0) {
      where = ` HAVING ${this.where}`;
    }

    if(this.fatalError) {
      return {
        status: 'error',
        errors: this.errors,
        query: ''
      }
    }

    return {
      status: 'success',
      errors: this.errors,
      query: `${select}${from}${join}${where}` 
    }
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

  // ▀█░█▀ █▀▀█ █░░ ░▀░ █▀▀▄ █▀▀█ ▀▀█▀▀ ░▀░ █▀▀█ █▀▀▄
  // ░█▄█░ █▄▄█ █░░ ▀█▀ █░░█ █▄▄█ ░░█░░ ▀█▀ █░░█ █░░█
  // ░░▀░░ ▀░░▀ ▀▀▀ ▀▀▀ ▀▀▀░ ▀░░▀ ░░▀░░ ▀▀▀ ▀▀▀▀ ▀░░▀

  validWhereString(whStr) {
    const parts = whStr.split(' ');
    let valid = false;

    const dbTableColumn = /^\w+\.\w+\.\w+$/;
    const twoSelections = /^\w+\.\w+$/;
    const column = /^\w+$/;
    const string = /^['"`].+['"`]$/g;

    parts.forEach(part => {

      // if the part meets any of these conditions it will go to true
      if(string.test(part) && this.validString(part)) {
        valid = true;
      }
      if(dbTableColumn.test(part) && this.dbTableColumnValid(part, false)) {
        valid = true;
      }
      this.dbTableNames.forEach(dbTObj => {
        if(twoSelections.test(part) && this.tableColumnValid(dbTObj.db, part, false)) {
          valid = true;
        }
        if(column.test(part) && this.columnValid(dbTObj.db, dbTObj.table, part, false)) {
          valid = true;
        }
      });
      if(!valid) {
        this.errors.push(part + ' didnt pass validation');
        this.fatalError = true;
      }
    });

    return valid;
  }
  validString(string) {
    const regex = /(drop )|;|(update )|( truncate)/gi;
    if(regex.test(string)) {
      this.errors.push('The string \'' + string + '\' is not allowed');
      this.fatalError = true;
      return false;
    } else {
      return true;
    }
  }
  dbTableSelection(string) {
    // We don't want to push an error here because this could be a valid table.column
    let m = string.match(/\w+/g);
    if(!(this.schema[m[0]] || {})[m[1]]) {
      return false
    }
    return true;
  }
  dbTableColumnValid(string, pushToErrors = true) {
    let m = string.match(/\w+/g);
    if(!((this.schema[m[0]] || {})[m[1]] || {})[m[2]]) {
      if(pushToErrors) this.errors.push(`${m[0]} ${m[1]} ${m[2]} db, table or column not found in schema`);
      return false
    }
    return true;
  }
  tableColumnValid(db, string, pushToErrors = true) {
    let m = string.match(/\w+/g);
    if(!((this.schema[db] || {})[m[0]] || {})[m[1]]) {
      if(pushToErrors) this.errors.push(`${db} ${m[0]} ${m[1]} table or column not in schema`);
      return false
    }
    return true;
  }
  columnValid(db, table, string, pushToErrors = true) {
    if(!((this.schema[db] || {})[table] || {})[string]) {
      if(pushToErrors) this.errors.push(`${db} ${table} ${string} column not in schema`);
      return false
    }
    return true;
  }
}
