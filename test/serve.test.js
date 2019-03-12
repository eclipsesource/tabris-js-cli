const {join, resolve} = require('path');
const {writeFileSync, realpathSync} = require('fs-extra');
const temp = require('temp');
const {expect, restore, writeTabrisProject} = require('./test');
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
      PATH: mockBinDir + (platform() === 'win32' ? ';' : ':') + process.env.PATH
    };
  });

  afterEach(() => {
    if (serve) {
      serve.kill();
    }
    serve = null;
    restore();
  });

  it('fails when current working directory does not contain package.json', function() {
    let srcFile = resolve('./src/tabris');
    serve = spawn('node', [srcFile, 'serve'], {cwd: path, env});

    return waitForStderr(serve).then((data) => {
      expect(data.toString()).to.match(/must contain package.json/);
    });

  }).timeout(8000);

  it('fails when given project directory does not contain package.json', function() {
    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    return waitForStderr(serve).then((data) => {
      expect(data.toString()).to.match(/must contain package.json/);
    });
  }).timeout(8000);

  it('fails when given project path is not a directory', function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', join(path, 'package.json')], {env});

    return waitForStderr(serve).then((data) => {
      expect(data.toString()).to.match(/Project must be a directory/);
    });
  }).timeout(8000);

  it('runs build script', function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    return waitForStdout(serve)
      .then(stdout => {
        expect(stdout).to.contain(`NPM run --if-present build [${path}]`);
      });
  }).timeout(8000);

  it('runs watch script when -w option given', function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path], {env});

    return waitForStdout(serve)
      .then(stdout => {
        expect(stdout).to.contain(`NPM run --if-present watch [${path}]`);
      });
  }).timeout(8000);

  it('starts a server on a directory given with -p', function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  }).timeout(8000);

  it('starts a server on a directory given with --project', function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '--project', path], {env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  }).timeout(8000);

  it('starts a server on cwd if project argument is missing', function() {
    let srcFile = resolve('./src/tabris');
    writeTabrisProject(path);

    serve = spawn('node', [srcFile, 'serve'], {cwd: path, env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout, 20))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  }).timeout(8000);

  it('delivers a synthetic package.json when -m switch is used', function() {
    // NOTE: currently does not check the module actually exists, this is done by the client
    let srcFile = resolve('./src/tabris');
    let file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '-m', 'foo.js'], {cwd: path, env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout, 20))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  }).timeout(8000);

  it('delivers a synthetic package.json when --main switch is used', function() {
    let srcFile = resolve('./src/tabris');
    let file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '--main', 'foo.js'], {cwd: path, env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout, 20))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('foo.js')
      );
  }).timeout(8000);

  it('delivers a synthetic package.json when -m and -p switches are used', function() {
    let file = join(path, 'bar.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-m', 'bar.js'], {env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout, 20))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json`))
      .then(response => response.json())
      .then(data =>
        expect(data.main).to.equal('bar.js')
      );
  }).timeout(8000);

  it('delivers a synthetic package.json via getFiles', function() {
    // NOTE: currently does not check the module actually exists, this is done by the client
    let srcFile = resolve('./src/tabris');
    let file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '-m', 'foo.js'], {cwd: path, env});

    return waitForStdout(serve)
      .then(stdout => getPortFromStdout(stdout, 20))
      .then(port => fetch(`http://127.0.0.1:${port}/package.json?getfiles=${encodeURIComponent('*')}`))
      .then(response => response.json())
      .then(data =>
        expect(JSON.parse(data['.']['package.json'].content).main).to.equal('foo.js')
      );
  }).timeout(8000);

  describe('when logging is enabled', function() {

    it('requests are logged to the console', function() {
      writeTabrisProject(path);

      serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-l'], {env});

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
      writeTabrisProject(path);
      serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-l'], {env});

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

function waitForStderr(process, timeout = 2000) {
  return new Promise((resolve, reject) => {
    process.stderr.once('data', data => resolve(data));
    setTimeout(() => reject('waitForStderr timed out'), timeout);
  });
}

function waitForStdout(process, timeout = 2000) {
  let stdout = '';
  process.stdout.on('data', data => {
    stdout += data;
  });
  return new Promise((resolve, reject) => {
    process.stderr.once('data', data => {
      reject(new Error('waitForStdout rejected with stderr ' + data.toString()));
    });
    setTimeout(() => resolve(stdout), timeout);
  });
}

function getPortFromStdout(stdout) {
  let ports = stdout.match(/.*http:.*:(\d+).*/);
  expect(ports).to.be.a('array', 'No ports found in stdout: ' + stdout);
  return ports[1];
}
