class main {

  // ## JoinObject                           ## WhereObject
                                        
  // const JoinObject = {                    const WhereObject = {
  //   db: String,                             name: String,
  //   table: String,                          is: String,
  //   where: [WhereObject],                   isnot: String,
  //   columns: [ColumnObject]                 or: [WhereObject]
  // }                                       }

  
  // ## ColumnObject                         ## FormatObject
                                          
  // const ColumnObject = {                  const FormatObject = {
  //   name: String,                           fn: String,
  //   string: String,                         args: [ColumnObject]
  //   as: String,                           }
  //   format: FormatObject,                
  //   join: JoinObject
  // }
  constructor(schema) {

    this.schema = schema;

    this.nameCols = [];
    this.formatCols = [];
    this.joinCols = [];

    this.Q = {
      select: [],
      from: {},
      join: [],
      where: [],
    }
  }
  parseCols(db, table, columns) {
    const nameCols = columns.filter(col => col.name)
    const joinCols = columns.filter(col => col.join)
    const formatCols = columns.filter(col => col.format)

    if(nameCols.length > 0) {
      this.selectNameCols(db, table, nameCols)
    }
    
    if(joinCols.length > 0) {
      this.selectJoinCols(joinCols);
    }

    if(formatCols.length > 0) {

    }

    
  }
  selectNameCols(db, table, nameCols) {
    nameCols.forEach(col => {
      let selectStr = `${db}.${table}.${col.name}`;
      if(col.as) {
        selectStr += ` AS ${col.as}`;
      }

      this.Q.select.push(selectStr);
    })
  }
  selectJoinCols(joinCols) {
    joinCols.forEach(col => {
      this.parseCols(col.db, col.table, col.columns);
    })
  }
  selectQL({db, table, columns, where}) {

    // TODO: Check keys and values
    this.parseCols(db, table, columns);
    
    console.log('this.Q.select :', this.Q.select);
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

ql.selectQL({
  db: 'bms_campaigns',
  table: 'bookings',
  columns: [
    {name: 'bookingName'},
    {name: 'bookingsKey'},
    {name: 'assignedUserKey'},
    {join: {
      db: 'bms_booking',
      table: 'bookingDivisions',
      columns: [
        {name: 'bookingDivName'}
      ],
      where: [{name: 'bookingDivKey', is: 'bookingDivKey'}]
    }}
  ],
  where: [
    {
      name: 'createdUserKey',
      is: 'cafc9f20-deae-11e9-be90-7deb20e96c9e',
    },
  ]
})