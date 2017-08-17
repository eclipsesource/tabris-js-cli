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

    return waitForStdout(serve, 3)
      .then(stdout => {
        expect(stdout).to.contain(`NPM run --if-present build [${path}]`);
      });
  });

  it('starts a server on a given directory', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    serve = spawn('node', ['./src/tabris', 'serve', path], {env});

    return waitForStdout(serve, 3)
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

    return waitForStdout(serve, 3)
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
    });

    it('request errors are logged to the console', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      serve = spawn('node', ['./src/tabris', 'serve', path, '-l'], {env});

      return waitForStdout(serve, 3)
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

});

function waitForStderr(process) {
  return new Promise(resolve => process.stderr.once('data', data => resolve(data)));
}

function waitForStdout(process, lines = 1) {
  let readLines = 0;
  let stdout = '';
  return new Promise(resolve => {
    process.stdout.on('data', data => {
      stdout += data;
      readLines++;
      if (readLines >= lines) {
        resolve(stdout);
      }
    });
  });
}

function getPortFromStdout(stdout) {
  return stdout.toString().match(/.*http:.*:(\d+).*/)[1];
}
