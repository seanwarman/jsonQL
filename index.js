module.exports = class JsonQL {
  constructor(schema) {

    this.checkSchemaForIds(schema)

    this.schema = schema;
    this.errors = [];
    this.fatalError = false;

    this.select = '';
    this.from = '';
    this.where = '';

    this.masterDbTable = '';
    this.customFns = {};
    this.customObj = {};
    this.nestedAS = '';
    this.nestedAsNames = [];
  }

  checkSchemaForIds(schema) {
    if(!schema) throw Error('Jseq always requires a schema object.')

    const dbs = Object.keys(schema).map(key => key)

    if(dbs.length === 0) return

    dbs.forEach(dbName => {

      const tables = Object.keys(schema[dbName]).map(key => key)

      if(tables.length === 0) return


      tables.forEach(tableName => {

        const columns = Object.keys(schema[dbName][tableName]).map(key => key)

        let count = 0

        columns.forEach(colName => {

          if(schema[dbName][tableName][colName].primary) count++

        })

        if(count !== 1) throw Error('Every table in a jseq schema must have a single column with primary set to true')


      })

    })

  }

  // addCustomFns=>
  addCustomFns(customFns, customObj) {
    this.customFns = customFns;
    this.customObj = customObj;
  }

  // +~====***************====~+
  // +~====**ENTRYPOINTS**====~+
  // +~====***************====~+

  async createFromSchema(fetchSchema) {


    let query = await this.buildSchemaQuery(fetchSchema)

    if(this.fatalError) {
      return {
        status: 'error',
        errors: this.errors,
        query
      }
    }

    return {
      status: 'success',
      errors: this.errors,
      query
    }

  }


  selectSQ(queryObj) {

    if(!queryObj.columns) return {
      status: 'error',
      errors: ['Every Jsequel select must have at least one columns object'],
      query: ''
    }

    let query = ''
    let treeMap = []

    // If the `name` has a custom function return that only.
    if(/^\w+=>/.test(queryObj.name)) {

      query = this.funcString(queryObj.name)

    } else {

      treeMap = this.buildTreeMap(queryObj.columns)
      query = this.buildSelect(queryObj, treeMap);

    }

    if(this.fatalError) {
      return {
        status: 'error',
        errors: this.errors,
        query
      }
    }

    return {
      status: 'success',
      errors: this.errors,
      query
    }
  }

  createSQ(queryObj, data) {
    let query = ''

    if(/^\w+=>/.test(queryObj.name)) {

      query = this.funcString(queryObj.name, data)

    } else {

      query = this.buildCreate(queryObj, data);

    }


    if(this.fatalError) {
      return {
        status: 'error',
        errors: this.errors,
        query
      }
    }

    return {
      status: 'success',
      errors: this.errors,
      query
    }
  }
  updateSQ(queryObj, data) {
    let query = ''

    if(/^\w+=>/.test(queryObj.name)) {

      query = this.funcString(queryObj.name, data)

    } else {

      query = this.buildUpdate(queryObj, data);
    }

    if(this.fatalError) {
      return {
        status: 'error',
        errors: this.errors,
        query
      }
    }

    return {
      status: 'success',
      errors: this.errors,
      query
    }
  }
  deleteSQ(queryObj) {
    let query = ''

    if(/^\w+=>/.test(queryObj.name)) {

      query = this.funcString(queryObj.name)

    } else {

      query = this.buildDelete(queryObj);
    }


    if(this.fatalError) {
      return {
        status: 'error',
        errors: this.errors,
        query
      }
    }

    return {
      status: 'success',
      errors: this.errors,
      query
    }
  }

  // +~====********====~+
  // +~====**DATA**====~+
  // +~====********====~+

  setValueString(value) {
    if(!value && value !== 0) return null;
    if(typeof value === 'object' && value.forEach) {
      return `JSON_ARRAY(${value.map(val => this.setValueString(val)).join()})`;
    }
    if(typeof value === 'object' && !value.forEach) {
      return `JSON_OBJECT(${Object.keys(value).map(key => `${this.setValueString(key)}, ${this.setValueString(value[key])}`).join()})`;
    }
    if(typeof value === 'boolean') {
      return `${value}`;
    }
    if(typeof value === 'number') {
      return `${value}`;
    }
    if(typeof value === 'string' && value === 'NULL') {
      return `NULL`;
    }
    if(typeof value === 'string') {
      return `'${value}'`;
    }
  }

  setJQString(db, table, key, value) {
    if(!value && value !== 0) return;
    let column = this.extractColFromJQString(db, table, key);

    value = `IF(
      ${this.jQSet(db, table, key, value)} IS NOT NULL,
      ${this.jQSet(db, table, key, value)},
      ${column}
    )`;

    return {column, value};
  }

  parseData(db, table, data) {
    let values = [];
    let columns = [];
    Object.keys(data).forEach(key => {
      let col;
      let val;
      if(/^\$/.test(key)) {
        let jqObj = this.setJQString(db,table,key,this.setValueString(data[key]));
        if(!jqObj) return;
        col = jqObj.column;
        val = jqObj.value;
      } else {
        val = this.setValueString(data[key]);
        col = key;
      }
      if(!val && val !== 0) return;
      if(!this.columnValid(db, table, col)) return;
      columns.push(col);
      values.push(val);
    });
    return {columns, values}
  }

  // +~====************====~+
  // +~====**'SCHEMA'**====~+
  // +~====************====~+

  async buildSchemaQuery(fetchSchema) {

    let oldSchema = []

    if(fetchSchema) {
      oldSchema = await fetchSchema(`

        SELECT

        TABLE_NAME AS tableName,
        COLUMN_NAME AS colName,
        DATA_TYPE AS type,
        COLUMN_TYPE AS longType,
        CHARACTER_MAXIMUM_LENGTH AS maxLength,
        IS_NULLABLE AS isNullable,
        COLUMN_KEY AS columnKey,
        EXTRA AS extra

        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_schema = '${Object.keys(this.schema)[0]}'

      `)

      oldSchema = this.convertIntLengths(oldSchema)
    }


    let newSchema = this.formatJseqSchema()

    const deletes = this.deleteFromOldSchema(oldSchema, newSchema)
    console.log('deletes : ', deletes)

    const updates = this.updateFromNewSchema(newSchema, oldSchema)
    console.log('updates : ', updates)

    return [
      ...deletes,
      ...updates
    ]

  }

  convertIntLengths(schema) {
    return schema.map(item => {
      if(item.type === 'int') {

        const start = item.longType.indexOf('(') + 1
        const end = item.longType.indexOf(')')
        item.maxLength = Number(item.longType.slice(start, end))

      }
      return item
    })
  }

  updateFromNewSchema(newSchema, oldSchema) {

    let query = []

    let alreadyCreated = []

    newSchema.forEach(item => {

      // Find any tables the old schema doesn't have...
      const tableItem = oldSchema.find(oldItm =>
        item.tableName === oldItm.tableName
      )

      // If this item's table has already been created, so
      // have all the columns so ignore this item
      if(alreadyCreated.includes(item.tableName)) return

      // If the old schema doesn't have this table and we haven't already made
      // a create query for it, make one now...
      if(tableItem === undefined) {

        // Create that table with all cols
        // Grab all the newSchema items for this table
        const items = newSchema.filter(it => it.tableName === item.tableName)
        query.push(this.createTable(items))

        // Make a note of the created table
        alreadyCreated.push(item.tableName)

        return
      }

      // Now this item is definitely a table that the
      // old schema already has.
      // Find any columns the oldSchema doesn't have...
      const columnItem = oldSchema.find(oldItm =>
        item.tableName === oldItm.tableName &&
        item.colName   === oldItm.colName
      )

      // If we didn't find this tableName and colName
      // combination in the oldSchema then this column
      // needs to be created.
      if(columnItem === undefined) {
        // Alter table and ADD COLUMN
        query.push(this.addColumn(item))
        return
      }

      // This colName and tableName combination is in the oldSchema
      // so now we need to check to see if any of the other parameters
      // are different.
      // We can use the columnItem we found in the previous step.

      // console.log('old columnItem: ', columnItem)

      // console.log('new columnItem: ', item)

      const type       = columnItem.type       !== item.type
      const maxLength  = columnItem.maxLength  !== item.maxLength
      const isNullable = columnItem.isNullable !== item.isNullable
      const columnKey  = columnItem.columnKey  !== item.columnKey
      const extra      = columnItem.extra      !== item.extra
      const deflt      = columnItem.default    !== item.default

      // If any of the columns have changed...
      if(type || maxLength || isNullable || columnKey || extra || deflt) {


        // First check to see if the primary key has changed
        if(columnKey) {

          // Drop the existing primary key, which is thankfully very easy
          query.push(this.dropPrimary(item))

        }

        // Then the rest can all be modified at once...
        query.push(this.modColumn(item))


      }

    })

    return query

  }

  deleteFromOldSchema(oldSchema, newSchema) {
    let query = []
    let alreadyDeleted = []

    // We only need to delete items from the old schema where the 
    // tableName or the colName can't be found in the new schema.
    oldSchema.forEach(item => {

      const tableItem = newSchema.find(newItm =>
        item.tableName === newItm.tableName
      )

      // If this table has already been deleted ignore this item.
      if(alreadyDeleted.includes(item.tableName)) return

      if(tableItem === undefined) {

        // We need to delete this table
        query.push(this.delTable(item))
        alreadyDeleted.push(item.tableName)

        return
      }

      const columnItem = newSchema.find(newItm =>
        item.tableName === newItm.tableName &&
        item.colName   === newItm.colName
      )


      if(columnItem === undefined) {
        // We need to delete this column
        query.push(this.deleteColumn(item))
        return
      }

    })


    return query
  }


  delTable(item) {
    return `DROP TABLE \`${item.tableName}\``
  }

  deleteColumn(item) {
    return `ALTER TABLE \`${item.tableName}\` DROP COLUMN \`${item.colName}\``
  }

  columnConditions(item) {
    return `\`${item.colName}\` ${item.type}${
      item.maxLength ?
      `(${item.maxLength})`
      :
      item.type === 'int' ?
      '(11)'
      :
      item.type === 'varchar' ?
      '(200)'
      :
      ''
    }${
      item.isNullable === 'NO'             ? ' NOT NULL'       : ''
    }${
      item.columnKey  === 'PRI'            ? ' PRIMARY KEY'    : ''
    }${
      item.default ? ` DEFAULT ${item.default}` : ''
    }${
      item.extra === 'auto_increment' ? 
      ' AUTO_INCREMENT' 
      :
      item.extra === 'on update CURRENT_TIMESTAMP' ? 
      ' on update CURRENT_TIMESTAMP'
      :
      ''
    }`
  }

 //  colName: 'userId',
 //  type: 'int',
 //  maxLength: 200,
 //  isNullable: 'NO',
 //  columnKey: '',
 //  default: undefined

  dropPrimary(item) {
    return `ALTER TABLE ${item.tableName} DROP PRIMARY KEY`
  }

  modColumn(item) {
    return `ALTER TABLE \`${item.tableName}\` MODIFY ${this.columnConditions(item)}`
  }

  addColumn(item) {
    return `ALTER TABLE \`${item.tableName}\` ADD COLUMN ${this.columnConditions(item)}`
  }

  createTable(items) {
    return `CREATE TABLE \`${items[0].tableName}\` (
      ${items.map(it => (
        this.columnConditions(it)
      )).join()}
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8`
  }

  convertTypeToJseq(type) {
    if(type === 'varchar') return 'string'
    if(type === 'int') return 'number'
    if(type === 'timestamp') return 'date'
    if(type === 'json') return 'json'
    return 'string'
  }

  convertTypeToSQL(type) {
    if(type === 'string') return 'varchar'
    if(type === 'number') return 'int'
    if(type === 'date') return 'timestamp'
    if(type === 'json') return 'json'
    return 'varchar'

  }

  formatJseqSchema() {
    // Get the dbName for clarity...
    const dbName = Object.keys(this.schema)[0]

    // Select it, we're only working on one db
    // at a time...
    const schemaDb = this.schema[dbName]

    return Object.keys(schemaDb).reduce((arr, table) => {


      return [...arr, ...Object.keys(schemaDb[table]).map(col => {

        // Convert all the jseq schema keys and values into their equivelent
        // mysql information schema keys and values.

        const column = schemaDb[table][col]

        const type = this.convertTypeToSQL(column.type)

        const maxLength = 
          column.type === 'date' ? 
          null 
          : 
          column.type === 'json' ?
          null
          :
          column.type === 'number' ? 
          (column.maxLength || 11)
          :
          (column.maxLength || 200)

        const deflt = 
          column.default === 'create' ?
          'CURRENT_TIMESTAMP'
          :
          column.default === 'update' ?
          'CURRENT_TIMESTAMP'
          :
          column.default === 'auto' ?
          ''
          :
          column.default ? `${column.default}` : undefined
          
        const extra =
          column.default === 'update' ?
          'on update CURRENT_TIMESTAMP'
          :
          column.default === 'auto' ?
          'auto_increment'
          :
          ''




        const columnKey = column.primary ? 'PRI' : ''

        const isNullable = 
          column.primary  ? 'NO'
          :
          column.required ? 'NO' 
          : 
          'YES'

        return {
          tableName: table,
          colName: col,
          type,
          maxLength,
          isNullable,
          columnKey,
          extra,
          default: deflt
        }
      })]

    }, [])
  }

  // +~====************====~+
  // +~====**'SELECT'**====~+
  // +~====************====~+
  buildSelect(queryObj, treeMap) {

    let {
      db,
      table,
      sort,
      limit,
      where,
      having,
      group
    } = this.splitSelectItems(queryObj, queryObj.name)

    // This comes in handy.
    this.masterDbTable = `${db}.${table}`

    if(where.length > 0) where   = this.setStringArray('where', queryObj, ' WHERE ')
    if(group.length > 0) group   = this.setStringArray('group', queryObj, ' GROUP BY ')
    if(having.length > 0) having = this.setStringArray('having', queryObj, ' HAVING ')
    if(sort.length > 0) sort     = this.setString(sort, ' ORDER BY ')
    if(limit.length > 0) limit   = this.setLimitString(limit)


    // treeMap is an array of indexes showing us where everything
    // is in queryObj.columns.

    const columns = treeMap.reduce((array, tree, i) => {

      // We want to make an array of all the different column selections for
      // our query. SQL will only let you select a single column in a nested
      // query so we have to start at the top and work our way down for each one.
      const column = this.buildColumnsFromTree(queryObj.columns, tree)

      // buildColumnsFromTree returns null if there's an error with the 
      // column so miss this one out if that's the case...
      if(!column) return array

      return [ ...array, `${column}${this.nestedAsNames[i]}` ]

    }, [])

    if(columns.length === 0) {
      this.fatalError = true
      this.errors.push('There must be at least one valid column in a JSeq select.')
    }

    // Finally put all the columns into a master selection and return the result.
    return `SELECT ${columns.join()} FROM ${db}.${table}${where}${group}${having}${sort}${limit}`

  }

  buildColumnsFromTree(columns, tree, index = 0, prevDbTable = this.masterDbTable) {

    const col = columns[tree[index]]

    let name = ''
    if(col.name) name = col.name

    let as = ''
    if(col.as) as = this.setString(col.as, ' AS ')

    let sort = ''
    if(col.sort) sort = this.setString(col.sort, ' ORDER BY ')

    let limit = ''
    if(col.limit) limit = this.setLimitString(col.limit)

    let where = ''
    if(col.where) where = this.setStringArray('where', col, ' WHERE ')

    let group = ''
    if(col.group) group = this.setStringArray('group', col, ' GROUP BY ')


    // If we're at the last tree return the name and add an as to the
    // top level.
    if(tree[index+1] === undefined || as.length > 0) {


      // We often need the as name at the top level, outside of the nested
      // selects so we store it here. If there's no as in the cols object
      // we still want it otherwise mysql will give us the long selection
      // as a key name in our result.
      this.nestedAsNames.push(as.length > 0 ? as : ` AS ${name}`)

      // At the final step the nameRouter function converts any fancy names 
      // into a boring old sql string.
      return this.nameRouter(col, prevDbTable)
    }

    // The other option is we keep digging...
    return `(SELECT ${this.buildColumnsFromTree(col.columns, tree, index+1, col.name)} FROM ${name}${where}${group}${limit}${sort})`

  }

  // +~====************====~+
  // +~====**'CREATE'**====~+
  // +~====************====~+

  buildCreate(queryObj, data) {

    const {db, table} = this.splitDbAndTableNames(queryObj.name);

    if(!(this.schema[db] || {})[table]) {
      this.errors.push(`${db}.${table} not found in schema`)
      this.fatalError = true
    }

    let insert = `INSERT INTO ${db}.${table}`;

    let {columns, values} = this.parseData(db, table, data);
    if(values.length === 0) {
      this.fatalError = true
      this.errors.push('There must be at least one value when creating a record.')
    }
    if(columns.length === 0) {
      this.fatalError = true
      this.errors.push('There must be at least one column when creating a record.')
    }
    let set = ` (${columns.map(c => c).join()}) VALUES (${values.map(v => v).join()})`;
    return `${insert}${set}`;
  }

  // +~====************====~+
  // +~====**'UPDATE'**====~+
  // +~====************====~+

  buildUpdate(queryObj, data) {

    const {db, table} = this.splitDbAndTableNames(queryObj.name);

    if(!(this.schema[db] || {})[table]) {
      this.errors.push(`${db}.${table} not found in schema`)
      this.fatalError = true
    }

    let update = `UPDATE ${db}.${table}`;

    let {columns, values} = this.parseData(db, table, data);
    if(values.length === 0) {
      this.fatalError = true
      this.errors.push('There must be at least one value when creating a record.')
    }
    if(columns.length === 0) {
      this.fatalError = true
      this.errors.push('There must be at least one column when creating a record.')
    }
    let set = ` SET ${columns.map(( key, i ) => `${key} = ${values[i]}`).join()}`;

    if((queryObj.where || []).length === 0 || !queryObj.where) {
      this.fatalError = true;
      this.errors.push('No where condition provided. You cannot update all records in the table at once.');
    }

    let where = this.setStringArray('where', queryObj, ' WHERE ');

    return `${update}${set}${where}`;
  }

  // +~====************====~+
  // +~====**'DELETE'**====~+
  // +~====************====~+

  buildDelete(queryObj) {
    if(!queryObj.where) {
      this.fatalError = true;
      this.errors.push('No where string present. JSequel cannot delete all records in a single query.');
      return '';
    }

    const {db, table} = this.splitDbAndTableNames(queryObj.name);

    if(!(this.schema[db] || {})[table]) {
      this.errors.push(`${db}.${table} not found in schema`)
      this.fatalError = true
    }

    let del = `DELETE FROM ${db}.${table}`;


    let where = this.setStringArray('where', queryObj, ' WHERE ');

    return `${del}${where}`;
  }


  // +~====********************====~+
  // +~====***'TREE MAPPING'***====~+
  // +~====********************====~+

  buildTreeMap(columns, callback) {

    let treeMap = []
    let tree = [0]
    let status = ''

    do {

      status = this.detectLeafStatus(columns, tree)

      if(status === 'not enough branches') tree.push(0)

      if(status === 'too many branches') tree.pop()
      
      if(status === 'no leaf') {
        tree.pop()
        tree[tree.length -1]++
      }

      if(status === 'found leaf') {
        treeMap.push([ ...tree ])
        tree[tree.length -1]++
      }

    } while (tree.length > 0)

    return callback ? callback(treeMap) : treeMap

  }

  detectLeafStatus(columns, tree, index = 0) {

    if(tree[index+1] !== undefined) {

      if((columns[tree[index]] || {}).columns) {

        // console.log('columns so continue')
        // There's a columns item so go deeper
        return this.detectLeafStatus(columns[tree[index]].columns, tree, index+1)

      } else {
        // There's no columns item so this tree is incorrect.
        // console.log('too many branches')
        return 'too many branches'
      }

    } else if((columns[tree[index]] || {}).name) {

      // If there's an 'as' we'll stop prematurely because
      // this is a nested json selection.
      if(
        (columns[tree[index]] || {}).columns &&
        (columns[tree[index]] || {}).as
      ) return 'found leaf'

      if((columns[tree[index]] || {}).columns) {
        // console.log('not enough branches');
        return 'not enough branches'
      } 

      // console.log('found leaf')
      return 'found leaf'

    } else {
      // console.log('no leaf')
      return 'no leaf'
    }
  }

  // +~====***********************====~+
  // +~====*****'NAME ROUTER'*****====~+
  // +~====***********************====~+

  // This is one of the most important functions in jseq
  // Every 'name' value comes through here and so this is
  // where we check the column names are valid.
  //
  // It's also where we detect the format of the name value, whether
  // it's a function string or a JQString etc.

  nameRouter(col, dbTable = this.masterDbTable) {

    const {
      db,
      table
    } = this.splitSelectItems(col, dbTable)

    // Has => so it's a function string
    if(/^\w+=>/.test(col.name)) {
      if(!col.as) {
        this.errors.push('There must be an "as" value for every function selection: ', col.name)
        // this.fatalError = true
        return null
      }
      return this.funcString(col.name)
    }

    // Has `$` at the start so it's a jQ string
    if(/^\$\w+/.test(col.name)) {
      if(!col.as) {
        this.errors.push('There must be an "as" value for every jQString selection: ', col.name)
        // this.fatalError = true
        return null
      }
      return this.jQExtract(db, table, col.name)
    }

    // Has name.name so it's a dbName selection
    if(/^\w+\.\w+$/g.test(col.name) && !col.as) {
      if(!col.where) {
        this.errors.push('There must be a "where" value for every db.table selection: ', col.name)
        // this.fatalError = true
        return null
      }
      if(!(this.schema[db] || {})[table]) {
        this.errors.push(`${db}.${table} not found in schema`)
        return null
      }
      return col.name
    }

    // Has a dbTable and an `as` so it's to be made into a nested json
    if(/^\w+\.\w+$/g.test(col.name) && col.as) {
      return this.parseNestedJson(col)
    }

    // Has a single name so it's a normal name selection
    if(/^\w+$/.test(col.name)) {

      if(!((this.schema[db] || {})[table] || {})[col.name]) {
        this.errors.push(`${db}.${table}.${col.name} not found in schema`)
        if(db === undefined || table === undefined) this.fatalError = true
        return null
      }

      return col.name
    }

    this.errors.push('Column didn\'t meet the requirements for a selection: ', JSON.stringify(col))
    // this.fatalError = true
    return null

  }

  // +~====*************====~+
  // +~====**'PARSERS'**====~+
  // +~====*************====~+

  parseNestedJson(queryObj) {
    const {db, table} = this.splitDbAndTableNames(queryObj.name);

    if(queryObj.columns.length === 0) {
      this.errors.push(`No columns included at ${db}.${table}`);
      return null
    }

    let where = this.setStringArray('where', queryObj, ' WHERE ');

    let sort = '';
    if(queryObj.sort && this.plainStringValid(queryObj.sort)) {
      sort = ` ORDER BY ${queryObj.sort}`;
    }

    let limit = '';
    if(queryObj.limit) {
      limit = ` LIMIT ${queryObj.limit.map(l => l).join()}`;
    }

    let keyVals = [];
    queryObj.columns.forEach(col => {

      let name = this.nameRouter(col, db + '.' + table);
      if(!name) return null
      let key = col.as ? `'${col.as}'` : `'${col.name}'`;
      keyVals.push(`${key},${name}`);

    });

    return `(SELECT JSON_ARRAYAGG(JSON_OBJECT(${keyVals.join()})) FROM ${db}.${table}${where}${sort}${limit})`;
  }

  // +~====*************************====~+
  // +~====******'FUNCTIONS'********====~+
  // +~====*************************====~+

  funcString(name, data) {
    if(!this.plainPartValid(name)) return;
    const func = name.slice(0, name.indexOf('=>'))

    let args = name.slice(
      func.length + 2
    ).match(
      // /[`'"][[{].*[}\]]['`"]|\w+=>|\(|\)|'(.*?)'|"(.*?)"|`(.*?)`|\$*(\w+\.)+\w+|\$*\w+|\\|\/|\+|>=|<=|=>|>|<|-|\*|=/g
      /{.*?}|\[.*?\]|\w+=>|\(|\)|'(.*?)'|"(.*?)"|`(.*?)`|\$*(\w+\.)+\w+|\$*\w+|\\|\/|\+|>=|<=|=>|>|<|-|\*|=/g
    );


    return this.convertFunc(func, args, data);
  }

  convertFunc(func, args, data) {

    let newArgs = args;

    // Make an array of arrays of positions of all the arguments.
    // This starts from the first arg to the closing bracket.
    // We never capture the opening bracket.
    let argPositions = [];

    // In a loop keep flattening the arguments and re-calibrating
    // the argument positions until there's one big argument left.
    do {
      argPositions = this.getArgPositions(newArgs);
      newArgs = this.flattenArgs(newArgs, argPositions);
    } while (argPositions.length > 1);

    // If it's custom call it, if not return it with the name at the front
    // I'm doing toUpperCase here just to denote it's definitely a mysql function.
    let str = '';
    if(this.customFns[func]) {

      // Add the data here as well, if this is an update or
      // create it gives the user access to it in the custom function.
      str = this.customFns[func](...newArgs, data);

    } else {
      str = `${func.toUpperCase()}(${newArgs.map(arg => {
        if(/^"\$\w+/.test(arg)) {
          return this.jQExtractNoTable(arg.slice(1, arg.length - 1))
        }
        return arg

      }).join()})`;
    }
    return str;
  }

  getArgPositions(args) {
    let count = 0;
    let counts = [];
    let indexes = [];
    let types = [];

    args.forEach((arg,index) => {
      if(/^\($/.test(arg)) {
        if(types[types.length -1] !== 'close') count++;
        types.push('open');
        counts.push(count);
        indexes.push(index);
      }
      if(/^\)$/.test(arg)) {
        if(types[types.length -1] === 'close') count--;
        types.push('close');
        counts.push(count);
        indexes.push(index);
      }
    });

    return types.reduce((arr,type,i) => {

      if(type === 'close') {

        let endIndex = indexes[i];

        let currentCount = counts[i];
        let startCountIndex = counts.lastIndexOf(currentCount, i-1);

        let startIndex = indexes[startCountIndex]+1;

        return [...arr,  [startIndex, endIndex] ];

      }
      return arr;

    },[]);

  }

  parseCustomObj(arr, arg) {

    // Grab all the selections in an array: '@.thing' = ['@', 'thing']
    let customObj = {}
    const selections = arg.slice(1,-1).split('.')

    // Turn arg into the object being selected.
    selections.forEach((sel, i) => {
      if(i === 0) customObj = this.customObj
      else customObj = customObj[sel]
    })

    return [...arr, customObj];
  }

  parseCustomFunc(arr, arg, newArgs, start, end) {
    arg = arg.slice(0, -2);
    if(this.customFns[arg]) return [...arr, this.customFns[arg](...newArgs.slice(start, end))];
    return [...arr, arg.toUpperCase() + '(' + newArgs.slice(start, end).join() + ')'];
  }

  flattenArgs(newArgs, argPositions) {
    let start = argPositions[0][0];
    let end = argPositions[0][1];
    // start === end      < No arguments:  '()'               [ 7, 7 ]
    // end - start === 1  < One argument:  '("hi")'           [ 7, 8 ]
    // end - start === 2  < Two arguments: '("hi", CONCAT())' [ 7, 9 ]
    // etc...

    // If the start of the arguments is 1 then we're at
    // the outermost argument and just need to return the
    // whole thing.
    if(start === 1 && end !== 1) {

      newArgs = newArgs.slice(start, end).map(arg => { 

        if(/\w+=>/.test(arg)) {
          arg = arg.slice(0, -2);
          if(this.customFns[arg]) return this.customFns[arg]();
          return arg.toUpperCase() + '()';
        }


        if(/^"@/.test(arg) && this.customObj) {

          // Grab all the selections in an array: '@.thing' = ['@', 'thing']
          let customObj = {}
          const selections = arg.slice(1,-1).split('.')

          // Turn arg into the object being selected.
          selections.forEach((sel, i) => {
            if(i === 0) customObj = this.customObj
            else customObj = customObj[sel]
          })

          return customObj
        }



        return arg;

      })

      return newArgs


    // if the start and end are both 1 there's no arguments at all.
    } else if(start === 1 && end === 1) {

      return [];
    }

    // If there's no arguments, for example [3, 3].
    // We can just flatten this arg 
    if(start === end) {

      return newArgs.reduce((arr,arg,i) => {

        if(/\w+=>/.test(arg) && i === start-2) {

          return this.parseCustomFunc(arr,arg, newArgs, start, end) 
        }

        // If this argument is a custom object selection: '@.thing'
        // And there's a customObj on this.
        if(/^"@/.test(arg) && i === start-2 && this.customObj) {

          return this.parseCustomObj(arr, arg)
        }

        if(i === start - 1 || i === start) {
          return arr;
        }

        return [...arr, arg];

      },[]);
    }

    // if there's one argument, for example [ 8, 9 ].
    // if there's two arguments, for example [ 8, 10 ].
    // These are arguments that are definitely not unflattened functions
    // and can be flattened. 
    // if(end - start === 1 || end - start === 2) {
    if(end > start) {
      return newArgs.reduce((arr,arg,i) => {


        if(/\w+=>/.test(arg) && i === start-2) {

          return this.parseCustomFunc(arr,arg, newArgs, start, end) 
        }

        // If this argument is a custom object selection: '@.thing'
        // And there's a customObj on this.
        if(/^"@/.test(arg) && i === start-2 && this.customObj) {

          return this.parseCustomObj(arr, arg)
        }

        if(i === start - 1 || (i >= start && i <= end)) {
          return arr;
        }

        return [...arr, arg];

      },[]);
    }

  }

  // +~====*************************====~+
  // +~====**'JSONQUERY FUNCTIONS'**====~+
  // +~====*************************====~+

  extractColFromJQString(db, table, jQString) {
    let column = jQString.slice(1, jQString.search(/[.[]/));
    return column;
  }

  jQExtractNoTable(jQStr) {
    if(!this.plainPartValid(jQStr)) return;
    const regx = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g
    const matches = jQStr.match(regx);
    const name = `${matches[0].slice(1)}`
    return `JSON_UNQUOTE(JSON_EXTRACT(${name}, ${this.jQStringMaker(name, matches)}))`;
  }

  jQExtract(db, table, jQStr) {
    if(!this.plainPartValid(jQStr)) return;
    const regx = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g
    const matches = jQStr.match(regx);
    if(!this.columnValid(db, table, matches[0].slice(1))) return;
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

  jQSet(db, table, jQStr, value) {
    const regx = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g
    const matches = jQStr.match(regx);
    const name = `${db}.${table}.${matches[0].slice(1)}`
    return `JSON_SET(${name}, ${this.jQStringMaker(name, matches)}, ${value})`;
  }

  // +~====***************====~+
  // +~====**'UTILITIES'**====~+
  // +~====***************====~+

  splitSelectItems(col, dbTable) {
    const {db, table} = this.splitDbAndTableNames(dbTable)

    let name = ''
    if(col.name) name = col.name

    let as = ''
    if(col.as) as = col.as

    let sort = ''
    if(col.sort) sort = col.sort

    let limit = []
    if(col.limit) limit = col.limit

    let where = []
    if(col.where) where = col.where

    let having = []
    if(col.having) having = col.having

    let group = []
    if(col.group) group = col.group

    return {
      db,
      table,
      name,
      as,
      sort,
      limit,
      where,
      having,
      group
    }

  }

  setLimitString(limit) {
    if(limit.length > 0) {
      if(limit.length > 2) {
        this.errors.push('The limit param must only have two items')
        this.fatalError = true
        return ''
      }
      if(typeof limit[0] !== 'number' || typeof limit[1] !== 'number') {
        this.errors.push('Both items in a limit param must be numbers')
        this.fatalError = true
        return ''
      }

      return ` LIMIT ${limit.join()}`

    }
  }

  setString(string, stringPart) {

    if(!this.plainStringValid(string)) return ''

    return stringPart + string

  }

  setStringArray(type, queryObj, stringPart) {

    let items = [];
    if((queryObj[type] || []).length > 0) {
      queryObj[type].forEach(st => {
        if(st.length && typeof st === 'object') {
          let itms = [];
          st.forEach(s => !this.plainStringValid(s) || itms.push(s))
          items.push(itms.join(' OR '));
          return;
        }
        if(!this.plainStringValid(st)) return;
        items.push(st);
      });
    }

    return items.length > 0 ? stringPart + items.join(' AND ') : '';
  }

  splitDbAndTableNames(name) {
    const dbTable = /^\w+\.\w+$/
    if(!dbTable.test(name)) {
      return {}
    } else if(!this.dbTableValid(name)) {
      return {}
    }
    return {
      db: name.match(/^\w+|\w+$/g)[0],
      table: name.match(/^\w+|\w+$/g)[1]
    }
  }

  // +~====****************====~+
  // +~====**'VALIDATION'**====~+
  // +~====****************====~+

  plainStringValid(plainStr) {
    const parts = plainStr.match(
      /{.*?}|\[.*?\]|\w+=>|\(|\)|'(.*?)'|"(.*?)"|`(.*?)`|\$*(\w+\.)+\w+|\$*\w+|\\|\/|\+|>=|<=|=>|>|<|-|\*|=/g
    );
    let valid = false;

    parts.forEach(part => {

      if(this.plainPartValid(part)) {
        valid = true;
      }

    });
    return valid;
  }

  plainPartValid(string) {

    const quoted = /'(.*?)'|"(.*?)"|`(.*?)`/g;

    // All the words we shouldn't use...
    const regx = [
      /;/gi,
      /--/gi,
      /^drop$|\s+drop$|^drop\s+|\s+drop\s+/gi,
      /^truncate$|\s+truncate$|^truncate\s+|\s+truncate\s+/gi,
      /^delete$|\s+delete$|^delete\s+|\s+delete\s+/gi,
      /^update$|\s+update$|^update\s+|\s+update\s+/gi,
      /^create$|\s+create$|^create\s+|\s+create\s+/gi,
      /^alter$|\s+alter$|^alter\s+|\s+alter\s+/gi,
      /^insert$|\s+insert$|^insert\s+|\s+insert\s+/gi,
      /^select$|\s+select$|^select\s+|\s+select\s+/gi,
      /^grant$|\s+grant$|^grant\s+|\s+grant\s+/gi
    ]


    if(quoted.test(string)) {

      // If a string is in quotes we can ignore it...
      return true

    }

    if(regx.find(r => r.test(string))) {
      this.errors.push('The string \'' + string + '\' is not allowed');
      this.fatalError = true;
      return false;
    } else {
      return true;
    }
  }

  // +~====***********************====~+
  // +~====**'SCHEMA VALIDATION'**====~+
  // +~====***********************====~+

  dbTableValid(string) {
    // We don't want to push an error here because this could be a valid table.column
    let m = string.match(/\w+/g);
    if(!(this.schema[m[0]] || {})[m[1]]) {
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
