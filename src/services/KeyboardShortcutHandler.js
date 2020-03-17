const {blue, yellow} = require('colors');
const readline = require('../lib/readline/readline');
const {terminate} = require('../helpers/proc');

module.exports = class KeyboardShortcutHandler {

  constructor({server, interactive, terminal}) {
    this._server = server;
    this._terminal = terminal;
    this._interactive = interactive;
  }

  printHelp() {
    const info = yellow('\nKeyboard shortcuts:') + blue('\nCtrl+C: exit, Ctrl+R: reload app\n');
    this._terminal.log(info);
  }

  configureShortcuts() {
    if (!this._interactive) {
      // Note: The readline interface used in interactive mode already handles key press events.
      this._interceptKeys();
    }
    process.stdin.on('keypress', (_char, key) => this._handleKeypress(_char, key));
    return this;
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
      this._reloadApp();
    }
  }

  _reloadApp() {
    let success = this._server.debugServer.reloadApp();
    if (success) {
      this._server.terminal.info('Reloading app...');
    } else {
      this._server.terminal.info('Reload could not be sent: no Tabris.js 3 app connected!');
    }
  }

  _interceptKeys() {
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
    }
  }

};
