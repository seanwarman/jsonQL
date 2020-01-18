module.exports = {
  errors: [],
  fatalError: false,

  validString(string) {
    const regex = /(drop )|;|(update )( truncate)/gi;
    if(regex.test(string)) {
      this.errors.push('The string \'' + string + '\' is not allowed');
      this.fatalError = true;
      return false;
    } else {
      return true;
    }
  },

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
  },

  validIndex(index) {
    if(Number(index) === NaN) {
      this.errors.push('The index given to the json selector is not a number, if you\'re trying to search add a ? to the start of your string');
      this.fatalError = true;
      return false;
    }
    return true;
  }
}
