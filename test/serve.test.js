const temp = require('temp').track();
const expect = require('chai').expect;
const spawn = require('child_process').spawn;
const portscanner = require('portscanner');

describe('serve', function() {

  let process;

  afterEach(() => {
    if (process) {
      process.kill();
    }
  });

  it('serves a directory', function() {
    return mkDir('foo').then(path => {
      process = spawn('node', ['./src/tabris', 'serve', path]);

      return waitForStdout(process).then(() => checkPort(8080)).then(status =>
        expect(status).to.equal('open')
      );
    });
  });

});

function mkDir(name) {
  return new Promise((resolve, reject) => {
    temp.mkdir(name, function(err, path) {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

function checkPort(port) {
  return new Promise((resolve, reject) => {
    portscanner.checkPortStatus(port, '127.0.0.1', (error, status) => {
      if (error) {
        reject(error);
      } else {
        resolve(status);
      }
    });
  });
}

function waitForStdout(process) {
  return new Promise(resolve => process.stdout.once('data', data => resolve(data)));
}
