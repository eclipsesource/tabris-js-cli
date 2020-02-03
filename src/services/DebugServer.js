const DebugConnection = require('../helpers/DebugConnection');
const url = require('url');

const OUTDATED_CONNECTION_CLOSURE = 4900;
const STATE_CONNECTED = 'connected';
const STATE_DISCONNECTED = 'disconnected';
const messageTypes = Object.freeze({
  evaluate: 'evaluate',
  reloadApp: 'reload-app'
});

module.exports = class DebugServer {

  /**
   * @param {import('ws').Server} webSocketServer
   * @param {import('./Terminal')} terminal
   * @param {string} serverId
   */
  constructor(webSocketServer, terminal, serverId) {
    this._webSocketServer = webSocketServer;
    this._sessionCounter = 0;
    this._serverId = serverId;
    /** @type {DebugConnection} */
    this._connection = null;
    this._terminal = terminal;
    this._printStateTimer = -1;
    this._printStateDelay = 3000;
  }

  start() {
    this._webSocketServer.on('connection', (webSocket, req) => {
      const address = req.connection.remoteAddress;
      const urlParam = new url.URLSearchParams(url.parse(webSocket.url || req.url).query);
      const sessionId = parseInt(urlParam.get('session'), 10);
      const serverId = urlParam.get('server');
      if (isNaN(sessionId)) {
        throw new Error('Invalid session id');
      }
      if (!serverId) {
        throw new Error('No server id');
      }
      if (serverId !== this._serverId) {
        return webSocket.close(OUTDATED_CONNECTION_CLOSURE);
      }
      if (this._connection) {
        if (address === this._connection.address) {
          return this._connection.open(webSocket, serverId);
        }
        if (sessionId < this._connection.sessionId) {
          return webSocket.close(OUTDATED_CONNECTION_CLOSURE);
        }
        this._connection.close(OUTDATED_CONNECTION_CLOSURE);
      }
      this._connection = this._createConnection(webSocket, sessionId, address);
    });
  }

  // only using for unit testing
  stop() {
    if (this._connection) {
      this._connection.close(1000);
    }
    this._webSocketServer = null;
  }

  evaluate(command) {
    if (this._connection) {
      this._connection.send(JSON.stringify({type: messageTypes.evaluate, value: command}));
      return true;
    }
    return false;
  }

  reloadApp() {
    if (this._connection) {
      this._connection.send(JSON.stringify({type: messageTypes.reloadApp}));
      return true;
    }
    return false;
  }

  getNewSessionId() {
    return ++this._sessionCounter;
  }

  get activeConnections() {
    return this._connection ? 1 : 0;
  }

  set onEvaluationCompleted(cb) {
    this._onEvaluationCompleted = cb;
  }

  get port() {
    return this._webSocketServer.options.port;
  }

  _onConnect(connection) {
    if (this._printStateTimer !== -1) {
      clearTimeout(this._printStateTimer);
      this._printStateTimer = -1;
    } else {
      this._printClientState(connection.device, STATE_CONNECTED);
    }
  }

  _onDisconnect(connection) {
    this._printStateTimer = setTimeout(() => {
      this._printStateTimer = -1;
      this._printClientState(connection.device, STATE_DISCONNECTED);
      if (this._onEvaluationCompleted) {
        this._onEvaluationCompleted();
      }
    }, this._printStateDelay);
  }

  _onLog(connection, {messages}) {
    for (const message of messages) {
      this._printClientMessage(message);
    }
  }

  _onActionResponse(connection, {enablePrompt}) {
    if (enablePrompt && this._onEvaluationCompleted) {
      this._onEvaluationCompleted();
    }
  }

  _printClientMessage(parameter) {
    switch (parameter.level) {
      case 'log':
        this._terminal.log(parameter.message);
        break;
      case 'info':
        this._terminal.info(parameter.message);
        break;
      case 'error':
        this._terminal.error(parameter.message);
        break;
      case 'warn':
        this._terminal.warn(parameter.message);
        break;
      case 'debug':
        this._terminal.debug(parameter.message);
        break;
    }
  }

  _printClientState(device, state) {
    this._terminal.log(`[${device.platform}][${device.model}]: ${state}`);
  }

  _createConnection(webSocket, sessionId, address) {
    const connection = new DebugConnection(address);
    connection.onConnect = this._onConnect.bind(this);
    connection.onDisconnect = this._onDisconnect.bind(this);
    connection.onLog = this._onLog.bind(this);
    connection.onActionResponse = this._onActionResponse.bind(this);
    connection.open(webSocket, sessionId);
    return connection;
  }

};
