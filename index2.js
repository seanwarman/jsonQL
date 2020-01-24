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

    let limit = '';
    if((this.limit || []).length > 0) {
      limit = ` LIMIT ${this.limit}`;
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
      query: `${select}${from}${join}${where}${limit}` 
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
  // █▀▀█ █▀▀█ █▀▀█ █▀▀ █▀▀ █▀▀█ █▀▀
  // █░░█ █▄▄█ █▄▄▀ ▀▀█ █▀▀ █▄▄▀ ▀▀█
  // █▀▀▀ ▀░░▀ ▀░▀▀ ▀▀▀ ▀▀▀ ▀░▀▀ ▀▀▀

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
      ''
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
      if(wh.length && typeof wh === 'object') return wh.map(w => w).join(' OR ');
      return wh;
    }).join(' AND ')}` : '';

    this.limit = queryObj.limit ? queryObj.limit.map(n => n).join() : '';
  }

  // █▀▀ ▀▀█▀▀ █▀▀█ ░▀░ █▀▀▄ █▀▀▀ █▀▀
  // ▀▀█ ░░█░░ █▄▄▀ ▀█▀ █░░█ █░▀█ ▀▀█
  // ▀▀▀ ░░▀░░ ▀░▀▀ ▀▀▀ ▀░░▀ ▀▀▀▀ ▀▀▀

  setNameString(db, table, name) {

    if(/^\w+\=\>/.test(name)) {
      return this.funcString(db, table, name);
    }
    if(/^\$\w+/.test(name)) {
      return this.jQExtract(db, table, name);
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

  // ░░▀ █▀▀█ █▀▀ ▀▀█▀▀ █▀▀█ ░▀░ █▀▀▄ █▀▀▀ █▀▀
  // ░░█ █░░█ ▀▀█ ░░█░░ █▄▄▀ ▀█▀ █░░█ █░▀█ ▀▀█
  // █▄█ ▀▀▀█ ▀▀▀ ░░▀░░ ▀░▀▀ ▀▀▀ ▀░░▀ ▀▀▀▀ ▀▀▀

  jQExtract(db, table, jQStr) {
    const regx = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g
    const matches = jQStr.match(regx);
    const name = `${db}.${table}.${matches[0].slice(1)}`
    return `JSON_UNQUOTE(JSON_EXTRACT(${name}, ${this.jQStringMaker(name, matches)}))`;
  }

  jQStringMaker(name, matches) {
    let result = matches.reduce((arr, match, i) => {
      return [...arr, this.jQString(name, match, arr[i-1])];
    }, []);

    return result[result.length - 1];
  }

  jQString(name, string, prevString) {
    let nameReg = /\$\w+/;
    let index = /\[\d\]/;
    let target = /\.\w+/;
    let search = /\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\]/;

    if(nameReg.test(string)) {
      return `CONCAT("$")`;
    }
    if(index.test(string)) {
      // 'index';
      return `CONCAT(${prevString}, "${string}")`
    }
    if(target.test(string)) {
      // 'target';
      return `CONCAT(${prevString}, "${string}")`
    }
    if(search.test(string)) {
      // 'search';
      string = string.slice(2, -1);
      return `CONCAT(${prevString}, CONCAT('[',SUBSTR(JSON_SEARCH(JSON_EXTRACT(${name}, "$"),'one','${string}'), 4,LOCATE(']',JSON_SEARCH(JSON_EXTRACT(${name}, "$"), 'one', '${string}'))-4),']'))`;
    }
  }

  // █░░█ ▀▀█▀▀ ░▀░ █░░ ░▀░ ▀▀█▀▀ ░▀░ █▀▀ █▀▀
  // █░░█ ░░█░░ ▀█▀ █░░ ▀█▀ ░░█░░ ▀█▀ █▀▀ ▀▀█
  // ░▀▀▀ ░░▀░░ ▀▀▀ ▀▀▀ ▀▀▀ ░░▀░░ ▀▀▀ ▀▀▀ ▀▀▀

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

  // ▀█░█▀ █▀▀█ █░░ ░▀░ █▀▀▄ █▀▀█ ▀▀█▀▀ ░▀░ █▀▀█ █▀▀▄
  // ░█▄█░ █▄▄█ █░░ ▀█▀ █░░█ █▄▄█ ░░█░░ ▀█▀ █░░█ █░░█
  // ░░▀░░ ▀░░▀ ▀▀▀ ▀▀▀ ▀▀▀░ ▀░░▀ ░░▀░░ ▀▀▀ ▀▀▀▀ ▀░░▀

  validateQueryObject(queryObj) {
    const {db,table} = this.parseDbAndTableNames(queryObj.name);
    this.dbTableNames.push({db, table});

    if(!(this.schema[db] || {})[table]) {
      this.fatalError = true;
      this.errors.push(`${db}.${table} is not in the schema`);
      return;
    }
    // We have to check the where first so it'll still have the relevent db and table names
    if(queryObj.where) {
      // Now to validate the where strings
      queryObj.where = queryObj.where.filter(wh => {
        if(this.whereStringValid(wh)) return true;
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
      if(col.as) {
        return this.nameStringValid(db, table, col.name) && this.plainStringValid(col.as);
      }
      return this.nameStringValid(db, table, col.name)
    });

    return queryObj;
  }

  nameStringValid(db, table, name) {
    const dbTableColumn = /^\w+\.\w+\.\w+$/;
    const tableColumn = /^\w+\.\w+$/;
    const column = /^\w+$/;
    const string = /^['"`].+['"`]$/g;
    const func = /^\w+\=\>/;
    const all = /\*/g;
    const jQString = /^\$\w+/;

    if(typeof name === 'number') return true;

    if(jQString.test(name) && this.jQStringValid(db, table, name)) return true;
    if(all.test(name)) return true;
    if(func.test(name) && this.funcValid(db, table, name)) return true;
    if(string.test(name) && this.plainStringValid(name)) return true;
    if(dbTableColumn.test(name) && this.dbTableColumnValid(name)) return true;
    if(tableColumn.test(name) && this.tableColumnValid(db, name)) return true;
    if(column.test(name) && this.columnValid(db, table, name)) return true;
    return false;
  }

  jQStringValid(db, table, jQString) {
    const column = jQString.slice(1, jQString.search(/[\.\[]/));
    if(!this.columnValid(db, table, column)) return false;
    return true;
  }

  whereStringValid(whStr) {
    const parts = whStr.split(' ');
    // const parts = whStr.match(/[\$\w.]+|['`"].+['`"]|\\|\+|>=|<=|=>|>|<|-|\*|=/g);
    let valid = false;

    const dbTableColumn = /^\w+\.\w+\.\w+$/;
    const twoSelections = /^\w+\.\w+$/;
    const column = /^\w+$/;
    const string = /^['"`].+['"`]$/g;

    parts.forEach(part => {

      // if the part meets any of these conditions it will go to true
      if(this.plainStringValid(part)) {
        valid = true;
      }
      //
      // TODO: decide what you should do here this validation was causing more
      // problems than it fixed but it should probably be little more rigerous than it is now.
      //
      // if(dbTableColumn.test(part) && this.dbTableColumnValid(part, false)) {
      //   valid = true;
      // }
      // this.dbTableNames.forEach(dbTObj => {
      //   if(twoSelections.test(part) && this.tableColumnValid(dbTObj.db, part, false)) {
      //     valid = true;
      //   }
      //   if(column.test(part) && this.columnValid(dbTObj.db, dbTObj.table, part, false)) {
      //     valid = true;
      //   }
      // });
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
      if(this.nameStringValid(db, table, nm)){
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
