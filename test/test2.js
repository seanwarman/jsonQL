class main {

  // ## JoinObject                           ## WhereObject

  // const JoinObject = {                    const WhereObject = {
  //   db: String,                             name: String,
  //   table: String,                          is: String,
  //   where: [WhereObject],                   isnot: String,
  //   columns: [ColumnObject]                 or: [WhereObject]
  // }                                       }


  // ## ColumnObject                         

  // const ColumnObject = {                  
  //   name: String,                         
  //   fn: String,
  //   args: [ColumnObject],
  //   as: String,                           
  //   join: JoinObject
  // }

  constructor(schema) {

    this.schema = schema;

    this.Q = {
      select: [],
      from: '',
      join: [],
      where: [],
    }
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
      let whereStr = `(${this.whString(db, table, wh)})`;
      this.Q.where.push(whereStr);
    });
  }

  whString(db, table, wh) {
    if(!wh.or) {
      return `${db}.${table}.${wh.name} = '${wh.is}'`;
    }
    return `${db}.${table}.${wh.name} = '${wh.is}' OR ${this.whString(db, table, wh.or)}`;
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

      this.Q.select.push(selectStr);
    })
  }

  selectJoinCols(db, table, joinCols) {
    joinCols.forEach(col => {

      let joinStr = `LEFT JOIN ${col.join.db}.${col.join.table} ON ${db}.${table}.${col.join.where[0].name} = ${col.join.db}.${col.join.table}.${col.join.where[0].is}`;

      this.Q.join.push(joinStr);

      this.parseCols(col.join.db, col.join.table, col.join.columns);
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
      this.Q.select.push(selectStr)
    });
  }

  selectQL({db, table, columns, where}) {
    // TODO: Check keys and values
    this.Q.from = `${db}.${table}`;
    this.parseCols(db, table, columns);
    this.parseWhere(db, table, where);
    
    console.log('this.Q :', this.Q);
    // const selectQuery = `
    //   SELECT
    //   ${this.select.map(s => 
    //     `${s.db}.${s.table}.${s.name}${s.as ? `AS ${s.as}` : ''}`
    //   ).join()}

    //   FROM
    //   ${this.from.db}.${this.from.table}

    //   WHERE
    //   ${this.where.map((w,i) => 
    //     `(${db}.${table}.${w.name} = '${w.is}')`
    //   ).join('AND')}
    // `

    // console.log('selectQuery :', selectQuery);
  }

  
  

}


const ql = new main();

  // ## JoinObject                           ## WhereObject
                                        
  // const JoinObject = {                    const WhereObject = {
  //   db: String,                             name: String,
  //   table: String,                          is: String,
  //   where: [WhereObject],                   isnot: String,
  //   columns: [ColumnObject]                 or: [WhereObject]
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
  db: 'bms_campaigns',
  table: 'bookings',
  columns: [
    {name: 'bookingName'},
    {name: 'bookingsKey'},
    {name: 'assignedUserKey'},
    {
      fn: 'JSON_EXTRACT',
      args: [
        { fn: 'JSON_EXTRACT', args: [
          { name: 'jsonForm' },
          { fn: 'CONCAT' , args: [
            {string: '$['},
            {fn: 'SUBSTRING', args: [
              {fn: 'JSON_SEARCH', args: [
                {name: 'jsonForm'},
                {string: 'all'},
                {string: 'Booking Month'},
              ]},
              {number: 4},
              {number: 1},
            ]},
            {string: ']'}
          ]}
        ]},
        {string: '$.value'},
      ],
      as: 'bookingMonth'
    },
    {join: {
      db: 'bms_booking',
      table: 'bookingDivisions',
      columns: [
        {
          name: 'bookingName'
        },
      ],
      where: [{name: 'bookingDivKey', is: 'bookingDivKey'}]
    }},
  ],
  where: [
    {
      name: 'assignedUserKey',
      is: 'cafc9f20-deae-11e9-be90-7deb20e96c9e',
      or: {
        name: 'thingy', is: 'stuff'
      }
    },
    {
      name: 'createdUserKey',
      is: 'cafc9f20-deae-11e9-be90-7deb20e96c9e',
    },
  ]
})
