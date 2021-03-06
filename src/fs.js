const fs = require('fs');
const promiseify = require('./promiseify');

exports.stat = promiseify(fs.stat);
exports.readFile = promiseify(fs.readFile);
exports.writeFile = promiseify(fs.writeFile);
exports.readdir = promiseify(fs.readdir);
exports.createReadStream = fs.createReadStream;
exports.createWriteStream = fs.createWriteStream;
exports.watch = fs.watch;
exports.lstatSync = fs.lstatSync;