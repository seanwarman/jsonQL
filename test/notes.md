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

- ~~If a data key has a $ at the front it means we're doing a JSON_SET value.~~

```js
const data = {
  "$jsonForm[?Booking Month].value": 'cool month'
}

```

which would render in the sql as: 
```sql
UPDATE
bookings
SET
jsonForm = IF(
  (JSON_SET(jsonForm, CONCAT('$[',SUBSTR(JSON_SEARCH(jsonForm,'one','Bigg Spend'), 4,LOCATE('].',JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'))-4),'].value'),'cool month') IS NOT NULL),
  JSON_SET(jsonForm, CONCAT('$[',SUBSTR(JSON_SEARCH(jsonForm,'one','Bigg Spend'), 4,LOCATE('].',JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'))-4),'].value'),'cool month'),
  jsonForm
)
where
bookingsKey = 'd03563a0-2e2c-11ea-b3ec-a1387ad1100d'
```

- ~~Add the $ syntax to the columns objects.~~

```js
columns: [
  {name: '$jsonForm[?Booking Month].value', as: 'bookingMonth'}
]
```

- ~~Add a COUNT to the SELECTs like in the bookings get.~~

- Add an primary auto increment key to the schema.

- Make the $json syntax "real", so it can be used in all `name` strings and for all combinations.
  - First of all, it will probably need to have it's own controller.
  - Split each part of the string into an array of strings.
  - Each item in the array will then need a sql equivelent.
  ```js
  '[?Booking Month]' === 'JSON_SEARCH(jsonForm, "one", "Booking Month")'
  '[0]'              === 'JSON_EXTRACT(jsonForm, "$[0]")'
  ```
  - The first arg of the json function should probably be whatever string array item came before it.
  ```js
  [
    '$jsonForm',
    '[0]',
    '[0]'
  ]
  [
    'jsonForm',
    'JSON_EXTRACT(jsonForm, "$[0]")',
    'JSON_EXTRACT(JSON_EXTRACT(jsonForm, "$[0]"), "$[0]")',
  ]
  ```
  - Then a '.' value should be added to the last arg of the function preceeding it.
  ```js
  [
    '$jsonForm',
    '[0]',
    '[0]',
    '.label'
  ]
  [
    'JSON_EXTRACT(jsonForm, "$")',
    'JSON_EXTRACT(JSON_EXTRACT(jsonForm, "$"), "$[0]")',
    'JSON_EXTRACT(JSON_EXTRACT(JSON_EXTRACT(jsonForm, "$"), "$[0]"), "$[0]")',
    'JSON_EXTRACT(JSON_EXTRACT(JSON_EXTRACT(JSON_EXTRACT(jsonForm, "$"), "$[0]"), "$[0]"), "$.label")',
  ]
  ```
  - If the '.' comes after a $ selection, then, I think, it needs to make another `JSON_EXTRACT`.
  ```js
  [
    '$jsonForm',
    '.label'
  ]
  [
    'jsonForm',
    'JSON_EXTRACT(jsonForm, "$.label")',
  ]
  ```

- ~~First we need a badass regex that can make the first array for us.~~
- ~~Then import into index.~~
- ~~Then export the validation functions and use them in our new jQStringMaker.~~


- A JSON_SET and a JSON_EXTRACT work similarly but not the same.

```sql
JSON_EXTRACT(JSON_EXTRACT(jsonForm, CONCAT('$[', SUBSTR(JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'), 4, 1), ']')), "$.value")

-- equals '40' or whatever

JSON_SET(jsonForm, CONCAT('$[',SUBSTR(JSON_SEARCH(jsonForm,'one','Bigg Spend'), 4,LOCATE('].',JSON_SEARCH(jsonForm, 'one', 'Bigg Spend'))-4),'].value'),'cool month')

-- eqauls the whole jsonForm object but with the `value` value - 'cool month' 
```

These differences mean, I think, that the first arg of JSON_SET must always stay as `jsonForm`.
The matches should build with nested concats that then get put into a json_set.
```js
const jqString = '$jsonForm[0][0].value';

const val = 'hi!';

const matches = [
  '$jsonForm',
  '[0]',
  '[0]',
  '.value'
]

const column = matches.unshift().slice(1);
// 'jsonForm'

const result = [
  `CONCAT("$")`,
  `CONCAT(CONCAT("$"), "[0]")`,
  `CONCAT(CONCAT(CONCAT("$"), "[0]"), "[0]")`,
  `CONCAT(CONCAT(CONCAT(CONCAT("$"), "[0]"), "[0]"), ".value")`,
]
  return `JSON_SET(${column}, ${result[result.length]}, ${val})`;
```

```js
const jqString = '$jsonForm[?Booking Month].value';

const matches = [
  '$jsonForm',
  '[?Booking Month]',
  '.value'
]

const result = [
  `CONCAT("$")`,
  `CONCAT(CONCAT("$"), CONCAT('[',SUBSTR(JSON_SEARCH(JSON_EXTRACT(jsonForm, "$"),'one','Booking Month'), 4,LOCATE(']',JSON_SEARCH(JSON_EXTRACT(jsonForm, "$"), 'one', 'Booking Month'))-4),']'))`,
  `CONCAT(CONCAT(CONCAT("$"), CONCAT('[',SUBSTR(JSON_SEARCH(JSON_EXTRACT(jsonForm, "$"),'one','Booking Month'), 4,LOCATE(']',JSON_SEARCH(JSON_EXTRACT(jsonForm, "$"), 'one', 'Booking Month'))-4),']')), ".value")`,
]
```

- ~~Change the original jqstring maker so that the first jsonForm value is wrapped around a json_extract.~~


  - Add spaces to a string to denote a `CONCAT`.
  ```js
  { name: '$firstName $lastName', as: 'fullName' }
  ===
  'CONCAT(firstName, " ", lastName) AS fullName'

  [
    '$firstName',
    ' ',
    '$lastName'
  ]
  [
    'firstName',
    'CONCAT(firstName, " ")',
    'CONCAT(CONCAT(firstName, " "), lastName)',
  ]
  ```

  - Add jQStrings to the `name` param in **JoinObjects**.
  - Add jQStrings to the `name` param in **WhereObjects** and **HavingObjects**.