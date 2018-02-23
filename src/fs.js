const fs = require('fs')
const promiseify = require('./promiseify')

exports.stat = promiseify(fs.stat);
exports.readFile = promiseify(fs.readFile);
exports.writeFile = promiseify(fs.writeFile);
exports.createReadStream = fs.createReadStream;
exports.createWriteStream = fs.createWriteStream;
exports.watch = fs.watch;