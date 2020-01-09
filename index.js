module.exports = class jsonQL {
  constructor(schema) {
    this.selectString = '';
    this.joinString = '';
    this.whereString = '';
    this.insertString = '';
    this.queryString = '';
    this.deleteString = '';
    
    this.joinTables = [];
    this.errors = [];
    this.fatalError = null;
    this.regex = /(drop )|;|(update )( truncate)/gi;

    this.schema = schema;
    
  }
  selectQL(jsonQuery) {
    this.init(jsonQuery)
    if(this.fatalError) return this.fatalError;
    return this.selectQuery();
  }
  createQL(jsonQuery, data) {
    this.init(jsonQuery, data)
    if(this.fatalError) return this.fatalError;
    return this.createQuery();
  }
  updateQL(jsonQuery, data) {
    this.init(jsonQuery, data)
    if(this.fatalError) return this.fatalError;
    return this.updateQuery();
  }
  deleteQL(jsonQuery) {
    this.init(jsonQuery);
    if(this.fatalError) return this.fatalError;
    return this.deleteQuery();
  }
  
  init(jsonQuery, data = null) {
    this.jsonQuery = jsonQuery;
    this.primaryDBName = jsonQuery.db;
    this.primaryTableName = jsonQuery.table;
    
    this.data = data;

    this.primaryDBSchema = this.schema[this.primaryDBName]
    if (!this.primaryDBSchema) {
      this.fatalError = {status: 'error', message: 'This primary db name was not found in the schema: ' + this.primaryDBName};
      return;
    }

    this.primaryTableSchema = this.primaryDBSchema[this.primaryTableName]
    if (!this.primaryTableSchema) {
      this.fatalError = {status: 'error', message: `The table named: ${this.primaryTableName}, could not be found in: ${this.primaryDBName}.`}
      return;
    }

    this.fromString = `FROM ${this.primaryDBName}.${this.primaryTableName}`
  }
  
  createQuery(jsonQuery = this.jsonQuery, data = this.data) {

    this.insert(
      jsonQuery.db, 
      jsonQuery.table, 
      data
    );

    if(this.fatalError) {
      return this.fatalError;
    }
    
    if(this.errors.length > 0) {
      return {status: 'error', query: null, message: 'Query failed', errors: this.errors.join(' and ')};
    }

    return {status: 'success', query: this.insertString, message: 'Query successful', errors: this.errors.join(' and ')};

  }

  selectQuery(jsonQuery = this.jsonQuery) {

    this.handleJoins(
      jsonQuery.db, 
      jsonQuery.table, 
      jsonQuery.columns
    );

    this.select(
      jsonQuery.db, 
      jsonQuery.table, 
      jsonQuery
    );
    
    if(jsonQuery.where) {
      this.where(
        jsonQuery.db, 
        jsonQuery.table, 
        jsonQuery.where
      );
    }

    if(this.fatalError) {
      return this.fatalError;
    }
    
    if(this.errors.length > 0) {
      return {status: 'error', query: null, message: 'Query failed', errors: this.errors.join(' and ')};
    }

    this.buildSelect(this.jsonQuery);
    return {status: 'success', query: this.queryString, message: 'Query successful', errors: this.errors.join(' and ')};
  }

  updateQuery(jsonQuery = this.jsonQuery, data = this.data) {
    this.update(
      jsonQuery.db, 
      jsonQuery.table, 
      data
    )
      
    this.where(
      jsonQuery.db,
      jsonQuery.table,
      jsonQuery.where
    )

    if(this.fatalError) {
      return this.fatalError;
    }
    
    if(this.errors.length > 0) {
      return {status: 'error', query: null, message: 'Query failed', errors: this.errors.join(' and ')};
    }

    this.buildUpdate()
    return {status: 'success', query: this.queryString, message: 'Query successful', errors: this.errors.join(' and ')};
  }

  deleteQuery(jsonQuery = this.jsonQuery) {
    this.deleteString = `DELETE ${this.fromString}`
      
    this.where(
      jsonQuery.db,
      jsonQuery.table,
      jsonQuery.where
    )

    if(this.fatalError) {
      return this.fatalError;
    }
    
    if(this.errors.length > 0) {
      return {status: 'error', query: null, message: 'Query failed', errors: this.errors.join(' and ')};
    }

    this.queryString = `${this.deleteString} ${this.whereString}`;
    
    return {status: 'success', query: this.queryString, message: 'Query successful', errors: this.errors.join(' and ')};

  }

  buildUpdate() {
    this.queryString = `${this.updateString} ${this.whereString}`;
  }

  update(db, table, data) {
    this.updateString = `UPDATE ${db}.${table} SET ${Object.keys(data).filter(col => {
      if(!this.schemaValid(db, table, col)) return false;
      if(data[col] === null) return false;
      if(data[col] === undefined) return false;
      return true
    })
    .map(col => {
      // If a string make sure you add single quotes, if length is 0 replace value with NULL...
      if(typeof data[col] === 'string') return data[col].length > 0 ? `${col} = '${data[col]}'` : `${col} = NULL` 
      if(typeof data[col] === 'number') return `${col} = ${data[col]}`
    }).join()}`
  }

  buildSelect(jsonQuery) {
    this.queryString = `SELECT ${this.selectString} ${this.fromString}${this.joinString}`;
    if(this.whereString.length > 0) {
      this.queryString += ` ${this.whereString}`;
    }
    if(jsonQuery.limit) {
      this.limit(this.jsonQuery.limit);
    }
    if(jsonQuery.orderBy) {
      this.orderBy(jsonQuery.orderBy);
    }
  }
  limit(limit) {
    if(limit && (limit || []).length === 2) {
      const start = limit[0];
      const end = limit[1];
      if(typeof start !== 'number' || typeof end !== 'number') {
        this.fatalError = {status: 'error', message: 'The limit array must contain numbers only.'};
      }
      this.queryString += ` LIMIT ${start}, ${end}`;
    }
  }
  orderBy(orderBy) {
    if(orderBy) {
      // I don't know good way to properly check the order by parameter.
      // We'll have to do a regex...
      if(this.regex.test(orderBy.name)) {
        this.fatalError = {status: 'error', message: `This orderBy value didn't pass the validation test: ${orderBy.name}`};
        return;
      }
      const ascDesc = orderBy.asc ? ' ASC' : ' DESC';
      this.queryString += ` ORDER BY ${orderBy.name}${ascDesc}`;
    }
  }
  insert(db, table, data) {

    let cols = Object.keys(data).filter(col => {
      if(!this.schemaValid(db, table, col)) {
        this.errors.push(`${col} is an invalid column for ${db}.${table}`);
        return false;
      }
      return true;
    });

    let values = Object.values(data).map(val => {
      if(typeof val === 'string') return `'${val}'`
      if(typeof val === 'number') return val;
    }).join();

    this.insertString = `INSERT INTO ${db}.${table}
      (${cols.join()})
      VALUES
      (${values})
    `;

  }
  where(db, table, where) {
    this.whereString = where.reduce((str, whereObj) => {
      if(whereObj.name && !this.schemaValid(db, table, whereObj.name)) {
        return str;
      }
      if(str.length === 0) {
        str = `WHERE `;
      } else {
        str += ` AND `;
      }

      if(whereObj.or) {
        let or = whereObj.or.filter(orObj => {
          return this.schemaValid(db, table, orObj.name)
        })
        .map(orObj => {
          return `${db}.${table}.${orObj.name} ${orObj.is ? `= '${orObj.is}'` : `!= '${orObj.isnot}'`}` 
        })
        .join(' OR ');
        if(or.length > 0) return str + `(${or})`;
        return str;
      } else {
        return str + `${db}.${table}.${whereObj.name} ${whereObj.is ? `= '${whereObj.is}'` : `!= '${whereObj.isnot}'`}`;
      }
      
    },'')
    console.log('this.whereString :', this.whereString);
  }
  join(joinObj) {
    const db = joinObj.db;
    const table = joinObj.table;
    if(!this.schema[db]) {
      this.errors.push(db + ' db not found in schema');
      return;
    }
    if(!this.schema[db][table]) {
      this.errors.push(db + '.' + table + ' not found in schema');
      return;
    }
    if(!joinObj.where) {
      this.errors.push('No "where" parameter found in one of your join objects');
      return;
    }
    if(!joinObj.where.parent) {
      this.errors.push('No "where.parent" parameter found in one of your join objects');
      return;
    }
    if(!joinObj.where.is) {
      this.errors.push('No "where.is" parameter found in one of your join objects');
      return;
    }

    const primarySelection = `${this.primaryDBName}.${this.primaryTableName}`;
    let selection = `${db}.${table}`;
    const where = joinObj.where;

    const aliasTableName = this.aliasReplicaTableNames(table);

    if(aliasTableName !== table) {
      this.joinString += ` LEFT JOIN ${selection} AS ${aliasTableName} ON ${primarySelection}.${where.parent} = ${aliasTableName}.${where.is}`;
    } else {
      this.joinString += ` LEFT JOIN ${selection} ON ${primarySelection}.${where.parent} = ${selection}.${where.is}`;
    }
  }
  select(db, table, jsonQueryObj, alias = table) {

    const schema = this.schema;
    
    if(!schema[db]) {
      this.errors.push(db + ' db not found in schema');
      return;
    }
    if(!schema[db][table]) {
      this.errors.push(db + '.' + table + ' not found in schema');
      return;
    }

    let selection = '';
    if(table !== alias) {
      selection = alias;
    } else {
      selection = `${db}.${table}`;
    }
    
    const colsWithoutJoin = (jsonQueryObj.columns || []).filter(col => !col.join);
    
    if(colsWithoutJoin.length === 0) {
      if(this.selectString.length === 0) {
        this.selectString += `${selection}.*`;
      } else {
        this.selectString += `, ${selection}.*`;
      }
      return;
    }
    
    this.selectString += colsWithoutJoin.reduce((str,col) => {
      let as = '';
      if(!schema[db][table][col.name]) {
        return str;
      }
      if(col.as && !this.invalid(col.as)) {
        as = ` AS ${col.as}`
      }
      if(this.selectString.length === 0 && str.length === 0) {
        str += `${selection}.${col.name}${as}`;
      } else {
        str += `, ${selection}.${col.name}${as}`
      }
      return str;
    }, '')
    
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

  handleJoins(db, table, columns) {

    const colsWithJoin = (columns || []).filter(col => col.join);
    if(colsWithJoin.length === 0) return;
    colsWithJoin.forEach(col => {
      this.join(col.join)
    });
    colsWithJoin.forEach((col,i) => {
      this.select(
        col.join.db, 
        col.join.table, 
        col.join, 
        this.joinTables[i]
        );
    });

  }

  schemaValid(db, table, column) {

    if(!this.schema[db]) {
      this.errors.push(db + ' db not found in schema');
      return false;
    }
    if(table && !this.schema[db][table]) {
      this.errors.push(db + '.' + table + ' not found in schema');
      return false;
    }
    if(column && !this.schema[db][table][column]) {
      this.errors.push(column + ' not found in schema');
      return false;
    }
    return true
  }
  invalid(string) {
    const regex = /(drop )|;|(update )( truncate)/gi;
    return regex.test(string);
  }
}