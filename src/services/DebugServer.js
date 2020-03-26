const DebugConnection = require('../helpers/DebugConnection');
const {EventEmitter} = require('events');
const url = require('url');

const OUTDATED_CONNECTION_CLOSURE = 4900;
const STATE_CONNECTED = 'connected';
const STATE_DISCONNECTED = 'disconnected';
const messageTypes = Object.freeze({
  evaluate: 'evaluate',
  reloadApp: 'reload-app',
  toggleDevToolbar: 'toggle-dev-toolbar',
  clearStorage: 'clear-storage',
  requestStorage: 'request-storage',
  loadStorage: 'load-storage',
  printUiTree: 'print-ui-tree'
});

module.exports = class DebugServer extends EventEmitter {

  /**
   * @param {import('ws').Server} webSocketServer
   * @param {import('./Terminal')} terminal
   * @param {string} serverId
   */
  constructor({webSocketServer, terminal, serverId, keyboardShortcutHandler}) {
    super();
    this._webSocketServer = webSocketServer;
    this._keyboardShortcutHandler = keyboardShortcutHandler;
    this._sessionCounter = 0;
    this._serverId = serverId;
    /** @type {DebugConnection} */
    this._connection = null;
    this._terminal = terminal;
    this._printStateTimer = -1;
    this._printStateDelay = 3000;
    this._firstConnect = true;
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
          return this._connection.open(webSocket, sessionId);
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
    return this._sendMessage('evaluate', command);
  }

  reloadApp() {
    return this._sendMessage('reloadApp');
  }

  toggleDevToolbar() {
    return this._sendMessage('toggleDevToolbar');
  }

  clearStorage() {
    return this._sendMessage('clearStorage');
  }

  requestStorage() {
    return this._sendMessage('requestStorage');
  }

  loadStorage(storage) {
    return this._sendMessage('loadStorage', storage);
  }

  printUiTree() {
    return this._sendMessage('printUiTree');
  }

  getNewSessionId() {
    return ++this._sessionCounter;
  }

  get connectedDevicePlatform() {
    if (this._connection) {
      return this._connection.device.platform;
    }
    return null;
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

  _sendMessage(type, value) {
    if (this._connection) {
      return this._connection.send(JSON.stringify({type: messageTypes[type], value}));
    }
    return false;
  }

  _handleConnect(connection, sessionId) {
    if (this._printStateTimer !== -1) {
      clearTimeout(this._printStateTimer);
      this._printStateTimer = -1;
    } else {
      this._printClientState(connection.device, STATE_CONNECTED);
    }
    this.emit('connect', sessionId);
  }

  _handleDisconnect(connection) {
    if (this._printStateTimer !== -1) {
      clearTimeout(this._printStateTimer);
    }
    this._printStateTimer = setTimeout(() => {
      this._printStateTimer = -1;
      this._printClientState(connection.device, STATE_DISCONNECTED);
      if (this._onEvaluationCompleted) {
        this._onEvaluationCompleted();
      }
    }, this._printStateDelay);
  }

  _handleLog(_connection, {messages}) {
    for (const message of messages) {
      this._printClientMessage(message);
    }
  }

  _handleActionResponse(_connection, {enablePrompt}) {
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
      case 'message':
        this._terminal.message(parameter.message);
        break;
      case 'returnValue':
        this._terminal.returnValue(parameter.message);
        break;
    }
  }

  _printClientState(device, state) {
    this._terminal.message(`[${device.platform}][${device.model}]: ${state}`);
    if (this._firstConnect) {
      this._firstConnect = false;
      this._keyboardShortcutHandler.printHelp();
    }
  }

  _createConnection(webSocket, sessionId, address) {
    const connection = new DebugConnection(address);
    connection.on('connect', () => this._handleConnect(connection, sessionId));
    connection.on('disconnect', () => this._handleDisconnect(connection));
    connection.on('log', args => this._handleLog(connection, args));
    connection.on('storage', args => this.emit('storage', args));
    connection.on('actionResponse', args => this._handleActionResponse(connection, args));
    connection.open(webSocket, sessionId);
    return connection;
  }

};
