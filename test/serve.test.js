const {join,resolve} = require('path');
const {writeFileSync, realpathSync} = require('fs-extra');
const temp = require('temp').track();
const {expect} = require('./test');
const spawn = require('child_process').spawn;
const fetch = require('node-fetch');

describe('serve', function() {

  let serve, path, env;
  const mockBinDir = join(__dirname, 'bin');

  beforeEach(function() {
    path = realpathSync(temp.mkdirSync('foo'));
    env = {PATH: mockBinDir + ':' + process.env.PATH};
  });

  afterEach(() => {
    if (serve) {
      serve.kill();
    }
    serve = null;
  });

  it('fails when file does not exist', function() {
    serve = spawn('node', ['./src/tabris', 'serve', 'foobar.js'], {env});

    return waitForStderr(serve).then((data) => {
      expect(data.toString()).to.match(/No such file or directory: foobar.js/);
    });
  });

  it('runs build script', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    serve = spawn('node', ['./src/tabris', 'serve', path], {env});

    return waitForStdout(serve)
      .then(stdout => {
        expect(stdout).to.contain(`NPM run --if-present build [${path}]`);
      });
  });

  it('runs watch script when -w option given', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    serve = spawn('node', ['./src/tabris', 'serve', '-w', path], {env});

    return waitForStdout(serve)
      .then(stdout => {
        expect(stdout).to.contain(`NPM run --if-present watch [${path}]`);
      });
  });

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
  });

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
  });

  describe('when logging is enabled', function() {

    it('requests are logged to the console', function() {
      let {path} = temp.openSync('foo');
      serve = spawn('node', ['./src/tabris', 'serve', path, '-l'], {env});

      return waitForStdout(serve)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => {
          return Promise.all([
            waitForStdout(serve),
            fetch(`http://127.0.0.1:${port}/package.json`)
          ]);
        })
        .then(([stdout]) => stdout.toString())
        .then(log =>
          expect(log).to.contain('GET /package.json')
        );
    }).timeout(3000);

    it('request errors are logged to the console', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      serve = spawn('node', ['./src/tabris', 'serve', path, '-l'], {env});

      return waitForStdout(serve)
        .then(stdout => getPortFromStdout(stdout))
        .then(port => Promise.all([
          waitForStderr(serve),
          fetch(`http://127.0.0.1:${port}/non-existent`)
        ]))
        .then(([stderr]) => stderr.toString())
        .then(log =>
          expect(log).to.contain('GET /non-existent 404: "Not found"')
        );
    });

  });

  it('print debug websocket address on run', function() {
    let {path} = temp.openSync('foo');
    serve = spawn('node', ['./src/tabris', 'serve', path], {env});

    return waitForStdout(serve)
      .then(stdout => stdout.toString())
      .then(log =>
        expect(log).to.match(/Debug WebSocket: ws:\/\/(?:[0-9]{1,3}\.){3}[0-9]{1,3}\:[0-9]{2,4}/)
      );
  });

});

function waitForStderr(process) {
  return new Promise(resolve => process.stderr.once('data', data => resolve(data)));
}

function waitForStdout(process, timeout = 800) {
  let stdout = '';
  process.stdout.on('data', data => {
    stdout += data;
  });
  return new Promise(resolve => {
    setTimeout(() => resolve(stdout), timeout);
  });
}

function getPortFromStdout(stdout) {
  let ports = stdout.toString().match(/.*http:.*:(\d+).*/);
  expect(ports).to.be.a('array', 'No ports found in stdout');
  return ports[1];
}
