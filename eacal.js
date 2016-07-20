const eacal = require("./_eacal.js");
const fs = require("fs");

let fileName = process.argv[2];

let file = fs.readFileSync(fileName).toString();

let args = process.argv.slice(3);

eacal({
    code: file,
    args: args
});