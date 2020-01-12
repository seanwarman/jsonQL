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

- Add schema and regex checking.

- If no `columns` is given then pass back all
columns that exist in the schema.

- Add `jsonExtract` key to `columns`.
