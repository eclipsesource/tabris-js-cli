const {join, resolve} = require('path');
const {writeFileSync, realpathSync} = require('fs-extra');
const temp = require('temp');
const {stub, expect, restore, waitForStdout, waitForStderr, writeTabrisProject} = require('./test');
const spawn = require('child_process').spawn;
const fetch = require('node-fetch');
const {platform} = require('os');
const WebSocket = require('ws');

// General note: On windows "spawn" can be unexpectedly slow.
// Therefore waitForStdout gets very long timeout, and as consequence
// the tests themselves get longer timeouts as well.

describe('serve', function() {

  let serve, path, env, webSocketClient;
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
    if (webSocketClient) {
      webSocketClient.close();
    }
    serve = null;
    restore();
  });

  it('fails when current working directory does not contain package.json', async function() {
    const srcFile = resolve('./src/tabris');
    serve = spawn('node', [srcFile, 'serve'], {cwd: path, env});

    const data = await waitForStderr(serve);
    expect(data.toString()).to.match(/must contain package.json/);

  }).timeout(8000);

  it('fails when given project directory does not contain package.json', async function() {
    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    const data = await waitForStderr(serve);
    expect(data.toString()).to.match(/must contain package.json/);
  }).timeout(8000);

  it('fails when given project path is not a directory', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', join(path, 'package.json')], {env});

    const data = await waitForStderr(serve);
    expect(data.toString()).to.match(/Project must be a directory/);
  }).timeout(8000);

  it('runs build script', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    const stdout = await waitForStdout(serve);
    expect(stdout).to.contain(`NPM run --if-present build [${path}]`);
  }).timeout(8000);

  it('runs watch script when -w option given', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path], {env});

    const stdout = await waitForStdout(serve);
    expect(stdout).to.contain(`NPM run --if-present watch [${path}]`);
  }).timeout(8000);

  it('serve exits with 1 when build script exits with a non 0 status', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {build: 'exit 123'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path]);

    const code = await waitForExit(serve);
    expect(code).to.equal(1);
  }).timeout(8000);

  it('serve prints build script stdout', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {build: 'echo 123'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path]);

    const stdout = await waitForStdout(serve);
    expect(stdout).to.contain('123');
  }).timeout(8000);

  it('serve prints build script stderr', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {build: 'echo 123 >&2'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path]);

    const stderr = await waitForStderr(serve);
    expect(stderr).to.contain('123');
  }).timeout(8000);

  it('serve exits with 1 when watch script exits with a non 0 status', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {watch: 'exit 123'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path]);

    const code = await waitForExit(serve);
    expect(code).to.equal(1);
  }).timeout(8000);

  it('serve prints watch script stdout', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {watch: 'echo 123'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path]);

    const stdout = await waitForStdout(serve);
    expect(stdout).to.contain('123');
  }).timeout(8000);

  it('serve prints watch script stderr', async function() {
    writeTabrisProject(path, JSON.stringify({main: 'foo.js', scripts: {watch: 'echo 123 >&2'}}));

    serve = spawn('node', ['./src/tabris', 'serve', '-w', '-p', path]);

    const stderr = await waitForStderr(serve);
    expect(stderr).to.contain('123');
  }).timeout(8000);

  it('starts a server on a directory given with -p', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path], {env});

    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout);
    const response = await fetch(`http://127.0.0.1:${port}/package.json`);
    const data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('does not reload client when a changed file was never loaded', async function() {
    writeTabrisProject(path);
    serve = spawn('node', ['./src/tabris', 'serve', '-wap', path], {env});
    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout);
    webSocketClient = await startFakeWebSocketClient(port);
    webSocketClient.onmessage = stub();

    writeFileSync(join(path, 'foo.js'), 'content');

    await waitForStdout(serve);
    expect(webSocketClient.onmessage).not.to.have.been.called;
  }).timeout(16000);

  it('reloads client when a preloaded file changes', async function() {
    writeTabrisProject(path);
    serve = spawn('node', ['./src/tabris', 'serve', '-wap', path], {env});
    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout);
    webSocketClient = await startFakeWebSocketClient(port);
    webSocketClient.onmessage = stub();
    await fetch(`http://127.0.0.1:${port}/package.json?getfiles=${encodeURIComponent('*')}`);
    await wait(500);

    writeFileSync(join(path, 'foo.js'), 'content');

    const res = await waitForStdout(serve);
    const {data} = webSocketClient.onmessage.getCall(0).args[0];
    expect(res).to.contain('foo.js\' changed, reloading app...');
    expect(JSON.parse(data)).to.deep.equal({'type': 'reload-app'});
  }).timeout(16000);

  it('reloads client when a non-preloaded file changes', async function() {
    writeTabrisProject(path);
    serve = spawn('node', ['./src/tabris', 'serve', '-wap', path], {env});
    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout);
    webSocketClient = await startFakeWebSocketClient(port);
    webSocketClient.onmessage = stub();
    await fetch(`http://127.0.0.1:${port}/foo.js`);

    writeFileSync(join(path, 'foo.js'), 'content');

    const res = await waitForStdout(serve);
    const {data} = webSocketClient.onmessage.getCall(0).args[0];
    expect(res).to.contain('foo.js\' changed, reloading app...');
    expect(JSON.parse(data)).to.deep.equal({'type': 'reload-app'});
  }).timeout(16000);

  it('does not reload client when the changed file was not a source file', async function() {
    writeTabrisProject(path);
    writeFileSync(join(path, 'bar'));
    serve = spawn('node', ['./src/tabris', 'serve', '-wap', path], {env});
    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout);
    webSocketClient = await startFakeWebSocketClient(port);
    webSocketClient.onmessage = stub();
    await fetch(`http://127.0.0.1:${port}/bar`);

    writeFileSync(join(path, 'bar'), 'content');

    expect(webSocketClient.onmessage).not.to.have.been.called;
  }).timeout(16000);

  it('starts a server on a directory given with --project', async function() {
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '--project', path], {env});

    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout);
    const response = await fetch(`http://127.0.0.1:${port}/package.json`);
    const data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('starts a server on cwd if project argument is missing', async function() {
    const srcFile = resolve('./src/tabris');
    writeTabrisProject(path);

    serve = spawn('node', [srcFile, 'serve'], {cwd: path, env});

    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout, 20);
    const response = await fetch(`http://127.0.0.1:${port}/package.json`);
    const data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('delivers a synthetic package.json when -m switch is used', async function() {
    // NOTE: currently does not check the module actually exists, this is done by the client
    const srcFile = resolve('./src/tabris');
    const file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '-m', 'foo.js'], {cwd: path, env});

    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout, 20);
    const response = await fetch(`http://127.0.0.1:${port}/package.json`);
    const data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('delivers a synthetic package.json when --main switch is used', async function() {
    const srcFile = resolve('./src/tabris');
    const file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '--main', 'foo.js'], {cwd: path, env});

    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout, 20);
    const response = await fetch(`http://127.0.0.1:${port}/package.json`);
    const data = await response.json();
    expect(data.main).to.equal('foo.js');
  }).timeout(8000);

  it('delivers a synthetic package.json when -m and -p switches are used', async function() {
    const file = join(path, 'bar.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path);

    serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-m', 'bar.js'], {env});

    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout, 20);
    const response = await fetch(`http://127.0.0.1:${port}/package.json`);
    const data = await response.json();
    expect(data.main).to.equal('bar.js');
  }).timeout(8000);

  it('delivers a synthetic package.json via getFiles', async function() {
    // NOTE: currently does not check the module actually exists, this is done by the client
    const srcFile = resolve('./src/tabris');
    const file = join(path, 'foo.js');
    writeFileSync(file, 'content');
    writeTabrisProject(path, '{}');

    serve = spawn('node', [srcFile, 'serve', '-m', 'foo.js'], {cwd: path, env});

    const stdout = await waitForStdout(serve);
    const port = getPortFromStdout(stdout, 20);
    const response = await fetch(`http://127.0.0.1:${port}/package.json?getfiles=${encodeURIComponent('*')}`);
    const data = await response.json();
    expect(JSON.parse(data['.']['package.json'].content).main).to.equal('foo.js');
  }).timeout(8000);

  describe('when logging is enabled', function() {

    it('requests are logged to the console', async function() {
      writeTabrisProject(path);

      serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-l'], {env});

      const stdout1 = await waitForStdout(serve, 10000);
      const port = getPortFromStdout(stdout1);
      const [stdout2] = await Promise.all([
        waitForStdout(serve, 10000),
        fetch(`http://127.0.0.1:${port}/package.json`)
      ]);
      const log = stdout2.toString();
      expect(log).to.contain('GET /package.json');
    }).timeout(30000);

    it('request errors are logged to the console', async function() {
      writeTabrisProject(path);
      serve = spawn('node', ['./src/tabris', 'serve', '-p', path, '-l'], {env});

      const stdout1 = await waitForStdout(serve, 10000);
      const port = getPortFromStdout(stdout1);
      const [stdout2] = await Promise.all([
        waitForStderr(serve, 10000),
        fetch(`http://127.0.0.1:${port}/non-existent`)
      ]);
      const log = stdout2.toString();
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

function getPortFromStdout(stdout) {
  const ports = stdout.match(/.*http:.*:(\d+).*/);
  expect(ports).to.be.a('array', 'No ports found in stdout: ' + stdout);
  return ports[1];
}

async function startFakeWebSocketClient(port) {
  const bootMinJs = await (await fetch(`http://127.0.0.1:${port}/node_modules/tabris/boot.min.js`)).text();
  const sessionId = bootMinJs.match(/sessionId: '(.*)',/m)[1];
  const serverId = bootMinJs.match(/serverId: '(.*)',/m)[1];
  return new Promise(resolve => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?session=${sessionId}&server=${serverId}`, '');
    ws.onopen = () => {
      ws.send(JSON.stringify({type: 'connect', parameter: {platform: 'foo', model: 'bar'}}));
      resolve(ws);
    };
  });
}

function wait(time) {
  return new Promise(resolve => setTimeout(resolve), time);
}
