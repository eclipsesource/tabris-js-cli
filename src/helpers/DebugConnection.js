const {EventEmitter} = require('events');

const STATE_CHECK_INTERVAL = process.env.NODE_ENV === 'test' ? 500 : 5000;
const TYPE_CONNECTION = 'connect';
const TYPE_LOG = 'log';
const TYPE_LOG_REQUEST = 'log-request';
const TYPE_STORAGE = 'storage';
const TYPE_ACTION_RESPONSE = 'action-response';

module.exports = class DebugConnection extends EventEmitter {

  /**
   * @param {string} address
   */
  constructor(address) {
    super();
    this._sessionId = -1;
    this.address = address;
    this.device = {
      platform: '',
      model: ''
    };
    this._interval = null;
    this._onEvaluationCompleted = null;
    this._onClose = () => this.close();
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
    this._webSocket.addEventListener('close', this._onClose);
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
    if (command && this._verifyWebsocketOpen()) {
      this._webSocket.send(command);
      return true;
    }
    return false;
  }

  get sessionId() {
    return this._sessionId;
  }

  _registerMessageHandler() {
    this._webSocket.on('message', (messages) => {
      try {
        JSON.parse(messages).forEach(({type, parameter}) => {
          if (type === TYPE_CONNECTION) {
            this.device = parameter;
            this.emit('connect');
          } else if (type === TYPE_LOG) {
            this.emit('log', parameter);
          } else if (type === TYPE_LOG_REQUEST) {
            this.emit('logRequest', parameter);
          } else if(type === TYPE_ACTION_RESPONSE) {
            this.emit('actionResponse', parameter);
          } else if(type === TYPE_STORAGE) {
            this.emit('storage', parameter);
          }
        });
      } catch (ex) {}
    });
  }

  _startConnectionChecks() {
    let waitingForPong = false;
    this._webSocket.on('pong', () => waitingForPong = false);
    this._interval = setInterval(() => {
      if (waitingForPong) {
        this._closeWebSocket();
      } else if (this._verifyWebsocketOpen()) {
        this._webSocket.ping(() => {});
        waitingForPong = true;
      }
    }, STATE_CHECK_INTERVAL);
  }

  _verifyWebsocketOpen() {
    if (this._webSocket && this._webSocket.readyState === this._webSocket.OPEN) {
      return true;
    } else if (this._webSocket) {
      this._closeWebSocket();
    }
    return false;
  }

  _closeWebSocket(code) {
    this._stopConnectionChecks();
    this.emit('disconnect');
    this._webSocket.removeEventListener('close', this._onClose);
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
