const DebugConnection = require('../helpers/DebugConnection');
const url = require('url');

const OUTDATED_CONNECTION_CLOSURE = 4900;

module.exports = class DebugServer {

  constructor(webSocketServer) {
    this._webSocketServer = webSocketServer;
    this._sessionId = 0;
    this._connection = null;
  }

  start() {
    this._webSocketServer.on('connection', (webSocket, req) => {
      const requestUrl = webSocket.url || req.url;
      const sessionId = url.parse(requestUrl, true).query.id;
      if (this._isMostRecentSession(sessionId)) {
        this.clientOutdatedConnection();
        this._connection = new DebugConnection({sessionId, webSocket});
      }
    });
  }

  // only using for unit testing
  stop() {
    this._connection.close(1000);
    this._webSocketServer = null;
  }

  getNewSessionId() {
    return ++this._sessionId;
  }

  get port() {
    return this._webSocketServer.options.port;
  }

  clientOutdatedConnection() {
    if (this.isConnectionAlive() && !this._isMostRecentSession(this._connection.sessionId)) {
      this._connection.close(OUTDATED_CONNECTION_CLOSURE);
    }
  }

  _isMostRecentSession(id) {
    return id.toString() === this._sessionId.toString();
  }

  isConnectionAlive() {
    return this._connection && this._connection.isAlive;
  }

};
