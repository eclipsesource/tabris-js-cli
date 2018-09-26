/* global tabris:false WebSocket:false */
(function() {

  const AUTO_RECONNECT_INTERVAL = 2000;
  const SEND_INTERVAL = 500;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const MAX_SEND_ATTEMPTS = 5;
  const NORMAL_CLOSURE = 1000;
  const OUTDATED_CONNECTION_CLOSURE = 4900;
  const OUTDATED_CONNECTION_MESSAGE = 'Connection to debug websocket was closed.';
  const CONNECTION_PROBLEM_MESSAGE = 'Connection to debug websocket could not be established.';
  const moduleArgsMap = ['module', 'exports', 'require', '__filename', '__dirname']
    .map((arg, i) => `const ${arg} = arguments[${i}];`)
    .join('');

  const debugClient = global.debugClient = {

    sessionId: '{{SessionId}}',

    start() {
      this.ModulePreLoader.patchModuleClass();
      const serverUrl = tabris.app
        .getResourceLocation('package.json')
        .match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i)[1];
      const webSocketFactory = {
        createWebSocket: () => {
          return new WebSocket(`ws://${serverUrl}/?id=${this.sessionId}`, '');
        }
      };
      const rc = new debugClient.RemoteConsole(webSocketFactory, this.sessionId);
      const SUPPORTED_EVENTS = ['log', 'info', 'error', 'warn', 'debug'];
      tabris.on('log', (event) => {
        if (!SUPPORTED_EVENTS.includes(event.level)) {
          throw new Error(`Handling log event ${event.level} not supported.`);
        }
        rc[event.level](event.message);
      });
    }

  };

  debugClient.RemoteConsole = class RemoteConsole {

    constructor(webSocketFactory, sessionId) {
      this._webSocketFactory = webSocketFactory;
      this._webSocket = null;
      this._sessionId = sessionId;
      this._reconnectAttempts = 0;
      this._sendAttempts = 0;
      this._buffer = [];
      this._isOpen = false;
      this._isDisposed = false;
      this._connect();
    }

    log(data) {
      this._disposeCheck();
      this._sendBuffered({level: 'log', message: data});
    }

    info(data) {
      this._disposeCheck();
      this._sendBuffered({level: 'info', message: data});
    }

    error(data) {
      this._disposeCheck();
      this._sendBuffered({level: 'error', message: data});
    }

    warn(data) {
      this._disposeCheck();
      this._sendBuffered({level: 'warn', message: data});
    }

    debug(data) {
      this._disposeCheck();
      this._sendBuffered({level: 'debug', message: data});
    }

    dispose() {
      this._webSocket.onclose = null;
      this._webSocket.onopen = null;
      this._webSocket.onmessage = null;
      this._webSocket = null;
      this._isDisposed = true;
    }

    _connect() {
      this._webSocket = this._webSocketFactory.createWebSocket();
      this._webSocket.onclose = (event) => {
        if (this._isOpen && event.code !== NORMAL_CLOSURE) {
          this._isOpen = false;
          if (event.code === OUTDATED_CONNECTION_CLOSURE) {
            console.info(OUTDATED_CONNECTION_MESSAGE);
          } else {
            setTimeout(() => {
              this._reconnect();
            }, AUTO_RECONNECT_INTERVAL);
          }
        }
      };
      this._webSocket.onopen = () => {
        if (this._send({type: 'connect', parameter: {
          platform: tabris.device.platform,
          model: tabris.device.model
        }})) {
          this._isOpen = true;
          this._reconnectAttempts = 0;
          this._sendBufferedMessages();
        } else {
          this._reconnect();
        }
      };
      this._webSocket.onmessage = event => {
        try {
          let result = eval((function() {return event.data;})());
          if (typeof result === 'object') {
            result = JSON.stringify(result);
          }
          // VT100 escape code for grey color
          this.log(`\x1b[;37m<- ${result}\x1b[0m`);
        } catch (ex) {
          console.warn(ex);
        } finally {
          this._send({type: 'action-response', parameter: {enablePrompt: true}});
        }
      };
    }

    _reconnect() {
      if (this._isDisposed) {
        return;
      }
      this._webSocket = null;
      if (++this._reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        this._connect();
      } else {
        console.info(CONNECTION_PROBLEM_MESSAGE);
      }
    }

    _sendBuffered(clientMessage) {
      if (this._isConnectionOpen()) {
        this._send({type: 'log', parameter: {messages: [clientMessage]}});
      } else {
        this._addToBuffer(clientMessage);
      }
    }

    _addToBuffer(event) {
      this._buffer.push(event);
    }

    _sendBufferedMessages() {
      if (this._send({type: 'log', parameter: {messages: this._buffer}})) {
        this._sendAttempts = 0;
        this._buffer = [];
      } else {
        if (++this._sendAttempts < MAX_SEND_ATTEMPTS) {
          setTimeout(() => {
            this._sendBufferedMessages();
          }, SEND_INTERVAL);
        }
      }
    }

    _send({type, parameter}) {
      try {
        this._webSocket.send(JSON.stringify({
          sessionId: this._sessionId,
          type,
          parameter
        }));
        return true;
      } catch (ex) {}
      return false;
    }

    _isConnectionOpen() {
      return this._webSocket && this._webSocket.readyState === WebSocket.OPEN;
    }

    _disposeCheck() {
      if (this._isDisposed) {
        throw new Error('RemoteConsole is disposed');
      }
    }

  };

  debugClient.ModulePreLoader = class ModulePreLoader {

    static patchModuleClass() {
      const loader = new ModulePreLoader();
      tabris.Module.createLoader = url => loader.createLoader(url);
      tabris.Module.readJSON = url => loader.readJSON(url);
    }

    constructor() {
      this._dirs = {};
    }

    createLoader(url) {
      const src = this._load(url);
      if (!src) {
        return null;
      }
      try {
        return new Function(moduleArgsMap + src);
      } catch (ex) {
        throw new Error('Could not parse ' + url + ':' + ex);
      }
    }

    readJSON(url) {
      const src = this._load(url);
      if (!src) {
        return null;
      }
      try {
        return JSON.parse(src);
      } catch (ex) {
        throw new Error('Could not parse ' + url);
      }
    }

    _load(url) {
      const slash = url.lastIndexOf('/');
      const dir = url.slice(0, slash);
      const file = url.slice(slash + 1);
      const files = this._getFiles(dir);
      if (!files[file]) {
        return null;
      }
      if (!('content' in files[file])) {
        files[file].content = tabris._client.load(url);
      }
      return files[file].content;
    }

    _getFiles(dir) {
      if (!this._dirs[dir]) {
        // can not use '.' as a request to client.load:
        const url = (dir === '.' ? './package.json' : dir)
          + '?getfiles='
          + encodeURIComponent('*');
        const response = tabris._client.load(url);
        if (!response) {
          throw new Error('Failed to connect to CLI');
        }
        try {
          Object.assign(this._dirs, JSON.parse(response));
        } catch (ex) {
          throw new Error(`Failed to parse CLI response: ${ex}`);
        }
        if (!this._dirs[dir]) {
          throw new Error(`Directory ${dir} missing in CLI response ${response}`);
        }
      }
      return this._dirs[dir];
    }

  };

})();
