## JoinObject                           
                                   
```js
const JoinObject = {                    
  db: String,                           
  table: String,                        
  where: [WhereObject],                 
  having: [WhereObject],
  columns: [ColumnObject]               
}                                       
```

## ColumnObject                         
                                     
```js
const ColumnObject = {                  
  name: String,                         
  string: String,                         
  number: String/Number,                         
  fn: String,
  args: [ColumnObject],
  as: String,                           
  join: JoinObject
}
```

## WhereObject
                   
```js
const WhereObject = {
  name: String,
  is: String,
  isnot: String,
  or: WhereObject
}
```

## TODO

- ~~Add schema and regex checking.~~
  - ~~regex checking is done but the schema needs to ignore alias table names rather than checking them
  to the schema.~~

- ~~If no `columns` is given then pass back all columns that exist in the schema.~~
  - ~~A column is omitted if it has the flag `hidden: true`.~~

- Add ~~update~~, ~~delete~~ and ~~create~~.

- ~~Add `orderBy` key to the `JoinObject`.~~

- ~~Add `jsonExtract` key to the `ColumnObject`.~~

- If a data key has a $ at the front it means we're doing a JSON_REPLACE value.

```js
const data = {
  "$jsonForm[?Booking Month].value": 6
}
```

which would render in the sql as: 
```sql
jsonForm = JSON_REPLACE(jsonForm, CONCAT('$[', SUBSTR(JSON_SEARCH(jsonForm, 'one', 'Booking Month'), 4, 1), '].value'), 6)
```

- Add a COUNT to the SELECTs like in the bookings get.

- Add an primary auto increment key to the schema.


