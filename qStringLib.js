const jQString = (db, table, str) => {

  let reg = /(\$\w+)|(\[\d\])|(\.\w+)|(\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\])/g

  // let str = '$jsonForm[0].value[?Booking Month].label';

  if(!str.startsWith('$')) {
    console.log('json query strings must start with a $ sign');
    return;
  }

  const matches = str.match(reg);

  console.log(matches);

  function which(string, prevString) {
    if(/\$\w+/.test(string)) {
      // 'name';
      return `${db}.${table}.${string.slice(1)}`;
    }
    if(/\[\d\]/.test(string)) {
      // 'index';
      return `JSON_EXTRACT(${prevString}, "$${string}")`
    }
    if(/\.\w+/.test(string)) {
      // 'target';
      return `JSON_EXTRACT(${prevString}, "$${string}")`
    }
    if(/\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\]/.test(string)) {
      // 'search';
      string = string.slice(2, -1);
      return `JSON_EXTRACT(${prevString}, CONCAT('$[', SUBSTR(JSON_SEARCH(${prevString}, 'all', '${string}'), 4, 1), ']'))`;
    }
  }

  let name = /\$\w+/;
  let index = /\[\d\]/;
  let target = /\.\w+/;
  let search = /\[\?[\w\s@#:;{},.!"£$%^&*()/?|`¬\-=+~]*\]/;

  let result = matches.reduce((arr, match, i) => {

    if(i === 0) {
      return [...arr, which(match)];
    }
    return [...arr, which(match, arr[i-1])];

  }, []);

  console.log(result);

  return result[result.length - 1];

}
module.exports = jQString;
