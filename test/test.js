const assert = require('assert');
const exec = require('child_process').execFile;
const packageJson = require('../package.json')

//child_process.execFile(file[, args][, options][, callback])
function execTest(args, callback){
  exec('./src/hot.js', args, callback);
}

describe('command line usage', () => {
  it('--version', (done) => {
    execTest(['--version'], (error, stdout, stderr) => {
      assert(!error, error);
      assert(stdout.trim() === packageJson.version, 'version not found');
      done();
    });
  });

  it('--help', (done) => {
    execTest(['--help'], (error, stdout, stderr) => {
      assert(!error, error);
      assert(stdout.includes('--help'), 'usage not found');
      done();
    })
  })
});