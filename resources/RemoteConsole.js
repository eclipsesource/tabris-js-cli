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
    reloadApp: 'reload-app',
    toggleDevToolbar: 'toggle-dev-toolbar',
    clearStorage: 'clear-storage',
    loadStorage: 'load-storage',
    requestStorage: 'request-storage',
    printUiTree: 'print-ui-tree'
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

    message(data) {
      this._sendMessageBuffered({level: 'message', message: data});
    }

    returnValue(data) {
      this._sendMessageBuffered({level: 'returnValue', message: data});
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
      } else if (message.type === messageTypes.toggleDevToolbar) {
        if (typeof tabris.devTools !== 'object') {
          this.message(
            `Toggling UI toolbar is supported from Tabris.js 3.4.0. You are using version ${tabris.version}.`
          );
          return;
        }
        tabris.devTools.isUiVisible() ? tabris.devTools.hideUi() : tabris.devTools.showUi();
      } else if (message.type === messageTypes.printUiTree) {
        console.dirxml(tabris.drawer);
        console.dirxml(tabris.contentView);
      } else if (message.type === messageTypes.clearStorage) {
        tabris.localStorage.clear();
        if (tabris.device.platform === 'iOS') {
          tabris.secureStorage.clear();
        }
      } else if (message.type === messageTypes.requestStorage) {
        this._sendStorage();
      } else if (message.type === messageTypes.loadStorage) {
        this._loadStorage(message.value);
      } else {
        throw new Error('Server message not supported.');
      }
    }

    _loadStorage({storage, path}) {
      let hasValidPlatform = storage.platform && typeof storage.platform === 'string';
      if (hasValidPlatform && storage.platform.toLowerCase() !== tabris.device.platform.toLowerCase()) {
        this.message(`Cannot load storage from ${path} . The storage platform does not match the device platform.`);
        return;
      }
      this._replaceStorage('localStorage', storage.localStorage, path);
      this._replaceStorage('secureStorage', storage.secureStorage, path);
    }

    _replaceStorage(storageName, contents, path) {
      const storage = tabris[storageName];
      if (typeof storage !== 'object' || typeof storage.clear !== 'function') {
        return;
      }
      storage.clear();
      for (const [key, value] of Object.entries(contents)) {
        storage.setItem(key, value);
      }
      this.message(`Loaded ${storageName} successfully from ${path} .`);
    }

    _sendStorage() {
      const storage = {
        platform: tabris.device.platform,
        localStorage: this._serializeStorage(tabris.localStorage)
      };
      if (tabris.device.platform === 'iOS') {
        storage.secureStorage = this._serializeStorage(tabris.secureStorage);
      }
      this._send('storage', storage);
    }

    _serializeStorage(storage) {
      let result = {};
      let storageLength;
      try {
        storageLength = storage.length;
      } catch(e) {
        // TODO: eclipsesource/tabris-js/issues/2017
        return result;
      }
      for (let i = 0; i < storageLength; i++) {
        const key = storage.key(i);
        result[key] = storage.getItem(key);
      }
      return result;
    }

    _evaluate(command) {
      try {
        let geval = eval;
        let result = geval(command);
        // VT100 escape code for grey color
        this.returnValue(tabris.format(result));
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
