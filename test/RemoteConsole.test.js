const spawn = require('child_process').spawn;
const temp = require('temp');
const DebugServer = require('../src/services/DebugServer');
const RemoteConsole = require('../src/services/RemoteConsole');
const MockWebSocketServer = require('mock-socket').Server;
const MockWebSocketClient = require('mock-socket').WebSocket;
const {expect, restore, writeTabrisProject} = require('./test');
const {getDebugClient} = require('../src/services/getBootJs');
const TerminalMock = require('./TerminalMock');
const {realpathSync} = require('fs-extra');
const {join} = require('path');

const PORT = 9000;
const SERVER_ID = 'fooserver';
const WEBSOCKET_URL = `ws://127.0.0.1:${PORT}/?session=1&server=${SERVER_ID}`;
const REMOTE_URL = '192.168.1.1';

MockWebSocketServer.prototype.ping = () => {};

describe('Remote Console', function() {

  this.timeout(6000);

  let serve;

  afterEach(() => {
    if (serve) {
      serve.kill();
    }
    serve = null;
    restore();
  });

  describe('integration tests', function() {

    let path, oldCwd;

    beforeEach(function() {
      path = realpathSync(temp.mkdirSync('foo'));
      oldCwd = process.cwd();
      process.chdir(path);
    });

    afterEach(function() {
      process.chdir(oldCwd);
      restore();
    });

    it('enables interactive console when option -i is given', async function() {
      writeTabrisProject(path, '{}');
      serve = spawn('node', [join(oldCwd, './src/tabris'), 'serve', '-m', './foo.js', '-i']);

      const log = await waitForStdout(serve, 4000);
      expect(log).to.contain('>>');
    });

    it('prints error on input when no device is connected', async function() {
      writeTabrisProject(path, '{}');
      serve = spawn('node', [join(oldCwd, './src/tabris'), 'serve', '-m', './foo.js', '-i']);

      await waitForStdout(serve, 2700);
      serve.stdin.write('test command\n');
      const log = await waitForStderr(serve, 2700);
      expect(log).to.contain('Command could not be sent: no device connected');
    });

  });

  describe('when device is connected', function() {

    let webSocketFactory = {
      createWebSocket() {
        const client = new MockWebSocketClient(WEBSOCKET_URL);
        // Mock is missing this in 'connect' event:
        client.connection = {remoteAddress: REMOTE_URL};
        return client;
      }
    };

    let debugServer, webSocketServer, terminal;

    beforeEach(function() {
      terminal = new TerminalMock();
      global.tabris = {};
      global.tabris.device = {platform: 'Android', model: 'Pixel 2'};
      global.tabris.format = v => `format(${v})`;
      webSocketServer = new MockWebSocketServer(WEBSOCKET_URL);
      debugServer = new DebugServer(webSocketServer, terminal, SERVER_ID);
      debugServer.start();
      new RemoteConsole(debugServer, terminal);
      eval(getDebugClient('').replace('AUTO_RECONNECT_INTERVAL = 2000', 'AUTO_RECONNECT_INTERVAL = 500'));
    });

    afterEach(() => {
      if (debugServer._connection) {
        debugServer.stop();
      }
      webSocketServer.stop();
      if (global.debugClient) {
        if (global.debugClient.remoteConsole) {
          global.debugClient.remoteConsole.dispose();
        }
        delete global.debugClient;
      }
      if (global.tabris) {
        delete global.tabris;
      }
    });

    it('send console.log command and print result', async function() {
      const command = 'global.debugClient.remoteConsole.log(5 * 2)';
      await createRemoteConsole(debugServer, webSocketFactory);
      terminal.emit('line', command);
      const log = await waitForCalls(terminal.log, 3);
      expect(log).to.contain('connected');
      expect(log).to.contain('10');
    });

    it('send plain JS command and print result', async function() {
      const command = '5 * 2';
      await createRemoteConsole(debugServer, webSocketFactory);
      terminal.emit('line', command);
      const log = await waitForCalls(terminal.log, 2);
      expect(log).to.contain('connected');
      expect(log).to.contain('10');
    });

    it('print object value without console log method', async function() {
      const command = 'tabris.device.platform';
      await createRemoteConsole(debugServer, webSocketFactory);
      terminal.emit('line', command);
      const log = await waitForCalls(terminal.log, 2);
      expect(log).to.contain('connected');
      expect(log).to.contain('format(Android)');
    });

    it('cannot modify scope of RemoteConsole methods', async function() {
      await createRemoteConsole(debugServer, webSocketFactory);
      terminal.emit('line', 'let _log = this.log; this.log = function() { _log.call(this, "log_hijacked") }');
      const log = await waitForCalls(terminal.log, 2);
      expect(log).not.to.contain('\nlog_hijacked');
    });

    function createRemoteConsole(server, webSocketFactory) {
      const remoteConsole = new global.debugClient.RemoteConsole(webSocketFactory, server.getNewSessionId());
      return new Promise((resolve, reject) => {
        let count = 0;
        const interval = setInterval(() => {
          if (++count > 20) {
            reject('remote console could not connect');
          } else if (debugServer.activeConnections > 0) {
            clearInterval(interval);
            global.debugClient.remoteConsole = remoteConsole;
            resolve(remoteConsole);
          }
        }, 100);
      });
    }

  });

});

function waitForStderr(process, timeout = 2000) {
  return new Promise((resolve, reject) => {
    process.stderr.once('data', data => resolve(data.toString()));
    setTimeout(() => reject(new Error('waitForStderr timed out')), timeout);
  });
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

function waitForCalls(spyInstance, minCallCount = 1) {
  let attempts = 0;
  const maxAttempts = 15;
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (spyInstance.callCount === minCallCount) {
        clearInterval(interval);
        let messages = [];
        for (const call of spyInstance.getCalls()) {
          messages.push(call.args
            .map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
            .join(''));
        }
        resolve(messages.join('\n'));
      } else if (++attempts > maxAttempts || spyInstance.callCount > minCallCount) {
        clearInterval(interval);
        reject();
      }
    }, 100);
  });
}
