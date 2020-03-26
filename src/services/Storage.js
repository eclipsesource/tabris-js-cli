const {readFileSync, writeFileSync, existsSync} = require('fs');

module.exports = class Storage {

  constructor(server) {
    this._server = server;
  }

  save(path) {
    this._server.debugServer.once('storage', storage => {
      writeFileSync(path, JSON.stringify(storage, '  ', 2));
      this._server.terminal.message(`Saved storage to ${path} .`);
    });
    if (!this._server.debugServer.requestStorage()) {
      this._server.terminal.messageNoAppConnected('Cannot save storage');
    }
  }

  load(path) {
    if (this._server.debugServer.activeConnections < 1) {
      this._server.terminal.messageNoAppConnected('Cannot load storage');
      return;
    }
    if (!existsSync(path)) {
      this._server.terminal.message(`Storage to load not found at ${path}.`);
      return;
    }
    let storage;
    try {
      storage = JSON.parse(readFileSync(path));
    } catch(e) {
      this._server.terminal.message(`Could not parse ${path}: ` + e);
      return;
    }
    if (!this._server.debugServer.loadStorage({storage, path})) {
      this._server.terminal.messageNoAppConnected('Cannot load storage');
    }

  }

};
