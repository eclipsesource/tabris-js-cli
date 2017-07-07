const temp = require('temp').track();
const expect = require('chai').expect;
const spawn = require('child_process').spawn;
const portscanner = require('portscanner');
const fetch = require('node-fetch');
const {basename} = require('path');

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
    let path = temp.mkdirSync('foo');
    process1 = spawn('node', ['./src/tabris', 'serve', path]);

    return waitForStdout(process1)
      .then(stdout => getPortFromStdout(stdout))
      .then(port => getPortStatus(port))
      .then(status =>
        expect(status).to.equal('open')
      );
  });

  it('finds next unused port', function() {
    this.timeout(10000);
    let path = temp.mkdirSync('foo');
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

  describe('when serving a file', () => {

    it('fails when the file does not exist', function(done) {
      process1 = spawn('node', ['./src/tabris', 'serve', 'foobar.js']);

      process1.stderr.on('data', data => {
        expect(data.toString()).to.match(/Path must be a directory or a file/);
        done();
      });
    });

    it('a server is started', function() {
      let {path} = temp.openSync('foo');
      process1 = spawn('node', ['./src/tabris', 'serve', path]);

      return waitForStdout(process1)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => getPortStatus(port))
        .then(status =>
          expect(status).to.equal('open')
        );
    });

    it('a package.json is served', function() {
      let {path} = temp.openSync('foo');
      process1 = spawn('node', ['./src/tabris', 'serve', path]);

      return waitForStdout(process1)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => fetch(`http://127.0.0.1:${port}/package.json`)
          .then(response => response.json())
          .then(json =>
            expect(json.main).to.equal(basename(path))
          )
        );
    });

  });

  describe('when logging is enabled', function() {

    it('request errors are logged to the console', function() {
      let {path} = temp.openSync('foo');
      process1 = spawn('node', ['./src/tabris', 'serve', path, '-l']);

      return waitForStdout(process1)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => Promise.all([
          waitForStderr(process1),
          fetch(`http://127.0.0.1:${port}/non-existant`)
        ]))
        .then(([stderr]) => stderr.toString())
        .then(log =>
          expect(log).to.contain('GET /non-existant 404: "Not found"')
        );
    });

    it('requests are logged to the console', function() {
      let {path} = temp.openSync('foo');
      process1 = spawn('node', ['./src/tabris', 'serve', path, '-l']);

      return waitForStdout(process1)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => Promise.all([
          waitForStdout(process1),
          fetch(`http://127.0.0.1:${port}/package.json`)
        ]))
        .then(([stdout]) => stdout.toString())
        .then(log =>
          expect(log).to.contain('GET /package.json')
        );
    });

  });


});

function getPortStatus(port) {
  return portscanner.checkPortStatus(port, '127.0.0.1');
}

function waitForStderr(process) {
  return new Promise(resolve => process.stderr.once('data', data => resolve(data)));
}

function waitForStdout(process) {
  return new Promise(resolve => process.stdout.once('data', data => resolve(data)));
}

function getPortFromStdout(stdout) {
  return stdout.toString().match(/.*http:.*:(\d+).*/)[1];
}
