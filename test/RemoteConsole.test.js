const spawn = require('child_process').spawn;
const temp = require('temp');
const DebugServer = require('../src/services/DebugServer');
const RemoteConsole = require('../src/services/RemoteConsole');
const MockWebSocketServer = require('mock-socket').Server;
const MockWebSocketClient = require('mock-socket').WebSocket;
const {expect, restore} = require('./test');
const {getDebugClient} = require('../src/services/getBootJs');
const TerminalMock = require('./TerminalMock');

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

  describe('integration tests', function() {

    it('enables interactive console when option -i is given', function() {
      let {path} = temp.openSync('foo');
      serve = spawn('node', ['./src/tabris', 'serve', '-m', path, '-i']);

      return waitForStdout(serve, 4000)
        .then(log =>
          expect(log).to.contain('>>')
        );
    });

    it('prints error on input when no device is connected', function() {
      let {path} = temp.openSync('foo');
      serve = spawn('node', ['./src/tabris', 'serve', '-m', path, '-i']);

      return waitForStdout(serve, 2700)
        .then(() => {
          serve.stdin.write('test command\n');
          return waitForStderr(serve, 2700);
        }).then(log =>
          expect(log).to.contain('Command could not be sent: no device connected')
        );
    });

  });

  describe('when device is connected', function() {

    let webSocketFactory = {
      createWebSocket() {
        return new MockWebSocketClient(WEBSOCKET_URL);
      }
    };

    let debugServer, webSocketServer, terminal;

    beforeEach(function() {
      terminal = new TerminalMock();
      global.tabris = {};
      global.tabris.device = {platform: 'Android', model: 'Pixel 2'};
      webSocketServer = new MockWebSocketServer(WEBSOCKET_URL);
      debugServer = new DebugServer(webSocketServer, terminal);
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

    it('send console.log command and print result', function() {
      const command = 'global.debugClient.remoteConsole.log(5 * 2)';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        terminal.emit('line', command);
        return waitForCalls(terminal.log, 3);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(log).to.contain('10');
        return true;
      });
    });

    it('send plain JS command and print result', function() {
      const command = '5 * 2';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        terminal.emit('line', command);
        return waitForCalls(terminal.log, 3);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(log).to.contain('10');
        return true;
      });
    });

    it('print object value without console log method', function() {
      const command = 'tabris.device';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        terminal.emit('line', command);
        return waitForCalls(terminal.log, 3);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(log).to.contain(JSON.stringify(global.tabris.device));
        return true;
      });
    });

    it('can not create local variable', function() {
      const command = 'var a = "foo"; global.debugClient.remoteConsole.log(a + "bar");';
      const command2 = 'global.debugClient.remoteConsole.log("a is " + typeof a)';
      return createRemoteConsole(debugServer, webSocketFactory).then(() => {
        terminal.emit('line', command);
        terminal.emit('line', command2);
        return waitForCalls(terminal.log, 5);
      }).then(log => {
        expect(log).to.contain('connected');
        expect(log).to.contain('foobar');
        expect(log).to.contain('a is undefined');
        return true;
      });
    });

    // TODO: replace with Terminal test
    // it('keep JS input and cursor position when new log message is arrived', function() {
    //   const command = '5 * 3', input = 'JavaScript input';
    //   return createRemoteConsole(debugServer, webSocketFactory).then(() => {
    //     terminal.line = input;
    //     terminal.cursor = input.length;
    //     console.log(new Function('return (' + command + ')')());
    //     return waitForCalls(terminal.log, 3);
    //   }).then(log => {
    //     expect(log).to.contain('connected');
    //     expect(terminal.line).to.equal(input);
    //     expect(terminal.cursor).to.equal(input.length);
    //     return true;
    //   });
    // });

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
              global.debugClient.remoteConsole = remoteConsole;
              resolve(remoteConsole);
            }
          }
        }, 100);
      });
    }

  });

});

function waitForStderr(process, timeout = 2000) {
  return new Promise((resolve, reject) => {
    process.stderr.once('data', data => resolve(data.toString()));
    setTimeout(() => reject('waitForStderr timed out'), timeout);
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
