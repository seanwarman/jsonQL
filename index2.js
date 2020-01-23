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
  }

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
          let name = this.setNameString(db, table, col.name);
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
          let name = this.setNameString(db, table, col.name);
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

  // █▀▀ ▀▀█▀▀ █▀▀█ ░▀░ █▀▀▄ █▀▀▀ █▀▀
  // ▀▀█ ░░█░░ █▄▄▀ ▀█▀ █░░█ █░▀█ ▀▀█
  // ▀▀▀ ░░▀░░ ▀░▀▀ ▀▀▀ ▀░░▀ ▀▀▀▀ ▀▀▀

  setNameString(db, table, name) {

    if(/^\w+\=\>/.test(name)) {
      return this.funcString(db, table, name);
    }
    if(/^$\w+/.test(name)) {
      return this.JQString(db, table, name);
    }

    return `${db}.${table}.${name}`;
  }

  funcString(db, table, name) {
    const func = name.slice(0, name.indexOf('=>'))

    let columns = name.slice(
      func.length + 2
    ).match(
      /[\$\w.]+|['`"].+['`"]|\\|\+|>=|<=|=>|>|<|-|\*|=/g
    );

    return `${func}(${columns.join()})`;
  }

  JQString(db, table, name) {
    return `${db}.${table}.${name}`;
  }

  // █▀▀ █▀▀█ █░░█ █▀▀▄   █▀▄▀█ █▀▀ ▀▀█▀▀ █░░█ █▀▀█ █▀▀▄ █▀▀
  // █░░ █▄▄▀ █░░█ █░░█   █░▀░█ █▀▀ ░░█░░ █▀▀█ █░░█ █░░█ ▀▀█
  // ▀▀▀ ▀░▀▀ ░▀▀▀ ▀▀▀░   ▀░░░▀ ▀▀▀ ░░▀░░ ▀░░▀ ▀▀▀▀ ▀▀▀░ ▀▀▀

  selectQL(queryObj) {

    this.validateQueryObject(queryObj);
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

    // Remove all invalid columns from the queryObject.
    queryObj.columns = queryObj.columns.filter(col => {
      const twoSelections = /^\w+\.\w+$/;
      if(twoSelections.test(col.name) && this.dbTableValid(col.name)) {
        // Now check the nested object.
        this.validateQueryObject(col);
        return true;
      }
      return this.validateNameString(db, table, col.name);
    });

    // TODO: check the `is` params and the `as` params as well.

    return queryObj;
  }

  validateNameString(db, table, name) {
    const dbTableColumn = /^\w+\.\w+\.\w+$/;
    const tableColumn = /^\w+\.\w+$/;
    const column = /^\w+$/;
    const string = /^['"`].+['"`]$/g;
    const func = /^\w+\=\>/;

    if(typeof name === 'number') return true;

    // TODO: the func get split by the spaces but that means an empty string comes out as seperate commas
    // rather than ' '. Youll have to do it by a regex instead including the string one above.
    if(func.test(name) && this.funcValid(db, table, name)) return true;
    if(string.test(name) && this.plainStringValid(name)) return true;
    if(dbTableColumn.test(name) && this.dbTableColumnValid(name)) return true;
    if(tableColumn.test(name) && this.tableColumnValid(db, name)) return true;
    if(column.test(name) && this.columnValid(db, table, name)) return true;
    return false;
  }

  validWhereString(whStr) {
    const parts = whStr.split(' ');
    let valid = false;

    const dbTableColumn = /^\w+\.\w+\.\w+$/;
    const twoSelections = /^\w+\.\w+$/;
    const column = /^\w+$/;
    const string = /^['"`].+['"`]$/g;

    parts.forEach(part => {

      // if the part meets any of these conditions it will go to true
      if(string.test(part) && this.plainStringValid(part)) {
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
  funcValid(db, table, name) {
    const func = name.slice(0, name.indexOf('=>'))
    let valid = false;
    const columns = name.slice(func.length + 2).split(' ')
    columns.forEach(nm => {
      if(this.validateNameString(db, table, nm)){
        valid = true;
      }
    });
    return valid;
  }

  plainStringValid(string) {
    const regex = /(drop )|;|(update )|( truncate)/gi;
    if(regex.test(string)) {
      this.errors.push('The string \'' + string + '\' is not allowed');
      this.fatalError = true;
      return false;
    } else {
      return true;
    }
  }

  // █▀▀ █▀▀ █░░█ █▀▀ █▀▄▀█ █▀▀█   ▀█░█▀ █▀▀█ █░░ ░▀░ █▀▀▄ █▀▀█ ▀▀█▀▀ ░▀░ █▀▀█ █▀▀▄
  // ▀▀█ █░░ █▀▀█ █▀▀ █░▀░█ █▄▄█   ░█▄█░ █▄▄█ █░░ ▀█▀ █░░█ █▄▄█ ░░█░░ ▀█▀ █░░█ █░░█
  // ▀▀▀ ▀▀▀ ▀░░▀ ▀▀▀ ▀░░░▀ ▀░░▀   ░░▀░░ ▀░░▀ ▀▀▀ ▀▀▀ ▀▀▀░ ▀░░▀ ░░▀░░ ▀▀▀ ▀▀▀▀ ▀░░▀

  dbTableValid(string) {
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
