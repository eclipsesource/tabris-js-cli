const temp = require('temp');
const os = require('os');
const fetch = require('node-fetch');
const {join} = require('path');
const Server = require('../src/services/Server');
const AppReloader = require('../src/services/AppReloader');
const {expect, restore, spy, waitForCalls, writeTabrisProject} = require('./test');
const {writeFileSync, realpathSync, mkdirSync} = require('fs-extra');
const TerminalMock = require('./TerminalMock.js');

describe('AppReloader', function() {

  let server, path, oldCwd, reloader;

  this.timeout(6000);

  beforeEach(function() {
    path = realpathSync(temp.mkdirSync('foo'));
    oldCwd = process.cwd();
    process.chdir(path);
    server = new Server({terminal: new TerminalMock()});
    reloader = new AppReloader(server);
    reloader.start();
  });

  afterEach(function() {
    process.chdir(oldCwd);
    reloader.stop();
    restore();
  });

  it('does not send reload command when changed file was never requested', async function() {
    writeTabrisProject(path);
    await server.serve(path);
    await fetch(`http://127.0.0.1:${server.port}/foo.js`);
    spy(server.debugServer, 'evaluate');
    await overwriteFileContent(join(path, 'bar.js'));
    return new Promise(resolve => {
      setTimeout(() => {
        expect(server.debugServer.evaluate).not.to.have.been.called;
        resolve();
      }, 1500);
    });
  });

  it('sends a reload command when changed file was requested', async function() {
    writeTabrisProject(path);
    await server.serve(path);
    await fetch(`http://127.0.0.1:${server.port}/foo.js`);
    spy(server.debugServer, 'reloadApp');
    await overwriteFileContent(join(path, 'foo.js'));
    await waitForCalls(server.debugServer.reloadApp);
  });

  it('sends a reload command when changed source file is in requested directory', async function() {
    mkdirSync(join(path, 'bar'));
    writeTabrisProject(path, '{"main": "bar/foo.js"}');
    await overwriteFileContent(join(path, 'bar', 'foo.js'));
    await overwriteFileContent(join(path, 'bar', 'baz.js'));
    await server.serve(path);
    await fetch(`http://127.0.0.1:${server.port}/bar?getfiles=${encodeURIComponent('*')}`);
    spy(server.debugServer, 'reloadApp');
    await overwriteFileContent(join(path, 'bar', 'baz.js'));
    await waitForCalls(server.debugServer.reloadApp);
  });

  it('sends a reload command when changed source file is in requested project root directory', async function() {
    writeTabrisProject(path);
    await server.serve(path);
    await fetch(`http://127.0.0.1:${server.port}/package.json?getfiles=${encodeURIComponent('*')}`);
    spy(server.debugServer, 'reloadApp');
    await overwriteFileContent(join(path, 'foo.js'));
    await waitForCalls(server.debugServer.reloadApp);
  });

  it('does not send reload command when changed non-source file is in request directory', async function() {
    mkdirSync(join(path, 'bar'));
    writeTabrisProject(path, '{"main": "bar/foo.js"}');
    await overwriteFileContent(join(path, 'bar', 'foo.js'));
    await overwriteFileContent(join(path, 'bar', 'baz'));
    await server.serve(path);
    await fetch(`http://127.0.0.1:${server.port}/bar?getfiles=${encodeURIComponent('*')}`);
    spy(server.debugServer, 'evaluate');
    await overwriteFileContent(join(path, 'bar', 'baz'));
    return new Promise(resolve => {
      setTimeout(() => {
        expect(server.debugServer.evaluate).not.to.have.been.called;
        resolve();
      }, 1500);
    });
  });

});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function overwriteFileContent(path) {
  if (os.platform() === 'darwin') {
    await wait(100);
  }
  writeFileSync(path, 'overwritten-content');
}
