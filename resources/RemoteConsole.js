/* global tabris:false debugClient:false WebSocket: false */
(function() {

  const AUTO_RECONNECT_INTERVAL = 2000;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const CODE_NORMAL_CLOSURE = 1000;
  const CODE_OUTDATED_CONNECTION_CLOSURE = 4900;
  const NORMAL_CLOSURE_MESSAGE = 'Connection to debug websocket was closed.';
  const CONNECTION_PROBLEM_MESSAGE = 'Connection to debug websocket could not be established.';
  const messageTypes = Object.freeze({
    evaluate: 'evaluate',
    reloadApp: 'reload-app'
  });

  debugClient.RemoteConsole = class RemoteConsole {

    /**
     * @param {{createWebSocket: () => WebSocket}} webSocketFactory
     */
    constructor(webSocketFactory) {
      this._webSocketFactory = webSocketFactory;
      /** @type {WebSocket} */
      this._webSocket = null;
      this._reconnectScheduled = false;
      this._reconnectAttempts = 0;
      this._buffer = [];
      this._isDisposed = false;
      this._connect();
    }

    log(data) {
      this._sendMessageBuffered({level: 'log', message: data});
    }

    info(data) {
      this._sendMessageBuffered({level: 'info', message: data});
    }

    error(data) {
      this._sendMessageBuffered({level: 'error', message: data});
    }

    warn(data) {
      this._sendMessageBuffered({level: 'warn', message: data});
    }

    debug(data) {
      this._sendMessageBuffered({level: 'debug', message: data});
    }

    dispose() {
      this._disposeSocket();
      this._buffer = null;
      this._isDisposed = true;
    }

    _connect() {
      if (this._isConnectionOpen() || this._isDisposed) {
        return;
      }
      this._webSocket = this._webSocketFactory.createWebSocket();
      this._webSocket.onopen = () => this._handleSockedOpen();
      this._webSocket.onmessage = event => this._handleServerMessage(event);
      this._webSocket.onclose = event => this._handleSocketClosed(event);
    }

    _scheduleReconnect() {
      if (this._isDisposed || this._reconnectScheduled) {
        return;
      }
      if (++this._reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.info(CONNECTION_PROBLEM_MESSAGE);
        this.dispose();
        return;
      }
      this._disposeSocket();
      this._reconnectScheduled = true;
      setTimeout(() => {
        this._reconnectScheduled = false;
        this._connect();
      }, AUTO_RECONNECT_INTERVAL);
    }

    _handleSockedOpen() {
      const success = this._send('connect', {
        platform: tabris.device.platform,
        model: tabris.device.model
      });
      if (success) {
        this._reconnectAttempts = 0;
        this._sendBufferedMessages();
      }
    }

    /**
     * @param {MessageEvent} event
     */
    _handleServerMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch(e) {
        throw new Error('Error parsing server message: ' + e);
      }
      if (message.type === messageTypes.evaluate) {
        this._evaluate(message.value);
      } else if (message.type === messageTypes.reloadApp) {
        tabris.app.reload();
      } else {
        throw new Error('Server message not supported.');
      }
    }

    _evaluate(command) {
      try {
        let geval = eval;
        let result = geval(command);
        // VT100 escape code for grey color
        this.log(`\x1b[90m<-\x1b[0m ${tabris.format(result)}`);
      } catch (ex) {
        if (ex instanceof Error) {
          const stackStr = ex.toString();
          const stack = stackStr.split('\n');
          const cutOff = stack.findIndex(line => line.indexOf('_handleServerMessage') !== -1);
          if (cutOff > 0) {
            console.warn(stack.slice(0, cutOff).join('\n'));
          } else {
            console.warn(stackStr);
          }
        } else {
          console.warn('Non-Error thrown:');
          console.warn(ex);
        }
      } finally {
        this._send('action-response', {enablePrompt: true});
      }
    }

    /**
     * @param {CloseEvent} event
     */
    _handleSocketClosed(event) {
      if (event.code === CODE_NORMAL_CLOSURE || event.code === CODE_OUTDATED_CONNECTION_CLOSURE) {
        console.info(NORMAL_CLOSURE_MESSAGE);
      } else {
        this._scheduleReconnect();
      }
    }

    _sendMessageBuffered(clientMessage) {
      if (this._isDisposed) {
        return;
      }
      const success = this._send('log', {messages: [clientMessage]});
      if (!success) {
        this._buffer.push(clientMessage);
      }
    }

    _sendBufferedMessages() {
      const success = this._send('log', {messages: this._buffer});
      if (success) {
        this._buffer = [];
      }
    }

    /**
     * @param {string} type
     * @param {any} parameter
     */
    _send(type, parameter) {
      this._disposeCheck();
      if (!this._isConnectionOpen()) {
        return false;
      }
      try {
        this._webSocket.send(JSON.stringify({
          type,
          parameter
        }));
        return true;
      } catch (ex) {
        console.warn(ex);
        this._scheduleReconnect();
      }
      return false;
    }

    _isConnectionOpen() {
      return this._webSocket && this._webSocket.readyState === WebSocket.OPEN;
    }

    _disposeSocket() {
      if (this._webSocket) {
        this._webSocket.onclose = null;
        this._webSocket.onopen = null;
        this._webSocket.onmessage = null;
        this._webSocket.close();
        this._webSocket = null;
      }
    }

    _disposeCheck() {
      if (this._isDisposed) {
        throw new Error('RemoteConsole is disposed');
      }
    }

  };

})();
