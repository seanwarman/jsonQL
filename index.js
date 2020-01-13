module.exports = class JsonQL {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
    this.fatalError = false;
    this.joinTables = [];
    this.all = false;

    this.select = [];
    this.from = {db: '', table: ''};
    this.join = [];
    this.having = [];
    this.where = [];
    this.limit = [];
    this.columns = [];
    this.values = [];
    this.orderBy = '';
    this.ascOrDesc = '';
  }

  // █▀▀ █▀▀█ █░░█ █▀▀▄   █▀▄▀█ █▀▀ ▀▀█▀▀ █░░█ █▀▀█ █▀▀▄ █▀▀
  // █░░ █▄▄▀ █░░█ █░░█   █░▀░█ █▀▀ ░░█░░ █▀▀█ █░░█ █░░█ ▀▀█
  // ▀▀▀ ▀░▀▀ ░▀▀▀ ▀▀▀░   ▀░░░▀ ▀▀▀ ░░▀░░ ▀░░▀ ▀▀▀▀ ▀▀▀░ ▀▀▀

  selectQL({db, table, columns, where, having, limit, orderBy}) {
    this.initJsonQL({db, table, columns, where, having, limit, orderBy})

    const selectString = this.buildSelect();

    if(this.fatalError) {
      return {
        status: 'error',
        query: selectString,
        errors: this.errors
      }
    }

    return {
      status: 'success',
      query: selectString,
      errors: this.errors,
    }
  }

  createQL({db, table, columns, where, having, limit}, data) {
    if(!data) {
      this.errors.push('Data must be provided in a createQL');
      this.fatalError = true;
    }

    this.initJsonQL({db, table, columns, where, having, limit}, data)

    const selectString = this.buildCreate();

    if(this.fatalError) {
      return {
        status: 'error',
        query: selectString,
        errors: this.errors
      }
    }

    return {
      status: 'success',
      query: selectString,
      errors: this.errors,
    }
  }

  updateQL({db, table, columns, where, having, limit, affectAll}, data) {
    if(!data) {
      this.errors.push('Data must be provided in a updateQL');
      this.fatalError = true;
    }

    this.initJsonQL({db, table, columns, where, having, limit, affectAll}, data)

    const selectString = this.buildUpdate();

    if(this.fatalError) {
      return {
        status: 'error',
        query: selectString,
        errors: this.errors
      }
    }

    return {
      status: 'success',
      query: selectString,
      errors: this.errors,
    }
  }

  deleteQL({db, table, columns, where, having, limit, affectAll}) {
    this.initJsonQL({db, table, columns, where, having, limit, affectAll})

    const selectString = this.buildDelete();

    if(this.fatalError) {
      return {
        status: 'error',
        query: selectString,
        errors: this.errors
      }
    }

    return {
      status: 'success',
      query: selectString,
      errors: this.errors,
    }
  }

  // █▀▀ █▀▀▄ ▀▀█▀▀ █▀▀█ █░░█ █▀▀█ █▀▀█ ░▀░ █▀▀▄ ▀▀█▀▀
  // █▀▀ █░░█ ░░█░░ █▄▄▀ █▄▄█ █░░█ █░░█ ▀█▀ █░░█ ░░█░░
  // ▀▀▀ ▀░░▀ ░░▀░░ ▀░▀▀ ▄▄▄█ █▀▀▀ ▀▀▀▀ ▀▀▀ ▀░░▀ ░░▀░░

  initJsonQL({db, table, columns, where, having, limit, orderBy, affectAll}, data) {
    if(this.validBySchema(db, table)) {
      this.from = {db, table};
    } else {
      this.fatalError = true;
      return;
    }

    if(affectAll) {
      this.affectAll = affectAll;
    }

    if(data) {
      this.parseData(db, table, data)
    }

    if(columns && (columns || []).length > 0) {
      this.pushCols(
        {dbName: db, dbAlias: db},
        {tableName: table, tableAlias: table}, 
        columns
      );
    }

    // If there's no selections then get all non-hidden columns from the schema
    if(this.select.length === 0) {
      this.pushSelFromSchema(db, table);
    }

    if(where && (where || []).length > 0) {
      this.pushWhere(
        {dbName: db, dbAlias: db},
        {tableName: table, tableAlias: table}, 
        where
      );
    }

    if(having && (having || []).length > 0) {
      this.pushHaving(having);
    }

    if(orderBy) {
      this.pushOrderBy(
        db,
        table,
        orderBy
      );
    }

    if(limit) {
      this.limit = limit;
    }
  }

  // █▀▀▄ █▀▀█ ▀▀█▀▀ █▀▀█
  // █░░█ █▄▄█ ░░█░░ █▄▄█
  // ▀▀▀░ ▀░░▀ ░░▀░░ ▀░░▀

  parseData(db, table, data) {
    Object.keys(data).forEach(key => {
      if(!this.validBySchema(db, table, key)) return;

      if(typeof data[key] === 'number') {
        this.values.push(data[key]);
      } else if(typeof data[key] === 'string') {
        this.values.push(`'${data[key]}'`);
      } else {
        return;
      }
      this.columns.push(key);
    })
  }

  // █▀▀█ █░░█ █▀▀ █░░█   █▀▀ █░░█ █▀▀▄ █▀▀ ▀▀█▀▀ ░▀░ █▀▀█ █▀▀▄ █▀▀
  // █░░█ █░░█ ▀▀█ █▀▀█   █▀▀ █░░█ █░░█ █░░ ░░█░░ ▀█▀ █░░█ █░░█ ▀▀█
  // █▀▀▀ ░▀▀▀ ▀▀▀ ▀░░▀   ▀░░ ░▀▀▀ ▀░░▀ ▀▀▀ ░░▀░░ ▀▀▀ ▀▀▀▀ ▀░░▀ ▀▀▀

  pushOrderBy(db, table, orderBy) {
    if(!this.validBySchema(db, table, orderBy.name)) {
      return;
    }
    this.orderBy = orderBy.name;


    if(orderBy.desc && typeof orderBy.desc !== 'boolean') {
      this.errors.push('orderBy.desc must be a Boolean type value.')
      return;
    }
    this.ascOrDesc = orderBy.desc ? 'DESC' : 'ASC';
    
  }

  pushCols(dbObj, tableObj, columns) {
    if(!this.validBySchema(dbObj.dbName, tableObj.tableName)) {
      return;
    }

    const nameCols = columns.filter(col => col.name || col.number || col.string);
    const joinCols = columns.filter(col => col.join);
    const fnCols = columns.filter(col => col.fn);

    if(nameCols.length > 0) {
      this.pushNameCols(
        dbObj,
        tableObj,
        nameCols
      );
    }
 
    if(joinCols.length > 0) {
      this.pushJoinCols(
        dbObj,
        tableObj,
        joinCols
      );
    }

    if(fnCols.length > 0) {
      this.pushFnCols(
        dbObj,
        tableObj,
        fnCols
      );
    }

  }
  
  pushSelFromSchema(db ,table) {
    const fromTable = this.schema[db][table];
    return `${Object.keys(fromTable).filter(key => (
      fromTable[key].hidden !== true
    )).forEach(key => {
      this.select.push(`${db}.${table}.${key}`);
    })}`
  }

  pushNameCols(dbObj, tableObj, nameCols) {
    nameCols.forEach(col => {
      let selectStr = '';
      if(col.name && this.validBySchema(dbObj.dbName, tableObj.tableName, col.name)) {
        selectStr = `${dbObj.dbAlias}.${tableObj.tableAlias}.${col.name}`;
      }
      if(col.number && typeof col.number === 'number') {
        selectStr = `${col.number}`;
      } else if(col.number) {
        this.errors.push(col.number + ' is not a number');
      }
      if(col.string && this.validString(col.string)) {
        selectStr = `'${col.string}'`;
      }
      if(col.jsonExtract && this.validString(col.jsonExtract.search) && this.validString(col.jsonExtract.target)) {
        selectStr = `JSON_EXTRACT(JSON_EXTRACT(${selectStr}, CONCAT('$[', SUBSTR(JSON_SEARCH(${selectStr}, 'all', '${col.jsonExtract.search}'), 4, 1), ']')), '$.${col.jsonExtract.target}')`;
      }
      if(col.as && this.validString(col.as)) {
        selectStr += ` AS ${col.as}`;
      }
      if(selectStr.length > 0) {
        this.select.push(selectStr);
      }
    })
  }

  pushJoinCols(dbObj, tableObj, joinCols) {
    joinCols.forEach(col => {
      if(!this.validBySchema(dbObj.dbName, tableObj.tableName, col.join.where[0].name)) {
        return;
      }
      if(col.join.where[0].isnot) {
        if(!this.validBySchema(col.join.db, col.join.table, col.join.where[0].isnot)) return;
      }
      if(col.join.where[0].is) {
        if(!this.validBySchema(col.join.db, col.join.table, col.join.where[0].is)) return;
      }

      let joinStr = '';
      let aliasTableName = this.aliasReplicaTableNames(col.join.table);
      let aliasString = '';

      if(col.join.table !== aliasTableName) {
        aliasString = ` AS ${aliasTableName}`;
      }
      if(col.join.where[0].isnot) {
        joinStr = `${col.join.db}.${col.join.table}${aliasString} ON ${dbObj.dbName}.${tableObj.tableName}.${col.join.where[0].name} != ${col.join.db}.${aliasTableName}.${col.join.where[0].isnot}`;
      }
      if(col.join.where[0].is) {
        joinStr = `${col.join.db}.${col.join.table}${aliasString} ON ${dbObj.dbName}.${tableObj.tableName}.${col.join.where[0].name} = ${col.join.db}.${aliasTableName}.${col.join.where[0].is}`;
      }

      if(joinStr.length > 0) {
        this.join.push(joinStr);
      }

      this.pushCols(
        {dbName: col.join.db, dbAlias: col.join.db},
        {tableName: col.join.table, tableAlias: aliasTableName},
        col.join.columns
      );
    });
  }

  pushFnCols(dbObj, tableObj, fnCols) {
    fnCols.forEach(col => {
      let selectStr = '';

      if(!this.validBySchema(dbObj.dbName, tableObj.tableName)) {
        return;
      }
      
      selectStr = this.fnString(dbObj.dbAlias, tableObj.tableAlias, col.fn, col.args)
      if(col.as && this.validString(col.as)) {
        selectStr += ` AS ${col.as}`;
      }
      if(selectStr.length > 0) {
        this.select.push(selectStr)
      }
    });
  }

  pushWhere(dbObj, tableObj, where) {
    where.forEach(wh => {
      let whereStr = '';
      
      // Is this right? I don't think you can use alias names in a where...
      if(!this.validBySchema(dbObj.dbName, tableObj.tableName, wh.name)) {
        return;
      }
      
      whereStr = `${this.whString(dbObj.dbName, tableObj.tableName, wh)}`;
      if(whereStr.length > 0) {
        this.where.push(whereStr);
      }
    });
  }

  pushHaving(having) {
    having.forEach(ha => {
      let havingStr = `${this.haString(ha)}`;
      if(havingStr.length > 0) {
        this.having.push(havingStr);
      }
    });
  }

  // █▀▀ ▀▀█▀▀ █▀▀█ ░▀░ █▀▀▄ █▀▀▀   █▀▀ █░░█ █▀▀▄ █▀▀ ▀▀█▀▀ ░▀░ █▀▀█ █▀▀▄ █▀▀
  // ▀▀█ ░░█░░ █▄▄▀ ▀█▀ █░░█ █░▀█   █▀▀ █░░█ █░░█ █░░ ░░█░░ ▀█▀ █░░█ █░░█ ▀▀█
  // ▀▀▀ ░░▀░░ ▀░▀▀ ▀▀▀ ▀░░▀ ▀▀▀▀   ▀░░ ░▀▀▀ ▀░░▀ ▀▀▀ ░░▀░░ ▀▀▀ ▀▀▀▀ ▀░░▀ ▀▀▀

  haString(ha) {
    if(ha.name && !this.validString(ha.name)) {
      return '';
    }
    if(ha.isnot && !this.validString(ha.isnot)) {
      return '';
    }
    if(ha.is && !this.validString(ha.is)) {
      return '';
    }
    if(!ha.or) {
      return `${ha.name} ${ha.is ? `= '${ha.is}'` : `!= '${ha.isnot}'`}`;
    }
    return `${ha.name} ${ha.is ? `= '${ha.is}'` : `!= '${ha.isnot}'`} OR ${this.haString(ha.or)}`;
  }

  whString(db, table, wh) {
    if(wh.is && !this.validString(wh.is)) return '';
    if(wh.isnot && !this.validString(wh.isnot)) return '';
    if(!wh.or) {
      return `${db}.${table}.${wh.name} ${wh.is ? `= '${wh.is}'` : `!= '${wh.isnot}'`}`;
    }
    return `${db}.${table}.${wh.name} ${wh.is ? `= '${wh.is}'` : `!= '${wh.isnot}'`} OR ${this.whString(db, table, wh.or)}`;
  }

  fnString(db, table, fn, args) {
    if(!this.validString(fn)) return '';
    return `${fn}(${args.map(arg => {
      if(arg.name) {
        return `${db}.${table}.${arg.name}`; 
      }
      if(arg.number && typeof arg.number === 'number') {
        return `${arg.number}`; 
      } else if(arg.number) {
        this.errors(arg.number + ' in fn object is not a number type');
      }
      if(arg.string && this.validString(arg.string)) {
        return `'${arg.string}'`;
      }
      if(arg.fn) {
        return this.fnString(db, table, arg.fn, arg.args);
      }
    }).join()})`
  }
  
  // █▀▀▄ █░░█ ░▀░ █░░ █▀▀▄ █▀▀ █▀▀█ █▀▀
  // █▀▀▄ █░░█ ▀█▀ █░░ █░░█ █▀▀ █▄▄▀ ▀▀█
  // ▀▀▀░ ░▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀░ ▀▀▀ ▀░▀▀ ▀▀▀

  buildSelect() {
    let select = '';
    if(this.select.length > 0) {
      select = `SELECT ${this.select.map(selStr => selStr).join()}`;
    }

    let from = `FROM ${this.from.db}.${this.from.table}`;

    let join = '';
    if(this.join.length > 0) {
      join = `${this.join.map(jStr => `LEFT JOIN ${jStr}`).join(' ')}`;
    }

    let where = '';
    if(this.where.length > 0) {
      where = `WHERE ${this.where.map(whStr => `(${whStr})`).join(' AND ')}`;
    }

    let having = '';
    if(this.having.length > 0) {
      having = `HAVING ${this.having.map(haStr => `(${haStr})`).join(' AND ')}`;
    }

    let orderBy = ''
    if(this.orderBy.length > 0) {
      orderBy =  `ORDER BY ${this.orderBy}`;
    }

    let ascOrDesc = ''
    if(this.ascOrDesc.length > 0) {
      ascOrDesc = this.ascOrDesc;
    }

    let limit = '';
    if(this.limit.length > 0) {
      limit = `LIMIT ${this.limit.map(num => num).join()}`
    }

    return `${select} ${from} ${join} ${where} ${having} ${orderBy} ${ascOrDesc} ${limit}`;

  }

  buildCreate() {
    let from = `INSERT INTO ${this.from.db}.${this.from.table}`;
    
    let columns = '';
    if(this.columns.length > 0) {
      columns = `(${this.columns.join()})`;
    }
    
    let values = '';
    if(this.values.length > 0) {
      values = `VALUES (${this.values.join()})`;
    }

    return `${from} ${columns} ${values}`;
  }

  buildUpdate() {
    let from = `UPDATE ${this.from.db}.${this.from.table}`;

    let set = '';
    if(this.columns.length === this.values.length && this.columns.length > 0 && this.values.length > 0) {
      set = `SET ${this.columns.map((col, i) => `${col} = ${this.values[i]}`).join()}`;
    }

    let where = '';
    if(this.where.length > 0) {
      where = `WHERE ${this.where.map(whStr => `(${whStr})`).join(' AND ')}`;
    } else if(!this.affectAll) {
      this.fatalError = true;
      this.errors.push('No where clause provided. If you want to update all records then add `affectAll: true` to your queryObject')
    }

    let having = '';
    if(this.having.length > 0) {
      having = `HAVING ${this.having.map(haStr => `(${haStr})`).join(' AND ')}`;
    }

    return `${from} ${set} ${where} ${having}`;
  }

  buildDelete() {
    let from = `DELETE FROM ${this.from.db}.${this.from.table}`;

    let where = '';
    if(this.where.length > 0) {
      where = `WHERE ${this.where.map(whStr => `(${whStr})`).join(' AND ')}`;
    } else if(!this.affectAll) {
      this.fatalError = true;
      this.errors.push('No where clause provided. If you want to delete all records then add `affectAll: true` to your queryObject')
    }

    return `${from} ${where}`;
  }

  // █░░█ ▀▀█▀▀ ░▀░ █░░ ░▀░ ▀▀█▀▀ ░▀░ █▀▀ █▀▀
  // █░░█ ░░█░░ ▀█▀ █░░ ▀█▀ ░░█░░ ▀█▀ █▀▀ ▀▀█
  // ░▀▀▀ ░░▀░░ ▀▀▀ ▀▀▀ ▀▀▀ ░░▀░░ ▀▀▀ ▀▀▀ ▀▀▀

  aliasReplicaTableNames(table) {
    let aliasTableName;
    const numOfReplicas = this.joinTables.filter(tableName => tableName === table).length;
    if(numOfReplicas > 0) {
      aliasTableName = this.aliasReplicaTableNames(table + Math.floor(Math.random() * Math.floor(1000)))
      return aliasTableName;
    } else {
      this.joinTables.push(table);
      return table;
    }
  }

  // ▀█░█▀ █▀▀█ █░░ ░▀░ █▀▀▄ █▀▀█ ▀▀█▀▀ ░▀░ █▀▀█ █▀▀▄
  // ░█▄█░ █▄▄█ █░░ ▀█▀ █░░█ █▄▄█ ░░█░░ ▀█▀ █░░█ █░░█
  // ░░▀░░ ▀░░▀ ▀▀▀ ▀▀▀ ▀▀▀░ ▀░░▀ ░░▀░░ ▀▀▀ ▀▀▀▀ ▀░░▀

  validBySchema(db, table, name) {
    if(!this.schema) {
      this.errors.push('A schema must be provided in order to use JsonQL')
      this.fatalError = true;
      return;
    }
    if(!db || (db || '').length === 0) {
      this.errors.push('No db name provided');
      this.fatalError = true;
      return false;
    }
    if(!this.schema[db]) {
      this.errors.push(db + ' db not found in schema');
      this.fatalError = true;
      return false;
    }
    if(table && !(this.schema[db] || {})[table]) {
      this.errors.push(db + '.' + table + ' not found in schema');
      this.fatalError = true;
      return false;
    }
    if(name && !((this.schema[db] || {})[table] || {})[name]) {
      this.errors.push(db + '.' + table + '.' + name + ' not found in schema');
      return false;
    }
    return true
  }

  validString(string) {
    const regex = /(drop )|;|(update )( truncate)/gi;
    if(regex.test(string)) {
      this.errors.push('The string \'' + string + '\' is not allowed');
      this.fatalError = true;
      return false;
    } else {
      return true;
    }
  }

}