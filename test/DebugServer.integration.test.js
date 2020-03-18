const DebugServer = require('../src/services/DebugServer');
const {expect, restore, waitForCalls} = require('./test');
const MockWebSocketServer = require('mock-socket').Server;
const MockWebSocketClient = require('mock-socket').WebSocket;
const {getDebugClient} = require('../src/services/getBootJs');
const TerminalMock = require('./TerminalMock');
const KeyboardShortcutHandler = require('../src/services/KeyboardShortcutHandler');

const PORT = 9000;
const SERVER_ID = 'fooserver';
const WEBSOCKET_URL = `ws://127.0.0.1:${PORT}/?session=1&server=${SERVER_ID}`;
const REMOTE_URL = '192.168.1.1';

MockWebSocketServer.prototype.ping = () => {};

describe('DebugServer', () => {

  let webSocketFactory = {
    createWebSocket() {
      const client = new MockWebSocketClient(WEBSOCKET_URL);
      // Mock is missing this in 'connect' event:
      client.connection = {remoteAddress: REMOTE_URL};
      return client;
    }
  };
  let debugServer = null, webSocketServer = null;
  let terminal;

  beforeEach(function() {
    terminal = new TerminalMock();
    global.tabris = {};
    global.tabris.device = {platform: 'Android', model: 'Pixel 2'};
    webSocketServer = new MockWebSocketServer(WEBSOCKET_URL);
    const keyboardShortcutHandler = new KeyboardShortcutHandler({terminal});
    debugServer = new DebugServer({webSocketServer, terminal, keyboardShortcutHandler, serverId: SERVER_ID});
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

    it('print device connected', async function() {
      createRemoteConsoleClient(debugServer, webSocketFactory);
      const log = await waitForCalls(terminal.log, 1);
      expect(log).to.contain(' connected');
    });

    it('print keyboard shortcuts when connected for the first time', async function() {
      createRemoteConsoleClient(debugServer, webSocketFactory);
      const log = await waitForCalls(terminal.infoBlock, 1);
      expect(log).to.contain('Ctrl+C');
    });

    it('print device disconnected on normal closure', async function() {
      const rc = createRemoteConsoleClient(debugServer, webSocketFactory);
      rc._webSocket.close(1000);
      const log = await waitForCalls(terminal.log, 2, 4000);
      expect(log).to.contain(' connected');
      expect(log).to.contain(' disconnected');
    }).timeout(6000);

    it('print device disconnected on outdated session close', async function() {
      const rc = createRemoteConsoleClient(debugServer, webSocketFactory);
      rc._webSocket.close(4900);
      const log = await waitForCalls(terminal.log, 2, 4000);
      expect(log).to.contain('connected');
      expect(log).to.contain('disconnected');
    }).timeout(6000);

    it('prints no disconnected on quick reconnect', async function() {
      const rc = createRemoteConsoleClient(debugServer, webSocketFactory);
      rc._webSocket.close(1000);
      await new Promise(resolve => setTimeout(resolve, 2000));
      rc._disposeSocket();
      rc._connect();
      await new Promise(resolve => setTimeout(resolve, 2000));
      for (const call of terminal.log.getCalls()) {
        expect(call.args.join('')).not.to.contain('disconnected');
      }
    }).timeout(6000);

    it('send log message', async function() {
      const rc = createRemoteConsoleClient(debugServer, webSocketFactory);
      const message = 'log message';
      rc.log(message);
      const log = await waitForCalls(terminal.log, 2);
      expect(log).to.contain('connected');
      expect(log).to.contain(message);
    });

    it('send info message', async function() {
      const rc = createRemoteConsoleClient(debugServer, webSocketFactory);
      const message = 'info message';
      rc.info(message);
      const log = await waitForCalls(terminal.info, 1);
      expect(log).to.contain(message);
    });

    it('send error message', async function() {
      const rc = createRemoteConsoleClient(debugServer, webSocketFactory);
      const message = 'error message';
      rc.error(message);
      const log = await waitForCalls(terminal.error, 1);
      expect(log).to.contain(message);
    });

    it('send warn message', async function() {
      const rc = createRemoteConsoleClient(debugServer, webSocketFactory);
      const message = 'warn message';
      rc.warn(message);
      const log = await waitForCalls(terminal.warn, 1);
      expect(log).to.contain(message);
    });

    it('send debug message', async function() {
      const rc = createRemoteConsoleClient(debugServer, webSocketFactory);
      const message = 'debug message';
      rc.debug(message);
      const log = await waitForCalls(terminal.debug, 1);
      expect(log).to.contain(message);
    });

  });

});

function createRemoteConsoleClient(server, webSocketFactory) {
  return new global.debugClient.RemoteConsole(webSocketFactory, server.getNewSessionId());
}
