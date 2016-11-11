const temp = require('temp').track();
const expect = require('chai').expect;
const spawn = require('child_process').spawn;
const portscanner = require('portscanner');

describe('serve', function() {

  let process1, process2;

  afterEach(() => {
    if (process1) {
      process1.kill();
    }
    if (process2) {
      process2.kill();
    }
    process1, process2 = null;
  });

  it('serves a directory', function() {
    return createDirectory('foo').then(path => {
      process1 = spawn('node', ['./src/tabris', 'serve', path]);

      return waitForStdout(process1)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => getPortStatus(port))
        .then(status =>
          expect(status).to.equal('open')
        );
    });
  });

  it('finds next unused port', function() {
    return createDirectory('foo').then(path => {
      process1 = spawn('node', ['./src/tabris', 'serve', path]);
      let port1;
      let port2;
      return waitForStdout(process1)
        .then(stdout => port1 = getPortFromStdout(stdout))
        .then(() => process2 = spawn('node', ['./src/tabris', 'serve', path]))
        .then(() => waitForStdout(process2))
        .then(stdout => port2 = getPortFromStdout(stdout))
        .then(() => {
          expect(port1).to.be.ok;
          expect(port2).to.be.ok;
          expect(port1).to.not.equal(port2);
        });
    });
  });

});

function createDirectory(name) {
  return new Promise((resolve, reject) => {
    temp.mkdir(name, (err, path) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

function getPortStatus(port) {
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

function getPortFromStdout(stdout) {
  return stdout.toString().match(/.*http:.*:(\d+).*/)[1];
}
