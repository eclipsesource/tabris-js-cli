const {join,resolve} = require('path');
const {writeFileSync} = require('fs-extra');
const temp = require('temp').track();
const {expect} = require('./test');
const spawn = require('child_process').spawn;
const fetch = require('node-fetch');

describe('serve', function() {

  let process, path;

  beforeEach(function() {
    path = temp.mkdirSync('foo');
  });

  afterEach(() => {
    if (process) {
      process.kill();
    }
    process = null;
  });

  it('fails when file does not exist', function() {
    process = spawn('node', ['./src/tabris', 'serve', 'foobar.js']);

    return waitForStderr(process).then((data) => {
      expect(data.toString()).to.match(/No such file or directory: foobar.js/);
    });
  });

  it('starts a server on a given directory', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    process = spawn('node', ['./src/tabris', 'serve', path]);

    return waitForStdout(process)
      .then(stdout => getPortFromStdout(stdout))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  });

  it('starts a server on cwd if path argument missing', function() {
    let srcFile = resolve('./src/tabris');
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    process = spawn('node', [srcFile, 'serve'], {cwd: path});

    return waitForStdout(process)
      .then(stdout => getPortFromStdout(stdout))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  });

  describe('when logging is enabled', function() {

    it('requests are logged to the console', function() {
      let {path} = temp.openSync('foo');
      process = spawn('node', ['./src/tabris', 'serve', path, '-l']);

      return waitForStdout(process)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => Promise.all([
          waitForStdout(process),
          fetch(`http://127.0.0.1:${port}/package.json`)
        ]))
        .then(([stdout]) => stdout.toString())
        .then(log =>
          expect(log).to.contain('GET /package.json')
        );
    });

    it('request errors are logged to the console', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      process = spawn('node', ['./src/tabris', 'serve', path, '-l']);

      return waitForStdout(process)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => Promise.all([
          waitForStderr(process),
          fetch(`http://127.0.0.1:${port}/non-existent`)
        ]))
        .then(([stderr]) => stderr.toString())
        .then(log =>
          expect(log).to.contain('GET /non-existent 404: "Not found"')
        );
    });

  });

});

function waitForStderr(process) {
  return new Promise(resolve => process.stderr.once('data', data => resolve(data)));
}

function waitForStdout(process) {
  return new Promise(resolve => process.stdout.once('data', data => resolve(data)));
}

function getPortFromStdout(stdout) {
  return stdout.toString().match(/.*http:.*:(\d+).*/)[1];
}
