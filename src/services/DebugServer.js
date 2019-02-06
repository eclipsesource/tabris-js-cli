const DebugConnection = require('../helpers/DebugConnection');
const url = require('url');

const OUTDATED_CONNECTION_CLOSURE = 4900;
const STATE_CONNECTED = 'connected';
const STATE_DISCONNECTED = 'disconnected';

module.exports = class DebugServer {

  constructor(webSocketServer, terminal) {
    this._webSocketServer = webSocketServer;
    this._sessionId = 0;
    this._connection = null;
    this._terminal = terminal;
  }

  start() {
    this._webSocketServer.on('connection', (webSocket, req) => {
      const requestUrl = webSocket.url || req.url;
      const sessionId = url.parse(requestUrl, true).query.id;
      if (this._isMostRecentSession(sessionId)) {
        this._closeOutdatedConnection();
        this._connection = new DebugConnection({sessionId, webSocket});
        this._connection.onConnect = this._onConnect.bind(this);
        this._connection.onDisconnect = this._onDisconnect.bind(this);
        this._connection.onLog = this._onLog.bind(this);
        this._connection.onActionResponse = this._onActionResponse.bind(this);
      }
    });
  }

  // only using for unit testing
  stop() {
    if (this._connection) {
      this._connection.close(1000);
    }
    this._webSocketServer = null;
  }

  send(command) {
    if (this._connection) {
      this._connection.send(command);
      return true;
    }
    return false;
  }

  getNewSessionId() {
    return ++this._sessionId;
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
    this._printClientState(connection.device, STATE_CONNECTED);
  }

  _onDisconnect(connection) {
    this._printClientState(connection.device, STATE_DISCONNECTED);
    this._connection = null;
    if (this._onEvaluationCompleted) {
      this._onEvaluationCompleted();
    }
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
    this._terminal.log(`[${device.platform}][${device.model}][${this._sessionId}]: ${state}`);
  }

  _closeOutdatedConnection() {
    if (this._connection && !this._isMostRecentSession(this._connection.sessionId)) {
      this._connection.close(OUTDATED_CONNECTION_CLOSURE);
    }
  }

  _isMostRecentSession(id) {
    return id.toString() === this._sessionId.toString();
  }

};
