const spawn = require('child_process').spawn;
const temp = require('temp');
const {join} = require('path');
const DebugServer = require('../src/services/DebugServer');
const {readFileSync} = require('fs-extra');
const RemoteConsoleUI = require('../src/services/RemoteConsoleUI');
const MockWebSocketServer = require('mock-socket').Server;
const MockWebSocketClient = require('mock-socket').WebSocket;
const {expect, restore, spy} = require('./test');

const PORT = 9000;
const WEBSOCKET_URL = `ws://127.0.0.1:${PORT}/?id=1`;

describe('Remote Console UI', function() {

  this.timeout(6000);

  let serve;

  afterEach(() => {
    if (serve) {
      serve.kill();
    }
    serve = null;
    restore();
  });

  it('enable interactive console when option -i is given', function() {
    let {path} = temp.openSync('foo');
    serve = spawn('node', ['./src/tabris', 'serve', '-m', path, '-i']);

    return waitForStdout(serve, 4000)
      .then(log =>
        expect(log).to.contain('>>')
      );
  });

  it('when device is not connected', function() {
    let {path} = temp.openSync('foo');
    serve = spawn('node', ['./src/tabris', 'serve', '-m', path, '-i']);
    const command = 'test command';
    serve.stdin.write(`${command}\n`);

    return waitForStdout(serve, 2700)
      .then(log =>
        expect(log).to.contain('Command could not be sent: no device connected')
      );
  });

  describe('when device is connected', function() {

    let webSocketFactory = {
      createWebSocket() {
        return new MockWebSocketClient(WEBSOCKET_URL);
      }
    };
    let debugServer = null, webSocketServer = null, remoteConsoleUI = null;

    beforeEach(function() {
      global.tabris = {};
      global.tabris.device = {platform: 'Android', model: 'Pixel 2'};
      webSocketServer = new MockWebSocketServer(WEBSOCKET_URL);
      debugServer = new DebugServer(webSocketServer);
      debugServer.start();
      remoteConsoleUI = new RemoteConsoleUI(debugServer);
      const debugClientJs = readFileSync(join(__dirname, '..', 'resources', 'debugClient.js'), 'utf8');
      eval(debugClientJs.replace('AUTO_RECONNECT_INTERVAL = 2000', 'AUTO_RECONNECT_INTERVAL = 500'));
      spy(console, 'log');
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

    it('send console.log command and print result', function() {
      const command = 'console.log(5 * 2)';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        remoteConsoleUI._readline.emit('line', command);
        return waitForCalls(console.log, 3);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(log).to.contain('10');
        return true;
      });
    });

    it('send plain JS command and print result', function() {
      const command = '5 * 2';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        remoteConsoleUI._readline.emit('line', command);
        return waitForCalls(console.log, 3);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(log).to.contain('10');
        return true;
      });
    });

    it('print object value without console log method', function() {
      const command = 'tabris.device';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        remoteConsoleUI._readline.emit('line', command);
        return waitForCalls(console.log, 3);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(log).to.contain(JSON.stringify(global.tabris.device));
        return true;
      });
    });

    it('can not create local variable', function() {
      const command = 'var a = "foo"; console.log(a + "bar");';
      const command2 = 'console.log("a is ", typeof a)';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        remoteConsoleUI._readline.emit('line', command);
        remoteConsoleUI._readline.emit('line', command2);
        return waitForCalls(console.log, 5);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(log).to.contain('foobar');
        expect(log).to.contain('a is undefined');
        return true;
      });
    });

    it('keep JS input and cursor position when new log message is arrived', function() {
      const command = '5 * 3', input = 'JavaScript input';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        remoteConsoleUI._readline.line = input;
        remoteConsoleUI._readline.cursor = input.length;
        console.log(new Function('return (' + command + ')')());
        return waitForCalls(console.log, 3);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(remoteConsoleUI._readline.line).to.equal(input);
        expect(remoteConsoleUI._readline.cursor).to.equal(input.length);
        return true;
      });
    });

    function createRemoteConsole(server, webSocketFactory) {
      const remoteConsole = new global.debugClient.RemoteConsole(webSocketFactory, server.getNewSessionId());
      return new Promise((resolve, reject) => {
        let count = 0;
        const interval = setInterval(() => {
          if (++count > 20) {
            reject('remote console could not connect');
          } else {
            if (debugServer._isConnectionAlive()) {
              clearInterval(interval);
              resolve(remoteConsole);
            }
          }
        }, 100);
      });
    }

  });

});

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
