const mysql = require('mysql2/promise');
const connection = require('../../scratchpad-bms-api/config/dbConfig');
class main {

  constructor(schema) {
    this.schema = schema;
    this.joinTables = [];

    this.select = [];
    this.from = '';
    this.join = [];
    this.where = [];
  }

  parseCols(db, table, columns) {
    const nameCols = columns.filter(col => col.name || col.number || col.string);
    const joinCols = columns.filter(col => col.join);
    const fnCols = columns.filter(col => col.fn);

    if(nameCols.length > 0) {
      this.selectNameCols(db, table, nameCols);
    }
    
    if(joinCols.length > 0) {
      this.selectJoinCols(db, table, joinCols);
    }

    if(fnCols.length > 0) {
      this.selectFnCols(db, table, fnCols);
    }
    
  }

  parseWhere(db, table, where) {
    where.forEach(wh => {
      let whereStr = `${this.whString(db, table, wh)}`;
      this.where.push(whereStr);
    });
  }

  whString(db, table, wh) {
    if(!wh.or) {
      return `${db}.${table}.${wh.name} ${wh.is ? `= '${wh.is}'` : `!= '${wh.isnot}'`}`;
    }
    return `${db}.${table}.${wh.name} ${wh.is ? `= '${wh.is}'` : `!= '${wh.isnot}'`} OR ${this.whString(db, table, wh.or)}`;
  }

  selectNameCols(db, table, nameCols) {
    nameCols.forEach(col => {
      let selectStr = '';
      if(col.name) {
        selectStr = `${db}.${table}.${col.name}`;
      }
      if(col.number) {
        selectStr = `${col.number}`;
      }
      if(col.string) {
        selectStr = `'${col.string}'`;
      }
      if(col.as) {
        selectStr += ` AS ${col.as}`;
      }

      this.select.push(selectStr);
    })
  }
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
  selectJoinCols(db, table, joinCols) {
    joinCols.forEach(col => {

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

      this.join.push(joinStr);

      this.parseCols(col.join.db, aliasTableName, col.join.columns);
    });
  }

  fnString(db, table, fn, args) {
    return `${fn}(${args.map(arg => {
      if(arg.name) {
        return `${db}.${table}.${arg.name}`; 
      }
      if(arg.number) {
        return `${arg.number}`; 
      }
      if(arg.string) {
        return `'${arg.string}'`;
      }
      if(arg.fn) {
        return this.fnString(db, table, arg.fn, arg.args);
      }
    }).join()})`
  }

  selectFnCols(db, table, fnCols) {

    fnCols.forEach(col => {
      let selectStr = this.fnString(db, table, col.fn, col.args)
      if(col.as) {
        selectStr += ` AS ${col.as}`;
      }
      this.select.push(selectStr)
    });
  }

  buildSelect() {

    let select = '*';
    if(this.select.length > 0) {
      select = `SELECT ${this.select.map(selStr => selStr).join()}`;
    }

    let from = `FROM ${this.from}`;

    let join = '';
    if(this.join.length > 0) {
      join = `${this.join.map(jStr => `LEFT JOIN ${jStr}`).join(' ')}`
    }

    let where = '';
    if(this.where.length > 0) {
      where = `WHERE ${this.where.map(whStr => `(${whStr})`).join(' AND ')}`
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
      ${limit}
    `
  }
  
  async selectQL({db, table, columns, where, limit}) {
    // TODO: Check keys and values
    
    this.from = `${db}.${table}`;

    if(columns && (columns || []).length > 0) {
      this.parseCols(db, table, columns);
    }

    if(where && (where || []).length > 0) {
      this.parseWhere(db, table, where);
    }

    if(limit) {
      this.limit = limit;
    }
    
    // console.log('this :', this);

    const selectQuery = this.buildSelect();

    const con = await mysql.createConnection(connection.biggly);

    let result;

    try {
      result = await con.query(selectQuery);
    } catch (error) {
      console.log('error :', error);
      con.close();
    }

    con.close();

    console.log('result :', result[0]);
  }

  
  

}


const ql = new main();

  // ## JoinObject                           ## WhereObject
                                        
  // const JoinObject = {                    const WhereObject = {
  //   db: String,                             name: String,
  //   table: String,                          is: String,
  //   where: [WhereObject],                   isnot: String,
  //   columns: [ColumnObject]                 or: WhereObject
  // }                                       }

  
  // ## ColumnObject                         
                                          
  // const ColumnObject = {                  
  //   name: String,                         
  //   string: String,                         
  //   number: String/Number,                         
  //   fn: String,
  //   args: [ColumnObject],
  //   as: String,                           
  //   join: JoinObject
  // }

ql.selectQL({
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
  where: [
    {
      name: 'bookingsKey',
      is: '0021ecb0-20ee-11ea-8236-771da2034d25',
    }
  ],
  limit: [0,5]
})