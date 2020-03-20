const readline = require('../lib/readline/readline');
const {terminate} = require('../helpers/proc');

const KEYBOARD_SHORTCUTS_HELP =
`Ctrl+H: print this help, Ctrl+C: exit
Ctrl+R: reload app
Ctrl+T: toggle developer toolbar
Ctrl+U: print UI tree`;

module.exports = class KeyboardShortcutHandler {

  constructor({server, interactive, terminal}) {
    this._server = server;
    this._terminal = terminal;
    this._interactive = interactive;
  }

  printHelp() {
    this._terminal.infoBlock({title: 'Keyboard shortcuts:', body: KEYBOARD_SHORTCUTS_HELP});
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
    } else if (key.ctrl && key.name === 'h') {
      this.printHelp();
    } else if (key.ctrl && key.name === 't') {
      this._toggleDevToolbar();
    } else if (key.ctrl && key.name === 'u') {
      this._printUiTree();
    }
  }

  _reloadApp() {
    let success = this._server.debugServer.reloadApp();
    if (success) {
      this._server.terminal.message('Reloading app...');
    } else {
      this._messageNoAppConnected('Reload could not be sent');
    }
  }

  _toggleDevToolbar() {
    let success = this._server.debugServer.toggleDevToolbar();
    if (success) {
      this._server.terminal.message('Toggling developer toolbar...');
    } else {
      this._messageNoAppConnected('Could not toggle developer toolbar');
    }
  }

  _printUiTree() {
    let success = this._server.debugServer.printUiTree();
    if (success) {
      this._server.terminal.message('Printing UI tree...');
    } else {
      this._messageNoAppConnected('Could not print UI tree');
    }
  }

  _messageNoAppConnected(message) {
    this._server.terminal.message(`${message}: no Tabris.js 3 app connected!`);
  }

  _interceptKeys() {
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
    }
  }

};
