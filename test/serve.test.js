const {join,resolve} = require('path');
const {writeFileSync, realpathSync} = require('fs-extra');
const temp = require('temp');
const {expect, restore} = require('./test');
const spawn = require('child_process').spawn;
const fetch = require('node-fetch');
const {platform} = require('os');

// General note: On windows "spawn" can be unexpectedly slow.
// Therefore waitForStdout gets very long timeout, and as consequence
// the tests themselves get longer timeouts as well.

describe('serve', function() {

  let serve, path, env;
  const mockBinDir = join(__dirname, 'bin');

  beforeEach(function() {
    path = realpathSync(temp.mkdirSync('foo'));
    env = {
      PATH: mockBinDir + (platform() === 'win32' ? ';' : ':') + process.env.PATH,
    };
  });

  afterEach(() => {
    if (serve) {
      serve.kill();
    }
    serve = null;
    restore();
  });

  it('fails when file does not exist', function() {
    serve = spawn('node', ['./src/tabris', 'serve', 'foobar.js'], {env});

    return waitForStderr(serve).then((data) => {
      expect(data.toString()).to.match(/No such file or directory: foobar.js/);
    });
  }).timeout(8000);

  it('runs build script', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    serve = spawn('node', ['./src/tabris', 'serve', path], {env});

    return waitForStdout(serve)
      .then(stdout => {
        expect(stdout).to.contain(`NPM run --if-present build [${path}]`);
      });
  }).timeout(8000);

  it('runs watch script when -w option given', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    serve = spawn('node', ['./src/tabris', 'serve', '-w', path], {env});

    return waitForStdout(serve)
      .then(stdout => {
        expect(stdout).to.contain(`NPM run --if-present watch [${path}]`);
      });
  }).timeout(8000);

  it('starts a server on a given directory', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    serve = spawn('node', ['./src/tabris', 'serve', path], {env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  }).timeout(8000);

  it('starts a server on cwd if path argument missing', function() {
    let srcFile = resolve('./src/tabris');
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    serve = spawn('node', [srcFile, 'serve'], {cwd: path, env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout, 20))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  }).timeout(8000);

  describe('when logging is enabled', function() {

    it('requests are logged to the console', function() {
      let {path} = temp.openSync('foo');
      serve = spawn('node', ['./src/tabris', 'serve', path, '-l'], {env});

      return waitForStdout(serve, 10000)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => {
          return Promise.all([
            waitForStdout(serve, 10000),
            fetch(`http://127.0.0.1:${port}/package.json`)
          ]);
        })
        .then(([stdout]) => stdout.toString())
        .then(log =>
          expect(log).to.contain('GET /package.json')
        );
    }).timeout(30000);

    it('request errors are logged to the console', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      serve = spawn('node', ['./src/tabris', 'serve', path, '-l'], {env});

      return waitForStdout(serve, 10000)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => Promise.all([
          waitForStderr(serve, 10000),
          fetch(`http://127.0.0.1:${port}/non-existent`)
        ]))
        .then(([stderr]) => stderr.toString())
        .then(log =>
          expect(log).to.contain('GET /non-existent 404: "Not found"')
        );
    }).timeout(30000);

  });

});

function waitForStderr(process) {
  return new Promise(resolve => process.stderr.once('data', data => resolve(data)));
}

function waitForStdout(process, timeout = 2000) {
  let stdout = '';
  process.stdout.on('data', data => {
    stdout += data;
  });
  return new Promise(resolve => {
    setTimeout(() => resolve(stdout), timeout);
  });
}

function getPortFromStdout(stdout) {
  let ports = stdout.match(/.*http:.*:(\d+).*/);
  expect(ports).to.be.a('array', 'No ports found in stdout: ' + stdout);
  return ports[1];
}
