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
      if(this.validJQString(db, table, key)) {
        this.pushQuery(db, table, key, data[key]);
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

  pushQuery(db, table, key, value) {
    // let key = '$jsonForm[?Booking Month].value';

    let column = this.jColString(db, table, key);
    let index = this.jInString(db, table, column, key);

    column = `${db}.${table}.${column}`;

    if(typeof value === 'string') {
      value = `'${value}'`;
    }

    value = `IF(
      JSON_SET(${column}, ${index}, ${value}) IS NOT NULL,
      JSON_SET(${column}, ${index}, ${value}),
      ${column}
    )`;

    this.columns.push(`${column}`);
    this.values.push(value);
    // IF(
    //   (JSON_SET(jsonForm, CONCAT('$[',SUBSTR(JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'), 4,  LOCATE(']', JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'))-4),'].value'),'boom') IS NOT NULL),
    //   JSON_SET(jsonForm, CONCAT('$[',SUBSTR(JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'), 4,  LOCATE(']', JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'))-4),'].value'),'boom'),
    //   jsonForm
    // )

  }

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
        selectStr = this.jExString(dbObj.dbName, tableObj.tableName, col.name);
      } else if(col.name && this.validBySchema(dbObj.dbName, tableObj.tableName, col.name)) {
        selectStr = `${dbObj.dbAlias}.${tableObj.tableAlias}.${col.name}`;
      } else if(col.number && typeof col.number === 'number') {
        selectStr = `${col.number}`;
      } else if(col.number) {
        this.errors.push(col.number + ' is not a number');
      } else if(col.string && this.validString(col.string)) {
        selectStr = `'${col.string}'`;
      } else if(col.jsonExtract && this.validString(col.jsonExtract.search) && this.validString(col.jsonExtract.target)) {
        selectStr = `JSON_EXTRACT(JSON_EXTRACT(${selectStr}, CONCAT('$[', SUBSTR(JSON_SEARCH(${selectStr}, 'all', '${col.jsonExtract.search}'), 4, 1), ']')), '$.${col.jsonExtract.target}')`;
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

  pushOrArrWhere(dbObj, tableObj, or) {
    let whereStr = `(${or.filter(wh => (

      this.validBySchema(dbObj.dbName, tableObj.tableName, wh.name) &&
      ( this.validString(wh.is) || this.validString(wh.isnot) )

    )).map(wh => {

      let value = 
        wh.is && typeof wh.is === 'number' ?
        `= ${wh.is}`
        :
        wh.is && typeof wh.is === 'string' ?
        `= '${wh.is}'`
        :
        wh.isnot && typeof wh.isnot === 'number' ?
        `!= ${wh.isnot}`        :
        wh.isnot && typeof wh.isnot === 'string' ?
        `!= '${wh.isnot}'`
        :
        '';
      return `${dbObj.dbName}.${tableObj.tableName}.${wh.name} ${value}`;

    }).join(' OR ')})`;

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
        ha.is && typeof ha.is === 'number' ?
        `= ${ha.is}`
        :
        ha.is && typeof ha.is === 'string' ?
        `= '${ha.is}'`
        :
        ha.isnot && typeof ha.isnot === 'number' ?
        `!= ${ha.isnot}`        :
        ha.isnot && typeof ha.isnot === 'string' ?
        `!= '${ha.isnot}'`
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
      // This check here is a bit out of place but we want to keep 
      // the old nested OR syntax so there it is.
      if(!wh.name && wh.or && (wh.or || []).length > 0) {
        this.pushOrArrWhere(dbObj, tableObj, wh.or);
        return;
      }
      
      if(!this.validBySchema(dbObj.dbName, tableObj.tableName, wh.name)) {
        return;
      }
      let whereStr = '';
      
      // Is this right? I don't think you can use alias names in a where...
      whereStr = `${this.whString(dbObj.dbName, tableObj.tableName, wh)}`;
      if(whereStr.length > 0) {
        this.where.push(whereStr);
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
    let whereStr = count.where.map(wh => this.countWhString(db, table, count.db, count.table, wh)).join();
    return `(SELECT COUNT(*) FROM ${count.db}.${count.table} WHERE ${whereStr})`;
  }
  
  jExString(db, table, jQString) {
    let str = this.jQStringMaker(db, table, jQString);
    console.log(str);
    return str;
    // let column = this.jColString(db, table, jQString);
    // let index = this.jInString(db, table, column, jQString);
    // return `JSON_EXTRACT(${column}, ${index})`;
  }

  jColString(db, table, jQString) {
    let column = jQString.slice(1, jQString.indexOf('['));
    if(!this.validBySchema(db, table, column)) return;
    return column;
  }

  jInString(db, table, column, jQString) {
    if(!this.validBySchema(db, table, column)) return;
    let index = jQString.slice(jQString.indexOf('[') + 1, jQString.indexOf(']'));
    let startBracket = '$[';
    let endBracketAndIfValue = jQString.slice(jQString.indexOf(']'), jQString.length);

    column = `${db}.${table}.${column}`;
    if(/^\?/.test(index)) {
      // Remove the ? from the search term index.
      index = index.slice(1, index.length);
      index = `CONCAT('${startBracket}',SUBSTR(JSON_SEARCH(${column},'one','${index}'),4,LOCATE(']',JSON_SEARCH(${column},'one','${index}'))-4),'${endBracketAndIfValue}')`;
      // CONCAT('$[',SUBSTR(JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'), 4,  LOCATE(']', JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'))-4)
    } else if(!this.validIndex(index)) {
      return;
    } else {
      // Put the brackets back for the query.
      index = `'${startBracket}${index}${endBracketAndIfValue}'`;
    }
    return index;
  }

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
    if((ha || []).length > 0 && typeof ha === 'object') {
      return this.orHaString(ha);
    }
    let value = 
      ha.is && typeof ha.is === 'number' ?
      `= ${ha.is}`
      :
      ha.is && typeof ha.is === 'string' ?
      `= '${ha.is}'`
      :
      ha.isnot && typeof ha.isnot === 'number' ?
      `!= ${ha.isnot}`        :
      ha.isnot && typeof ha.isnot === 'string' ?
      `!= '${ha.isnot}'`
      :
      '';
      
    if(!ha.or) {
      return `${ha.name} ${value}`;
    }
    return `${ha.name} ${value} OR ${this.haString(ha.or)}`;
  }

  orWhString(db, table, orArr) {
    return `${orArr.filter(or => (
      (or.name && this.validBySchema(db, table, or.name))
      &&
      (
        or.isnot && this.validString(or.isnot)
        ||
        or.is && this.validString(or.is)
      )
    )).map(or => {

    let value = 
      or.is && typeof or.is === 'number' ?
      `= ${or.is}`
      :
      or.is && typeof or.is === 'string' ?
      `= '${or.is}'`
      :
      or.isnot && typeof or.isnot === 'number' ?
      `!= ${or.isnot}`        :
      or.isnot && typeof or.isnot === 'string' ?
      `!= '${or.isnot}'`
      :
      '';
      
      return `${db}.${table}.${or.name} ${value}`;

    }).join(' OR ')}`
  }

  orHaString(orArr) {
    return `${orArr.filter(or => (
      (or.name && this.validString(or.name))
      &&
      (
        or.isnot && this.validString(or.isnot)
        ||
        or.is && this.validString(or.is)
      )
    )).map(or => {

    let value = 
      or.is && typeof or.is === 'number' ?
      `= ${or.is}`
      :
      or.is && typeof or.is === 'string' ?
      `= '${or.is}'`
      :
      or.isnot && typeof or.isnot === 'number' ?
      `!= ${or.isnot}`        :
      or.isnot && typeof or.isnot === 'string' ?
      `!= '${or.isnot}'`
      :
      '';
      
      return `${or.name} ${value}`;

    }).join(' OR ')}`
  }

  countWhString(inDb, inTable, whDb, whTable, wh) {
    if(wh.is && !this.validString(wh.is)) return '';
    if(wh.isnot && !this.validString(wh.isnot)) return '';
    let value = 
      wh.is && typeof wh.is === 'number' ?
      `= ${wh.is}`
      :
      wh.is && typeof wh.is === 'string' ?
      `= '${wh.is}'`
      :
      wh.isnot && typeof wh.isnot === 'number' ?
      `!= ${wh.isnot}`        :
      wh.isnot && typeof wh.isnot === 'string' ?
      `!= '${wh.isnot}'`
      :
      '';
    if(!wh.or) {
      return `${whDb}.${whTable}.${wh.name} ${value}`;
    }
    return `${whDb}.${whTable}.${wh.name} ${value} OR ${this.countWhString(inDb, inTable, whDb, whTable, wh.or)}`;
  }

  whString(db, table, wh) {
    if(wh.is && !this.validString(wh.is)) return '';
    if(wh.isnot && !this.validString(wh.isnot)) return '';
    if((wh || []).length > 0 && typeof wh === 'object') {
      return this.orWhString(db, table, wh);
    }
      let value = 
        wh.is && typeof wh.is === 'number' ?
        `= ${wh.is}`
        :
        wh.is && typeof wh.is === 'string' ?
        `= '${wh.is}'`
        :
        wh.isnot && typeof wh.isnot === 'number' ?
        `!= ${wh.isnot}`        :
        wh.isnot && typeof wh.isnot === 'string' ?
        `!= '${wh.isnot}'`
        :
        '';
    if(!wh.or) {
      return `${db}.${table}.${wh.name} ${value}`;
    }
    return `${db}.${table}.${wh.name} ${value} OR ${this.whString(db, table, wh.or)}`;
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

  // ░░▀ █▀▀█ █▀▀ ▀▀█▀▀ █▀▀█ ░▀░ █▀▀▄ █▀▀▀ █▀▀
  // ░░█ █░░█ ▀▀█ ░░█░░ █▄▄▀ ▀█▀ █░░█ █░▀█ ▀▀█
  // █▄█ ▀▀▀█ ▀▀▀ ░░▀░░ ▀░▀▀ ▀▀▀ ▀░░▀ ▀▀▀▀ ▀▀▀

  validJQString(db, table, key) {
    if(/^\$/.test(key)) {
      const name = key.slice(1, key.search(/[\.\[]/));
      if(!this.validBySchema(db, table, name)) return false;
      return true;
    }
    return false;
  }

  jqTestType(string, prevString) {
    let name = /\$\w+/;
    let index = /\[\d\]/;
    let target = /\.\w+/;
    let search = /\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\]/;

    if(index.test(string)) {
      // 'index';
      if(!this.validString(string)) return;
      return `JSON_EXTRACT(${prevString}, "$${string}")`
    }
    if(target.test(string)) {
      // 'target';
      if(!this.validString(string)) return;
      return `JSON_EXTRACT(${prevString}, "$${string}")`
    }
    if(search.test(string)) {
      // 'search';
      string = string.slice(2, -1);
      if(!this.validString(string)) return;
      return `JSON_EXTRACT(${prevString}, CONCAT('$[', SUBSTR(JSON_SEARCH(${prevString}, 'all', '${string}'), 4, 1), ']'))`;
    }
  }

  jQStringMaker(db, table, str) {

    let reg = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g

    const matches = str.match(reg);

    console.log(matches);

    let result = matches.reduce((arr, match, i) => {

      if(i === 0) {
        return [...arr, `${db}.${table}.${match.slice(1)}`];
      }
      return [...arr, this.jqTestType(match, arr[i-1])];

    }, []);

    console.log(result);

    return result[result.length - 1];

  }
}
