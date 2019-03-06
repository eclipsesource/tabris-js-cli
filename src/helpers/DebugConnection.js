const STATE_CHECK_INTERVAL = process.env.NODE_ENV === 'test' ? 500 : 5000;
const TYPE_CONNECTION = 'connect';
const TYPE_LOG = 'log';
const TYPE_ACTION_RESPONSE = 'action-response';

module.exports = class DebugConnection {

  /**
   * @param {string} address
   */
  constructor(address) {
    this._sessionId = -1;
    this.address = address;
    this.device = {
      platform: '',
      model: ''
    };
    this._interval = null;
    this._onEvaluationCompleted = null;
  }

  /**
   * @param {import('ws')} webSocket
   * @param {number} sessionId
   */
  open(webSocket, sessionId) {
    if (this._webSocket) {
      this._closeWebSocket();
    }
    this._webSocket = webSocket;
    this._sessionId = sessionId;
    this._startConnectionChecks();
    this._registerMessageHandler();
  }

  close(code) {
    if (!this._webSocket) {
      return;
    }
    this._closeWebSocket(code);
  }

  send(command) {
    if (this._webSocket && command) {
      this._webSocket.send(command);
    }
  }

  set onConnect(cb) {
    this._onConnect = cb;
  }

  set onDisconnect(cb) {
    this._onDisconnect = cb;
  }

  set onLog(cb) {
    this._onLog = cb;
  }

  set onActionResponse(cb) {
    this._onActionResponse = cb;
  }

  get sessionId() {
    return this._sessionId;
  }

  _registerMessageHandler() {
    this._webSocket.on('message', (message) => {
      try {
        const clientMessage = JSON.parse(message);
        if (clientMessage.type === TYPE_CONNECTION) {
          this.device = clientMessage.parameter;
          if (this._onConnect) {
            this._onConnect(this);
          }
        } else if (clientMessage.type === TYPE_LOG) {
          if (this._onLog) {
            this._onLog(this, clientMessage.parameter);
          }
        } else if(clientMessage.type === TYPE_ACTION_RESPONSE) {
          if (this._onActionResponse) {
            this._onActionResponse(this, clientMessage.parameter);
          }
        }
      } catch (ex) {}
    });
  }

  _startConnectionChecks() {
    let waitingForPong = false;
    this._webSocket.on('pong', () => waitingForPong = false);
    this._interval = setInterval(() => {
      if (waitingForPong) {
        this._closeWebSocket();
        return;
      }
      this._webSocket.ping(() => {});
      waitingForPong = true;
    }, STATE_CHECK_INTERVAL);
  }

  _closeWebSocket(code) {
    this._stopConnectionChecks();
    if (this._onDisconnect) {
      this._onDisconnect(this);
    }
    // Mock used in tests does not implement "terminate"
    if (!arguments.length && this._webSocket.terminate) {
      this._webSocket.terminate();
    } else {
      this._webSocket.close(code);
    }
    this._webSocket = null;
  }

  _stopConnectionChecks() {
    if (this._interval !== null) {
      clearInterval(this._interval);
    }
  }

};
