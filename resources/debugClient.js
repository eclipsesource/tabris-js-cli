/* global tabris:false WebSocket:false */
(function() {

  const AUTO_RECONNECT_INTERVAL = 2000;
  const MAX_ATTEMPTS = 5;
  const NORMAL_CLOSURE = 1000;
  const OUTDATED_CONNECTION_CLOSURE = 4900;
  const OUTDATED_CONNECTION_MESSAGE = 'Connection to debug websocket was closed.';
  const CONNECTION_PROBLEM_MESSAGE = 'Connection to debug websocket could not be established.';

  global.debugClient = {

    start: () => {
      const webSocketFactory = {
        createWebSocket() {
          return new WebSocket('{{WebSocketUrl}}/?id={{SessionId}}', '');
        }
      };
      const rc = new global.debugClient.RemoteConsole(webSocketFactory, '{{SessionId}}');
      const SUPPORTED_EVENTS = ['log', 'info', 'error', 'warn', 'debug'];
      tabris.on('log', (event) => {
        if (!SUPPORTED_EVENTS.includes(event.level)) {
          throw new Error(`Handling log event ${event.level} not supported.`);
        }
        rc[event.level](event.message);
      });
    }

  };

  global.debugClient.RemoteConsole = class {

    constructor(webSocketFactory, sessionId) {
      this._webSocketFactory = webSocketFactory;
      this._webSocket = null;
      this._sessionId = sessionId;
      this._attempts = 0;
      this._buffer = [];
      this._connect();
    }

    log(data) {
      this._sendBuffered({type: 'log', parameter: {level: 'log', message: data}});
    }

    info(data) {
      this._sendBuffered({type: 'log', parameter: {level: 'info', message: data}});
    }

    error(data) {
      this._sendBuffered({type: 'log', parameter: {level: 'error', message: data}});
    }

    warn(data) {
      this._sendBuffered({type: 'log', parameter: {level: 'warn', message: data}});
    }

    debug(data) {
      this._sendBuffered({type: 'log', parameter: {level: 'debug', message: data}});
    }

    _sendBuffered(clientMessage) {
      if (this._isConnectionOpen()) {
        this._send(clientMessage);
      } else {
        this._addToBuffer(clientMessage);
      }
    }

    _isConnectionOpen() {
      return this._webSocket && this._webSocket.readyState === WebSocket.OPEN;
    }

    _addToBuffer(event) {
      this._buffer.push(event);
    }

    _connect() {
      this._webSocket = this._webSocketFactory.createWebSocket();
      this._webSocket.onclose = (event) => {
        if (event.code !== NORMAL_CLOSURE) {
          if (event.code === OUTDATED_CONNECTION_CLOSURE) {
            console.error(OUTDATED_CONNECTION_MESSAGE);
          } else {
            setTimeout(() => {
              this._reconnect();
            }, AUTO_RECONNECT_INTERVAL);
          }
        }
      };
      this._webSocket.onopen = () => {
        this._send({type: 'connect', parameter: {
          platform: tabris.device.platform,
          model: tabris.device.model
        }});
        this._attempts = 0;
        this._sendBufferedMessages();
      };
      this._webSocket.onmessage = event => {
        try {
          console.log(new Function('return (' + event.data + ')')());
        } catch (ex) {
          console.warn(ex);
        }
      };
    }

    _reconnect() {
      this._webSocket = null;
      if (++this._attempts <= MAX_ATTEMPTS) {
        this._connect();
      } else {
        console.error(CONNECTION_PROBLEM_MESSAGE);
      }
    }

    _sendBufferedMessages() {
      for(let i = 0; i < this._buffer.length; ++i) {
        this._send(this._buffer[i]);
      }
      this._buffer = [];
    }

    _send({type, parameter}) {
      this._webSocket.send(JSON.stringify({
        sessionId: this._sessionId,
        type,
        parameter
      }));
    }

  };

})();
