const {blue} = require('chalk');
const filewatcher = require('filewatcher');

module.exports = class Watcher {

  constructor(server) {
    this._server = server;
    this._watcher = filewatcher({
      debounce: 1000,
      persistent: true
    });
    this._server.on('request', (req, err) => {
      if (!err) {
        this._watcher.add(req.url.slice(1));
      }
    });
  }

  start() {
    this._watcher.on('change', (filename, stat) => {
      if (stat) {
        if (this._server._debugServer.send('tabris.app.reload()')) {
          console.info(blue(`${filename}' changed, reloading app...`));
        }
      }
    });
  }

  // only using for unit testing
  stop() {
    this._watcher.removeAll();
  }

};
