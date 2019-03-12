/* global tabris:false WebSocket:false debugClient:true */
(function() {

  debugClient = {

    sessionId: '{{SessionId}}',

    start() {
      this.ModulePreLoader.patchModuleClass();
      const serverUrl = tabris.app
        .getResourceLocation('package.json')
        .match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i)[1];
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

})();
