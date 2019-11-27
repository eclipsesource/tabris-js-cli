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
    }

  };

})();
