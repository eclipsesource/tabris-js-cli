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

  it('fails when current working directory does not contain package.json', async function() {
    let srcFile = resolve('./src/tabris');
    serve = spawn('node', [srcFile, 'serve'], {cwd: path, env});

    let data = await waitForStderr(serve);
    expect(data.toString()).to.match(/must contain package.json/);

  }).timeout(8000);

  it('fails when given project directory does not contain package.json', async function() {
    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    let data = await waitForStderr(serve);
    expect(data.toString()).to.match(/must contain package.json/);
  }).timeout(8000);

  it('fails when given project path is not a directory', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', join(path, 'package.json')], {env});

    let data = await waitForStderr(serve);
    expect(data.toString()).to.match(/Project must be a directory/);
  }).timeout(8000);

  it('runs build script', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    let stdout = await waitForStdout(serve);
    expect(stdout).to.contain(`NPM run --if-present build [${path}]`);
  }).timeout(8000);

  it('runs build and watch scripts when -w option given', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path], {env});

    let stdout = await waitForStdout(serve);
    expect(stdout).to.contain(`NPM run --if-present build [${path}]`);
    expect(stdout).to.contain(`NPM run --if-present watch [${path}]`);
  }).timeout(8000);

  it('serve exits with 1 when build script exits with a non 0 status', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {build: 'exit 123'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path]);

    let code = await waitForExit(serve);
    expect(code).to.equal(1);
  }).timeout(8000);

  it('serve prints build script stdout', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {build: 'echo 123'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path]);

    let stdout = await waitForStdout(serve);
    expect(stdout).to.contain('123');
  }).timeout(8000);

  it('serve prints build script stderr', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {build: 'echo 123 >&2'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path]);

    let stderr = await waitForStderr(serve);
    expect(stderr).to.contain('123');
  }).timeout(8000);

  it('serve exits with 1 when watch script exits with a non 0 status', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {watch: 'exit 123'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path]);

    let code = await waitForExit(serve);
    expect(code).to.equal(1);
  }).timeout(8000);

  it('serve prints watch script stdout', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {watch: 'echo 123'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path]);

    let stdout = await waitForStdout(serve);
    expect(stdout).to.contain('123');
  }).timeout(8000);

  it('serve prints watch script stderr', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {watch: 'echo 123 >&2'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path]);

    let stderr = await waitForStderr(serve);
    expect(stderr).to.contain('123');
  }).timeout(8000);

  it('starts a server on a directory given with -p', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    let stdout = await waitForStdout(serve);
    let port = getPortFromStdout(stdout);
    let response = await fetch(`http://127.0.0.1:${port}/package.json`);
    let data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('starts a server on a directory given with --project', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '--project', path], {env});

    let stdout = await waitForStdout(serve);
    let port = getPortFromStdout(stdout);
    let response = await fetch(`http://127.0.0.1:${port}/package.json`);
    let data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('starts a server on cwd if project argument is missing', async function() {
    let srcFile = resolve('./src/tabris');
    writeTabrisProject(path);

    serve = spawn('node', [srcFile, 'serve'], {cwd: path, env});

    let stdout = await waitForStdout(serve);
    let port = getPortFromStdout(stdout, 20);
    let response = await fetch(`http://127.0.0.1:${port}/package.json`);
    let data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('delivers a synthetic package.json when -m switch is used', async function() {
    // NOTE: currently does not check the module actually exists, this is done by the client
    let srcFile = resolve('./src/tabris');
    let file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '-m', 'foo.js'], {cwd: path, env});

    let stdout = await waitForStdout(serve);
    let port = getPortFromStdout(stdout, 20);
    let response = await fetch(`http://127.0.0.1:${port}/package.json`);
    let data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('delivers a synthetic package.json when --main switch is used', async function() {
    let srcFile = resolve('./src/tabris');
    let file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '--main', 'foo.js'], {cwd: path, env});

    let stdout = await waitForStdout(serve);
    let port = getPortFromStdout(stdout, 20);
    let response = await fetch(`http://127.0.0.1:${port}/package.json`);
    let data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('delivers a synthetic package.json when -m and -p switches are used', async function() {
    let file = join(path, 'bar.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-m', 'bar.js'], {env});

    let stdout = await waitForStdout(serve);
    let port = getPortFromStdout(stdout, 20);
    let response = await fetch(`http://127.0.0.1:${port}/package.json`);
    let data = await response.json();
    expect(data.main).to.equal('bar.js');
  }).timeout(8000);

  it('delivers a synthetic package.json via getFiles', async function() {
    // NOTE: currently does not check the module actually exists, this is done by the client
    let srcFile = resolve('./src/tabris');
    let file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '-m', 'foo.js'], {cwd: path, env});

    let stdout = await waitForStdout(serve);
    let port = getPortFromStdout(stdout, 20);
    let response = await fetch(`http://127.0.0.1:${port}/package.json?getfiles=${encodeURIComponent('*')}`);
    let data = await response.json();
    expect(JSON.parse(data['.']['package.json'].content).main).to.equal('foo.js');
  }).timeout(8000);

  describe('when logging is enabled', function() {

    it('requests are logged to the console', async function() {
      writeTabrisProject(path);

      serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-l'], {env});

      let stdout1 = await waitForStdout(serve, 10000);
      let port = getPortFromStdout(stdout1);
      let [stdout2] = await Promise.all([
        waitForStdout(serve, 10000),
        fetch(`http://127.0.0.1:${port}/package.json`)
      ]);
      let log = stdout2.toString();
      expect(log).to.contain('GET /package.json');
    }).timeout(30000);

    it('request errors are logged to the console', async function() {
      writeTabrisProject(path);
      serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-l'], {env});

      let stdout1 = await waitForStdout(serve, 10000);
      let port = getPortFromStdout(stdout1);
      let [stdout2] = await Promise.all([
        waitForStderr(serve, 10000),
        fetch(`http://127.0.0.1:${port}/non-existent`)
      ]);
      let log = stdout2.toString();
      expect(log).to.contain('GET /non-existent: "404: Not found"');
    }).timeout(30000);

  });

});

function waitForExit(process, timeout = 5000) {
  return new Promise((resolve, reject) => {
    process.on('exit', code => resolve(code));
    setTimeout(() => reject(new Error('waitForExit timeout')), timeout);
  });
}
function waitForStderr(process, timeout = 2000) {
  return new Promise((resolve, reject) => {
    process.stderr.once('data', data => resolve(data.toString()));
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
