const mysql = require('mysql2/promise');
const connection = require('../../configs/bmsConfig');
const schema = require('../../bms-api/general/schema/admin');

class JsonQL {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
    this.fatalError = false;
    this.joinTables = [];

    this.select = [];
    this.from = '';
    this.join = [];
    this.having = [];
    this.where = [];
  }

  // █▀▀ █▀▀ █░░ █▀▀ █▀▀ ▀▀█▀▀
  // ▀▀█ █▀▀ █░░ █▀▀ █░░ ░░█░░
  // ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ░░▀░░

  selectQL({db, table, columns, where, having, limit}) {
    if(this.validBySchema(db, table)) {
      this.from = `${db}.${table}`;
    } else {
      return {
        status: 'error',
        errors: this.errors
      }
    }

    if(columns && (columns || []).length > 0) {
      this.parseCols(db, table, columns);
    }

    if(where && (where || []).length > 0) {
      this.pushWhere(db, table, where);
    }

    if(having && (having || []).length > 0) {
      this.pushHaving(having);
    }

    if(limit) {
      this.limit = limit;
    }

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

  // █▀▀█ █▀▀█ █▀▀█ █▀▀ █▀▀ █▀▀█ █▀▀
  // █░░█ █▄▄█ █▄▄▀ ▀▀█ █▀▀ █▄▄▀ ▀▀█
  // █▀▀▀ ▀░░▀ ▀░▀▀ ▀▀▀ ▀▀▀ ▀░▀▀ ▀▀▀

  parseCols(db, table, columns, aliasTableName = null) {
    if(!this.validBySchema(db, table)) {
      return;
    } else {
      this.db = db;
      this.table = table;
    }
    const nameCols = columns.filter(col => col.name || col.number || col.string);
    const joinCols = columns.filter(col => col.join);
    const fnCols = columns.filter(col => col.fn);

    if(nameCols.length > 0) {
      this.pushNameCols(
        db,
        aliasTableName ? aliasTableName : table,
        nameCols
      );
    }
 
    if(joinCols.length > 0) {
      this.pushJoinCols(
        db,
        aliasTableName ? aliasTableName : table,
        joinCols
      );
    }

    if(fnCols.length > 0) {
      this.pushFnCols(
        db,
        aliasTableName ? aliasTableName : table,
        fnCols
      );
    }

  }

  // █▀▀█ █░░█ █▀▀ █░░█   █▀▀ █░░█ █▀▀▄ █▀▀ ▀▀█▀▀ ░▀░ █▀▀█ █▀▀▄ █▀▀
  // █░░█ █░░█ ▀▀█ █▀▀█   █▀▀ █░░█ █░░█ █░░ ░░█░░ ▀█▀ █░░█ █░░█ ▀▀█
  // █▀▀▀ ░▀▀▀ ▀▀▀ ▀░░▀   ▀░░ ░▀▀▀ ▀░░▀ ▀▀▀ ░░▀░░ ▀▀▀ ▀▀▀▀ ▀░░▀ ▀▀▀

  pushNameCols(db, table, nameCols) {
    nameCols.forEach(col => {
      let selectStr = '';
      if(col.name && this.validBySchema(this.db, this.table, col.name)) {
        selectStr = `${db}.${table}.${col.name}`;
      }
      if(col.number && typeof col.number === 'number') {
        selectStr = `${col.number}`;
      } else if(col.number) {
        this.errors.push(col.number + ' is not a number');
      }
      if(col.string && this.validString(col.string)) {
        selectStr = `'${col.string}'`;
      }
      if(col.as && this.validString(col.as)) {
        selectStr += ` AS ${col.as}`;
      }

      if(selectStr.length > 0) {
        this.select.push(selectStr);
      }
    })
  }

  pushJoinCols(db, table, joinCols) {
    joinCols.forEach(col => {
      // TODO: fix the schema validation for joins, the aliasTableName breaks it.
      // if(!this.validBySchema(this.db, this.table, col.join.where[0].name)) {
      //   return;
      // }
      // These checks might break here because I think col.join.table might sometimes be an alias.
      // if(col.join.where[0].isnot && !this.validBySchema(col.join.db, col.join.table, col.join.where[0].isnot)) {
      //   return;
      // }
      // if(col.join.where[0].is && !this.validBySchema(col.join.db, col.join.table, col.join.where[0].is)) {
      //   return;
      // }

      let joinStr = '';
      let aliasTableName = this.aliasReplicaTableNames(col.join.table);
      let aliasString = '';

      if(col.join.table !== aliasTableName) {
        aliasString = ` AS ${aliasTableName}`;
      }
      if(col.join.where[0].isnot) {
        joinStr = `${col.join.db}.${col.join.table}${aliasString} ON ${db}.${table}.${col.join.where[0].name} != ${col.join.db}.${aliasTableName}.${col.join.where[0].isnot}`;
      }
      if(col.join.where[0].is) {
        joinStr = `${col.join.db}.${col.join.table}${aliasString} ON ${db}.${table}.${col.join.where[0].name} = ${col.join.db}.${aliasTableName}.${col.join.where[0].is}`;
      }

      if(joinStr.length > 0) {
        this.join.push(joinStr);
      }

      this.parseCols(col.join.db, col.join.table, col.join.columns, aliasTableName);
    });
  }

  pushFnCols(db, table, fnCols) {
    fnCols.forEach(col => {
      let selectStr = this.fnString(db, table, col.fn, col.args)
      if(col.as && this.validString(col.as)) {
        selectStr += ` AS ${col.as}`;
      }
      if(selectStr.length > 0) {
        this.select.push(selectStr)
      }
    });
  }

  pushWhere(db, table, where) {
    where.forEach(wh => {
      let whereStr = `${this.whString(db, table, wh)}`;
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

  // parseWhere(db, table, where) {
  //   where.forEach(wh => {
  //     let whereStr = `${this.whString(db, table, wh)}`;
  //     this.where.push(whereStr);
  //   });
  // }

  whString(db, table, wh) {
    if(!this.validBySchema(db, table, wh.name)) return '';
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
      if(arg.name && this.validBySchema(this.db, this.table, arg.name)) {
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

    let from = `FROM ${this.from}`;

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

    let limit = '';
    if(this.limit.length > 0) {
      limit = `LIMIT ${this.limit.map(num => num).join()}`
    }

    return `
      ${select}
      ${from}
      ${join}
      ${where}
      ${having}
      ${limit}
    `
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
    if(table && !this.schema[db][table]) {
      this.errors.push(db + '.' + table + ' not found in schema');
      this.fatalError = true;
      return false;
    }
    if(name && !this.schema[db][table][name]) {
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

const main = async() => {

  const ql = new JsonQL(schema);

  const queryOb = ql.selectQL({
    db: 'bms_booking',
    table: 'bookings',
    columns: [
      {name: 'bookingName'},
      {name: 'bookingsKey'},
      {join: {
        db: 'Biggly',
        table: 'users',
        columns: [
          {
            fn: 'CONCAT',
            args: [
              {name: 'firstName'},
              {string: ' '},
              {name: 'lastName'},
            ],
            as: 'createdName'
          }
        ],
        where: [{name: 'createdUserKey', is: 'userKey'}]
      }},
      {join: {
        db: 'Biggly',
        table: 'users',
        columns: [
          {
            fn: 'CONCAT',
            args: [
              {name: 'firstName'},
              {string: ' '},
              {name: 'lastName'},
            ],
            as: 'assignedName'
          }
        ],
        where: [{name: 'assignedUserKey', is: 'userKey'}]
      }}
    ],
    where: [{name: 'bookingsKey', is: '008da801-1744-11ea-9d83-65b05ef21e9b'}],
    having: [
      {name: 'createdName', is: 'Carl Williams'}
    ],
    limit: [0,5]
  });

  if(queryOb.status === 'error') {
    console.log(queryOb);
    return;
  }

  console.log(queryOb);
  // return;

  const con = await mysql.createConnection(connection);

  let result;

  try {
    result = await con.query(queryOb.query);
  } catch (error) {
    console.log('error :', error);
    con.close();
  }

  con.close();

  console.log('result :', result[0]);
}

main();
