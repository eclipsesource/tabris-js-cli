const filewatcher = require('filewatcher');

module.exports = class AppReloader {

  constructor(server, watcher = filewatcher({debounce: 100, persistent: true})) {
    this._server = server;
    this._watcher = watcher;
    this._lastSessionId = null;
    this._server.on('deliver', url => this._watcher.add(url));
    this._server.debugServer.once('connect', id => this._lastSessionId = id);
    this._reloadApp = (sessionId = this._lastSessionId) => {
      if (this._lastSessionId !== sessionId) {
        return;
      }
      const success = this._server.debugServer.reloadApp();
      if (!success) {
        this._server.debugServer.removeListener('connect', this._reloadApp);
        this._server.debugServer.once('connect', this._reloadApp);
      }
      this._lastSessionId = sessionId;
    };
  }

  start() {
    this._watcher.on('change', (filename, stat) => {
      if (stat && this._lastSessionId !== null) {
        this._server.terminal.message(`'${filename}' changed, reloading app...`);
        this._reloadApp();
      }
    });
    return this;
  }


  // only using for testing
  stop() {
    this._watcher.removeAll();
    return this;
  }

};
