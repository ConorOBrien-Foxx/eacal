const eacal = require("./_eacal.js");
const fs = require("fs");

let flags = [];

while(/^[-/]/.test(process.argv[2])){
    flags.push(process.argv.splice(2, 1)[0].slice(1));
}

let fileName = process.argv[2];

let file = fs.readFileSync(fileName).toString();

let args = process.argv.slice(3);

let start = new Date();
eacal({
    code: file,
    args: args
});
let end = new Date();
if(flags.indexOf("time") >= 0){
    let time = end - start;
    console.log(`\nran for ${Math.floor(time / 10) / 100} second${time === 1 ? "" : "s"}`);
}