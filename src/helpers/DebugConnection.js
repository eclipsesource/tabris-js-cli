const {yellow, red, blue} = require('chalk');

const STATE_CONNECTED = 'connected';
const STATE_DISCONNECTED = 'disconnected';
const STATE_CHECK_INTERVAL = process.env.NODE_ENV === 'test' ? 500 : 5000;
const TYPE_CONNECTION = 'connect';
const TYPE_LOG = 'log';
const TYPE_ACTION_RESPONSE = 'action-response';

module.exports = class DebugConnection {

  constructor({sessionId, webSocket}) {
    this._sessionId = sessionId;
    this._webSocket = webSocket;
    this._device = {
      platform: '',
      model: ''
    };
    this._isAlive = true;
    this._interval = null;
    this._onEvaluationCompleted = null;
    this._webSocket.on('pong', () => this._isAlive = true);
    this._scheduleClientConnectionStateChecks();
    this._registerMessageHandler();
  }

  close(code) {
    clearInterval(this._interval);
    this._printClientState(STATE_DISCONNECTED);
    this._enablePrompt();
    this._webSocket.close(code);
  }

  send(command) {
    if (command && this._isAlive) {
      this._webSocket.send(command);
      return true;
    }
    return false;
  }

  set onEvaluationCompleted(cb) {
    this._onEvaluationCompleted = cb;
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
        if (clientMessage.type === TYPE_CONNECTION) {
          this._device = clientMessage.parameter;
          this._printClientState(STATE_CONNECTED);
        } else if (clientMessage.type === TYPE_LOG) {
          for (const bufferedMessage of clientMessage.parameter.messages) {
            this._printClientMessage(bufferedMessage);
          }
        } else if(clientMessage.type === TYPE_ACTION_RESPONSE) {
          if (clientMessage.parameter.enablePrompt) {
            this._enablePrompt();
          }
        }
      } catch (ex) {}
    });
  }

  _printClientMessage(parameter) {
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
        this._enablePrompt();
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

  _enablePrompt() {
    if (this._onEvaluationCompleted && this._onEvaluationCompleted instanceof Function) {
      this._onEvaluationCompleted.call();
    }
  }

};
