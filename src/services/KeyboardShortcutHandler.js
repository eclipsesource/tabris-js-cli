const readline = require('../lib/readline/readline');
const {terminate} = require('../helpers/proc');

module.exports = class KeyboardShortcutHandler {

  constructor(server, interactive) {
    this._server = server;
    this._interactive = interactive;
  }

  configureShortcuts() {
    if (!this._interactive) {
      // Note: The readline interface used in interactive mode already handles key press events.
      this._interceptKeys();
    }
    process.stdin.on('keypress', (_char, key) => this._handleKeypress(_char, key));
  }

  _handleKeypress(_char, key) {
    if (!this._interactive) {
      if (key.ctrl && key.name === 'c') {
        terminate();
      } else if (key.name === 'return') {
        console.log();
        return;
      }
    }
    if (key.ctrl && key.name === 'r') {
      let success = this._server.debugServer.reloadApp();
      if (success) {
        this._server.terminal.info('Reloading app...');
      } else {
        this._server.terminal.info('Reload could not be sent: no Tabris.js 3 app connected!');
      }
    }
  }

  _interceptKeys() {
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
    }
  }

};
