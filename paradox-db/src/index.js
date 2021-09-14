var ParadoxTable = require("paradox.js");
var fs = require("fs");
var { decodeUnicode } = require("./helper");

var file = fs.readFileSync(
  "/Users/ckwang/Downloads/caomin_01_02/caomin001/tbaaccounts.DB"
);
// console.log(decodeUnicode(file.toString("hex")));
var table = new ParadoxTable(file);
var records = table.findRecords({
  filter: (record) => {
    console.log(record);
    return true;
  },
});
