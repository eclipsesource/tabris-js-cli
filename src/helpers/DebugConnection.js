const {yellow, red, blue} = require('chalk');

const STATE_CONNECTED = 'connected';
const STATE_DISCONNECTED = 'disconnected';
const STATE_CHECK_INTERVAL = process.env.NODE_ENV === 'test' ? 500 : 5000;
const TYPE_CONNECTION = 'connect';

module.exports = class DebugConnection {

  constructor({sessionId, webSocket}) {
    this._sessionId = sessionId;
    this._webSocket = webSocket;
    this._device = null;
    this._isAlive = true;
    this._interval = null;
    this._webSocket.on('pong', () => this._isAlive = true);
    this._scheduleClientConnectionStateChecks();
    this._registerMessageHandler();
  }

  close(code) {
    clearInterval(this._interval);
    this._printClientState(STATE_DISCONNECTED);
    this._webSocket.close(code);
  }

  send(command) {
    if (command && this._isAlive) {
      this._webSocket.send(command);
      return true;
    }
    return false;
  }

  get isAlive() {
    return this._isAlive;
  }

  get sessionId() {
    return this._sessionId;
  }

  _registerMessageHandler() {
    this._webSocket.on('message', (message) => {
      try {
        const clientMessage = JSON.parse(message);
        if (this._isConnectionRequest(clientMessage.type)) {
          this._device = clientMessage.parameter;
          this._printClientState(STATE_CONNECTED);
        } else {
          this._printClientMessage(clientMessage);
        }
      } catch (ex) {}
    });
  }

  _isConnectionRequest(type) {
    return type === TYPE_CONNECTION;
  }

  _printClientMessage(clientMessage) {
    const parameter = clientMessage.parameter;
    switch (parameter.level) {
      case 'log':
        console.log(parameter.message);
        break;
      case 'info':
        console.log(parameter.message);
        break;
      case 'error':
        console.log(red(parameter.message));
        break;
      case 'warn':
        console.log(yellow(parameter.message));
        break;
      case 'debug':
        console.log(blue(parameter.message));
        break;
    }
  }

  _scheduleClientConnectionStateChecks() {
    this._interval = setInterval(() => {
      if (!this._isAlive) {
        this._printClientState(STATE_DISCONNECTED);
        clearInterval(this._interval);
        return this._webSocket.close();
      }
      this._isAlive = false;
      if (this._webSocket.ping) {
        this._webSocket.ping(() => {});
      }
    }, STATE_CHECK_INTERVAL);
  }

  _printClientState(state) {
    const device = this._device;
    console.log(`[${device.platform}][${device.model}][${this._sessionId}]: ${state}`);
  }

};
