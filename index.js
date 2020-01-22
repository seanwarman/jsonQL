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

    this.pushPrimaryKey(db, table);

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
      if(this.validJQString(db, table, key)) {
        this.pushJQString(db, table, key, data[key]);
        return;
      }

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

  pushPrimaryKey(db, table) {
    let tableSchema = this.schema[db][table];
    Object.keys(tableSchema).forEach(key => {
      if(tableSchema[key].primaryKey && typeof tableSchema[key].primaryKey === 'function') {
        if(tableSchema[key].type === 'json') {
          this.errors.push('primaryKey must be either number or string type, check your schema for ' + db + '.' + table);
          return;
        }
        this.columns.push(`${key}`);
        let primaryKey = tableSchema[key].primaryKey();
        if(tableSchema[key].type === 'string') this.values.push(`'${primaryKey}'`);
        else
        if(tableSchema[key].type === 'number') this.values.push(`${primaryKey}`);
        else
        if(!tableSchema[key].type) this.values.push(`'${primaryKey}'`);
      }
    });
  }

  pushQuery(db, table, key, value) {
    // let key = '$jsonForm[?Booking Month].value';

    let column = this.extractColFromJQString(db, table, key);

    column = `${db}.${table}.${column}`;

    value = `IF(
      ${this.jQSet(db, table, key, value)} IS NOT NULL,
      ${this.jQSet(db, table, key, value)},
      ${column}
    )`;

    this.columns.push(`${column}`);
    this.values.push(value);
  }

  pushOrderBy(db, table, orderBy) {
    if(this.validJQString(db, table, orderBy.name)) {
      this.orderBy = this.jQExtract(db, table, orderBy.name);
    } else if(this.validBySchema(db, table, orderBy.name)) {
      this.orderBy = orderBy.name;
    }

    if(this.orderBy.length === 0) {
      return;
    }

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

    const nameCols = columns.filter(col => col.name || col.number || col.string || col.count);
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
      if(col.name && this.validJQString(dbObj.dbName, tableObj.tableName, col.name)) {
        selectStr = this.jQExtract(dbObj.dbName, tableObj.tableName, col.name);
      } else if(col.name && this.validBySchema(dbObj.dbName, tableObj.tableName, col.name)) {
        selectStr = `${dbObj.dbAlias}.${tableObj.tableAlias}.${col.name}`;
      } else if(col.number && typeof col.number === 'number') {
        selectStr = `${col.number}`;
      } else if(col.number) {
        this.errors.push(col.number + ' is not a number');
      } else if(col.string && this.validString(col.string)) {
        selectStr = `'${col.string}'`;
      } else if(col.jsonExtract && this.validString(col.jsonExtract.search) && this.validString(col.jsonExtract.target)) {
        selectStr = `JSON_EXTRACT(JSON_EXTRACT(${selectStr}, CONCAT('$[', SUBSTR(JSON_SEARCH(${selectStr}, 'one', '${col.jsonExtract.search}'), 4, 1), ']')), '$.${col.jsonExtract.target}')`;
      }
      if(col.count) {
        selectStr += this.countString(dbObj.dbName, tableObj.tableName, col.count);
      }
      // We can't have an `as` without something before it so also check the selectStr length
      if(col.as && this.validString(col.as) && selectStr.length > 0) {
        selectStr += ` AS ${col.as}`;
      }
      if(selectStr.length > 0) {
        this.select.push(selectStr);
      }
    })
  }

  pushJoinCols(dbObj, tableObj, joinCols) {
    joinCols.forEach(col => {
      // if(!this.validBySchema(dbObj.dbName, tableObj.tableName, col.join.where[0].name)) {
      //   return;
      // }
      // if(col.join.where[0].isnot) {
      //   if(!this.validBySchema(col.join.db, col.join.table, col.join.where[0].isnot)) return;
      // }
      // if(col.join.where[0].is) {
      //   if(!this.validBySchema(col.join.db, col.join.table, col.join.where[0].is)) return;
      // }
      let aliasTableName = this.aliasReplicaTableNames(col.join.table);
      let aliasString = '';
  
      if(col.join.table !== aliasTableName) {
        aliasString = ` AS ${aliasTableName}`;
      }
      let joinStr = `${col.join.db}.${col.join.table}${aliasString} ON ${this.joinWhString(
        dbObj.dbName,
        tableObj.tableName,
        col.join.db, 
        aliasTableName,
        col.join.where
      ).join(' AND ')}`;
      
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

  joinWhString(
    fromDB,
    fromTable,
    joinDB,
    joinTableOrAlias,
    where
  ) {

    return where.map(wh => {
      if(wh.length && typeof wh === 'object') {
        return this.joinWhString(
          fromDB,
          fromTable,
          joinDB,
          joinTableOrAlias,
          wh
        ).join(' OR ');
      }
      if(wh.isnot) {
        return `${fromDB}.${fromTable}.${wh.name} != ${this.nameOrPlainString(wh.isnot, joinDB, joinTableOrAlias)}`;
      }
      if(wh.is) {
        return `${fromDB}.${fromTable}.${wh.name} = ${this.nameOrPlainString(wh.is, joinDB, joinTableOrAlias)}`;
      }
      if(wh.isbetween) {
        return `${fromDB}.${fromTable}.${wh.name} BETWEEN ${wh.isbetween.map(val => (
          typeof val === 'string' ?
          this.nameOrPlainString(val, joinDB)
          :
          val
        )).join(' AND ')}`
      }
    })
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

  pushOrArrWhere(dbObj, tableObj, or) {
    let whereStr = '';
    or.forEach((wh, i) => {

      if(this.validJQString(dbObj.dbName, tableObj.tableName, wh.name)) {
        if(i !== 0) {
          whereStr += ' OR ';
        }
        whereStr += `${this.whString(dbObj.dbName, tableObj.tableName, wh)}`;
        return;
      }

      if(this.validBySchema(dbObj.dbName, tableObj.tableName, wh.name)) {
        if(i !== 0) {
          whereStr += ' OR ';
        }
        whereStr += `${this.whString(dbObj.dbName, tableObj.tableName, wh)}`;
        return;
      }
    });

    if(whereStr.length > 0) {
      this.where.push(whereStr);
    }
  }

  pushOrArrHaving(or) {
    let havingStr = `(${or.filter(ha => (

      this.validString(ha.name) &&
      ( this.validString(ha.is) || this.validString(ha.isnot) )

    )).map(ha => {

      let value = 
        ha.is ?
        `= ${ha.is}`
        :
        ha.isnot ?
        `!= ${ha.isnot}`        :
        :
        '';
      return `${ha.name} ${value}`;

    }).join(' OR ')})`;

    if(havingStr.length > 0) {
      this.having.push(havingStr);
    }
  }

  pushWhere(dbObj, tableObj, where) {
    where.forEach(wh => {

      let whereStr = '';
      if((wh || []).length > 0) {
        this.pushOrArrWhere(dbObj, tableObj, wh);
        return;
      }

      if(this.validJQString(dbObj.dbName, tableObj.tableName, wh.name)) {
        whereStr = `${this.whString(dbObj.dbName, tableObj.tableName, wh)}`;
        if(whereStr.length > 0) {
          this.where.push(whereStr);
          return;
        }
      }
      
      if(this.validBySchema(dbObj.dbName, tableObj.tableName, wh.name)) {
        whereStr = `${this.whString(dbObj.dbName, tableObj.tableName, wh)}`;
        if(whereStr.length > 0) {
          this.where.push(whereStr);
          return;
        }
      }
      
    });
  }

  pushHaving(having) {
    having.forEach(ha => {
      // This check here is a bit out of place but we want to keep 
      // the old nested OR syntax so there it is.
      if(!ha.name && ha.or && (ha.or || []).length > 0) {
        this.pushOrArrHaving(ha.or);
        return;
      }
      let havingStr = `${this.haString(ha)}`;
      if(havingStr.length > 0) {
        this.having.push(havingStr);
      }
    });
  }

  // █▀▀ ▀▀█▀▀ █▀▀█ ░▀░ █▀▀▄ █▀▀▀   █▀▀ █░░█ █▀▀▄ █▀▀ ▀▀█▀▀ ░▀░ █▀▀█ █▀▀▄ █▀▀
  // ▀▀█ ░░█░░ █▄▄▀ ▀█▀ █░░█ █░▀█   █▀▀ █░░█ █░░█ █░░ ░░█░░ ▀█▀ █░░█ █░░█ ▀▀█
  // ▀▀▀ ░░▀░░ ▀░▀▀ ▀▀▀ ▀░░▀ ▀▀▀▀   ▀░░ ░▀▀▀ ▀░░▀ ▀▀▀ ░░▀░░ ▀▀▀ ▀▀▀▀ ▀░░▀ ▀▀▀

  countString(db, table, count) {
    let whereStr = count.where.map(wh => this.whString(count.db, count.table, wh)).join();
    return `(SELECT COUNT(*) FROM ${count.db}.${count.table} WHERE ${whereStr})`;
  }

  orWhString(db, table, orArr) {
    return `${orArr.filter(or => {
      if(or.name) {
        if(this.validName(db, table, or.name)) {
          return true;
        }
        if(this.validJQString(db, table, or.name)) {
          return true;
        }
        if(this.validBySchema(db, table, or.name)) {
          return true;
        }
        return false;
      }
    }).map(or => {

      return this.whString(db, table, or);

    }).join(' OR ')}`
  }

  orHaString(orArr) {
    return `${orArr.filter(or => (

      or.name && this.validString(or.name)

    )).map(or => {

      return this.haString(or);

    }).join(' OR ')}`
  }

  whString(db, table, wh) {
    if(wh.is && !this.validString(wh.is)) return '';
    if(wh.isnot && !this.validString(wh.isnot)) return '';
    if(wh.isbetween && !this.validString(wh.isbetween[0])) return '';
    if(wh.isbetween && !this.validString(wh.isbetween[1])) return '';

    if((wh || []).length > 0 && typeof wh === 'object') {
      return this.orWhString(wh);
    }

    let name = this.validJQString(db, table, wh.name) ?
      this.jQExtract(db, table, wh.name)
      :
      `${db}.${table}.${wh.name}`

    let value = 
      wh.is ?
      `= ${this.nameOrPlainString(wh.is, db, table)}`
      :
      wh.isnot ?
      `!= ${this.nameOrPlainString(wh.isnot, db, table)}`
      :
      wh.isbetween ?
      `BETWEEN ${wh.isbetween.map(val => (
        this.nameOrPlainString(val, db, table)
      )).join(' AND ')}`
      :
      '';

    return `${name} ${value}`;
  }

  haString(ha) {
    if(ha.name && !this.validString(ha.name)) {
      return '';
    }
    if((ha || []).length > 0 && typeof ha === 'object') {
      return this.orHaString(ha);
    }

    let name = this.validPlainJQString(ha.name) ?
      this.plainjQExtract(ha.name)
      :
      `${ha.name}`

    let value = 
      this.validString(ha.is) ?
      `= ${ha.is}`
      :
      this.validString(ha.isnot) ?
      `!= ${ha.isnot}`
      :
      ha.isbetween ?
      `BETWEEN ${ha.isbetween.map(val => (
        this.validString(val) &&
        val
      )).join(' AND ')}`
      :
      '';
      
    return `${name} ${value}`;
  }

  fnString(db, table, fn, args) {
    if(!this.validString(fn)) return '';
    return `${fn}(${args.map(arg => {
      if(this.validJQString(db, table, arg.name)) {
        return this.jQExtract(db, table, arg.name);
      } else if(arg.name) {
        
        return this.nameOrPlainString(arg.name, db, table);
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

  validIndex(index) {
    if(Number(index) === NaN) {
      this.errors.push('The index given to the json selector is not a number, if you\'re trying to search add a ? to the start of your string');
      this.fatalError = true;
      return false;
    }
    return true;
  }

  validBySchema(db, table, name) {
    if(!this.schema) {
      this.errors.push('A schema must be provided in order to use JsonQL')
      this.fatalError = true;
      return false;
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
    const regex = /(drop )|;|(update )|( truncate)/gi;
    if(regex.test(string)) {
      this.errors.push('The string \'' + string + '\' is not allowed');
      this.fatalError = true;
      return false;
    } else {
      return true;
    }
  }

  // ░░▀ █▀▀█ █▀▀ ▀▀█▀▀ █▀▀█ ░▀░ █▀▀▄ █▀▀▀ █▀▀
  // ░░█ █░░█ ▀▀█ ░░█░░ █▄▄▀ ▀█▀ █░░█ █░▀█ ▀▀█
  // █▄█ ▀▀▀█ ▀▀▀ ░░▀░░ ▀░▀▀ ▀▀▀ ▀░░▀ ▀▀▀▀ ▀▀▀

  extractColFromJQString(db, table, jQString) {
    let column = jQString.slice(1, jQString.search(/[\.\[]/));
    if(!this.validBySchema(db, table, column)) return;
    return column;
  }

  validJQString(db, table, jQString) {
    if(/^\$/.test(jQString)) {
      // Add a match here and check any string inside that begins with a $, that way we can target more than one column in a jqstring.
      const column = jQString.slice(1, jQString.search(/[\.\[]/));
      if(!this.validBySchema(db, table, column)) return false;
      return true;
    }
    return false;
  }

  validPlainJQString(jQString) {
    if(/^\$/.test(jQString)) {
      // Add a match here and check any string inside that begins with a $, that way we can target more than one column in a jqstring.
      const column = jQString.slice(1, jQString.search(/[\.\[]/));
      if(!this.validString(column)) return false;
      return true;
    }
    return false;
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
      if(!this.validString(string)) return;
      return `CONCAT(${prevString}, "${string}")`
    }
    if(target.test(string)) {
      // 'target';
      if(!this.validString(string)) return;
      return `CONCAT(${prevString}, "${string}")`
    }
    if(search.test(string)) {
      // 'search';
      string = string.slice(2, -1);
      if(!this.validString(string)) return;
      return `CONCAT(${prevString}, CONCAT('[',SUBSTR(JSON_SEARCH(JSON_EXTRACT(${name}, "$"),'one','${string}'), 4,LOCATE(']',JSON_SEARCH(JSON_EXTRACT(${name}, "$"), 'one', '${string}'))-4),']'))`;
    }
  }

  jQStringMaker(name, matches) {
    let result = matches.reduce((arr, match, i) => {
      return [...arr, this.jQString(name, match, arr[i-1])];
    }, []);

    return result[result.length - 1];
  }

  plainjQExtract(jQStr) {
    const regx = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g
    const matches = jQStr.match(regx);
    const name = `${matches[0].slice(1)}`
    return `JSON_UNQUOTE(JSON_EXTRACT(${name}, ${this.jQStringMaker(name, matches)}))`;
  }

  jQExtract(db, table, jQStr) {
    const regx = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g
    const matches = jQStr.match(regx);
    const name = `${db}.${table}.${matches[0].slice(1)}`
    return `JSON_UNQUOTE(JSON_EXTRACT(${name}, ${this.jQStringMaker(name, matches)}))`;
  }

  jQSet(db, table, jQStr, value) {
    if(typeof value === 'string') {
      value = `'${value}'`;
    }
    const regx = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g
    const matches = jQStr.match(regx);
    const name = `${db}.${table}.${matches[0].slice(1)}`
    return `JSON_SET(${name}, ${this.jQStringMaker(name, matches)}, ${value})`;
  }

  // ▀█░█▀ █▀▀▄ █▀▀█ █▀▄▀█ █▀▀ █▀▀
  // ░█▄█░ █░░█ █▄▄█ █░▀░█ █▀▀ ▀▀█
  // ░░▀░░ ▀░░▀ ▀░░▀ ▀░░░▀ ▀▀▀ ▀▀▀

  nameOrPlainString(value, db, table) {
    if(typeof value === 'number') {
      return value;
    }
    let regx = /^['"`].+['"`]$/g
    if(regx.test(value) && this.validString(value)) {
      return `${value}`;
    } else if (this.validBySchema(db, table, value)) {
      return `${db}.${table}.${value}`;
    }
    return '';
  }

  validName(db, table, string) {
    let regx = /^['"`].+['"`]$/g
    if(regx.test(string)) {
      return this.validString(string);
    }
    return false;
  }
}
