const fs = require('fs')
const promiseify = require('./promiseify')

exports.stat = promiseify(fs.stat);
exports.readFile = promiseify(fs.readFile);
exports.writeFile = promiseify(fs.writeFile);
exports.watch = fs.watch;