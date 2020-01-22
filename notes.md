We need to think of each object type as a block of code.

const WhereObject = {
    name: String/JQString,
    string: String,
    number: Number,
    is: String/vName,
    isnot: String/vName,
    value: String/Number/JQString/QString
    isbetween: [String/Number/vName, String/Number/vName]
}

const ColumnObject = {
    name: String/JQString,
    join: JoinObject,
    count: JoinObject,
    fn: String,
    args: [WhereObject], << this is incorrect, we need to remove string from ColumnObjects and put WhereObject here with string instead.
    as: String
}

const JoinObject = {
    db: String,
    table: String,
    columns: [ColumnObject],
    where: [WhereObject/[WhereObject]],
    having: [WhereObject/[WhereObject]],
    limit: [Number, Number],
    orderBy: {name: String/JQString, desc: Boolean},
}

What's the difference between a WhereObject in a join and one thats in a main where?

LEFT JOIN thisTable ON parentCol = thisCol/String/Number
WHERE                  thisCol   =         String/Number

They're totally different!

I think we're going to have to admit defeat here but I do want to be able to do something with this qstring idea.

```js
const WhereObject = {
  {string: '$campaign.bookings.bookingsKey = \'123\''}
}
```
