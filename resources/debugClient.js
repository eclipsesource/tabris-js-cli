/* global tabris:false WebSocket:false debugClient:true */
(function() {

  debugClient = {

    sessionId: '{{SessionId}}',
    serverId: '{{ServerId}}',

    start() {
      this.ModulePreLoader.patchModuleClass();
      const packageJson = tabris.app.getResourceLocation('package.json');
      const serverUrl = packageJson.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i)[1];
      const protocol = packageJson.indexOf('https') === 0 ? 'wss' : 'ws';
      const webSocketFactory = {
        createWebSocket: () => {
          return new WebSocket(`${protocol}://${serverUrl}/?session=${this.sessionId}&server=${this.serverId}`, '');
        }
      };
      const rc = new debugClient.RemoteConsole(webSocketFactory);
      const SUPPORTED_EVENTS = ['log', 'info', 'error', 'warn', 'debug'];
      tabris.on('log', (event) => {
        if (!SUPPORTED_EVENTS.includes(event.level)) {
          throw new Error(`Handling log event ${event.level} not supported.`);
        }
        rc[event.level](event.message);
      });
      // eslint-disable-next-line no-constant-condition
      if ('{{EnableRequestLogging}}' === 'true') {
        this._initRequestsLogging(rc);
      }
    },

    _initRequestsLogging(rc) {
      const originalFetch = global.fetch;
      tabris.fetch = global.fetch = function(...parameters) {
        return new Promise((resolve, reject) => {
          const url = parameters[0];
          const method = (parameters[1] && parameters[1].method || 'get').toUpperCase();
          const startDate = new Date();
          originalFetch.apply(this, parameters)
            // async is not supported by older Tabris.js clients
            // eslint-disable-next-line promise/prefer-await-to-then
            .then(response => {
              const endDate = new Date();
              const responseTime = endDate.getTime() - startDate.getTime();
              rc.logRequest({url, method, status: response.status, responseTime, origin: 'fetch'});
              resolve(response);
            })
            .catch(reject);
        });
      };
    }

  };

})();
