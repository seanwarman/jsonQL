We need to think of each object type as a block of code.

const WhereObject = {
    name: String/JQString,
    is: String/vName,
    isnot: String/vName,
    isbetween: [String/Number/vName, String/Number/vName]
}

const ColumnObject = {
    name: String/JQString,
    string: String,
    number: Number,
    join: JoinObject,
    count: JoinObject,
    fn: String,
    args: [ColumnObject],
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
