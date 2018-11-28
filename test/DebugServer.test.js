const DebugServer = require('../src/services/DebugServer');
const {expect, restore, spy} = require('./test');
const MockWebSocketServer = require('mock-socket').Server;
const MockWebSocketClient = require('mock-socket').WebSocket;
const {getDebugClient} = require('../src/services/getBootJs');

const PORT = 9000;
const WEBSOCKET_URL = `ws://127.0.0.1:${PORT}/?id=1`;

describe('DebugServer', () => {

  let webSocketFactory = {
    createWebSocket() {
      return new MockWebSocketClient(WEBSOCKET_URL);
    }
  };
  let debugServer = null, webSocketServer = null;

  beforeEach(function() {
    spy(console, 'log');
    global.tabris = {};
    global.tabris.device = {platform: 'Android', model: 'Pixel 2'};
    webSocketServer = new MockWebSocketServer(WEBSOCKET_URL);
    debugServer = new DebugServer(webSocketServer);
    debugServer.start();
    eval(getDebugClient('').replace('AUTO_RECONNECT_INTERVAL = 2000', 'AUTO_RECONNECT_INTERVAL = 500'));
  });

  afterEach(() => {
    delete global.debugClient;
    delete global.tabris;
    debugServer.stop();
    webSocketServer.stop();
    restore();
  });

  describe('single device', function() {

    it('print device connected', function() {
      createRemoteConsole(debugServer, webSocketFactory);
      return waitForCalls(console.log)
        .then(log =>
          expect(log).to.contain(' connected')
        );
    });

    it('print device disconnected on normal closure', function() {
      const rc = createRemoteConsole(debugServer, webSocketFactory);
      rc._webSocket.close(1000);
      return waitForCalls(console.log, 2)
        .then(log =>
          expect(log).to.contain(' connected') &&
          expect(log).to.contain(' disconnected')
        );
    });

    it('print device disconnected on outdated session close', function() {
      const rc = createRemoteConsole(debugServer, webSocketFactory);
      rc._webSocket.close(4900);
      return waitForCalls(console.log, 2)
        .then(log =>
          expect(log).to.contain('connected') &&
          expect(log).to.contain('disconnected')
        );
    });

    it('send log message', function() {
      const rc = createRemoteConsole(debugServer, webSocketFactory);
      const message = 'log message';
      rc.log(message);
      return waitForCalls(console.log, 2)
        .then(log =>
          expect(log).to.contain('connected') &&
          expect(log).to.contain(message)
        );
    });

    it('send info message', function() {
      const rc = createRemoteConsole(debugServer, webSocketFactory);
      const message = 'info message';
      rc.info(message);
      return waitForCalls(console.log, 2)
        .then(log =>
          expect(log).to.contains('connected')
          && expect(log).to.contain(message)
        );
    });

    it('send error message', function() {
      const rc = createRemoteConsole(debugServer, webSocketFactory);
      const message = 'error message';
      rc.error(message);
      return waitForCalls(console.log, 2)
        .then(log =>
          expect(log).to.contains('connected')
          && expect(log).to.contain(message)
        );
    });

    it('send warn message', function() {
      const rc = createRemoteConsole(debugServer, webSocketFactory);
      const message = 'warn message';
      rc.warn(message);
      return waitForCalls(console.log, 2)
        .then(log =>
          expect(log).to.contains('connected')
          && expect(log).to.contain(message)
        );
    });

    it('send debug message', function() {
      const rc = createRemoteConsole(debugServer, webSocketFactory);
      const message = 'debug message';
      rc.debug(message);
      return waitForCalls(console.log, 2)
        .then(log =>
          expect(log).to.contains('connected')
          && expect(log).to.contain(message)
        );
    });

  });

});

function createRemoteConsole(server, webSocketFactory) {
  return new global.debugClient.RemoteConsole(webSocketFactory, server.getNewSessionId());
}

function waitForCalls(spyInstance, minCallCount = 1) {
  let attempts = 0;
  const maxAttempts = 15;
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      let messages = [];
      for (const call of spyInstance.getCalls()) {
        messages.push(call.args.join(''));
      }
      if (spyInstance.callCount === minCallCount) {
        clearInterval(interval);
        resolve(messages.join('\n'));
      } else if (++attempts > maxAttempts || spyInstance.callCount > minCallCount) {
        clearInterval(interval);
        reject(new Error(messages.join('\n')));
      }
    }, 100);
  });
}
