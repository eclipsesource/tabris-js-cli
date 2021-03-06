const {existsSync, statSync} = require('fs-extra');
const Storage = require('./Storage');

const KEYBOARD_SHORTCUTS_HELP =
`Ctrl+K: print keyboard shortcuts   Ctrl+C: exit
Ctrl+R: reload app                 Ctrl+P: print... (local storage/UI)
Ctrl+T: toggle dev toolbar         Ctrl+X: clear local storage
Ctrl+S: save local storage         Ctrl+L: load local storage`;

module.exports = class KeyboardShortcutHandler {

  constructor({server, terminal}) {
    this._server = server;
    this._terminal = terminal;
    this._storage = new Storage(this._server);
    this._keypressHandler = (_char, key) => this._handleKeypress(_char, key);
    this._terminal.on('question', () => this._enabled = false);
    this._terminal.on('questionAnswered', () => this._enabled = true);
    this._enabled = true;
  }

  printKeyboardShortcuts() {
    this._terminal.infoBlock({title: 'Keyboard shortcuts:', body: KEYBOARD_SHORTCUTS_HELP});
  }

  set _enabled(enabled) {
    if (enabled && !process.stdin.listeners('keypress').includes(this._keypressHandler)) {
      process.stdin.on('keypress', this._keypressHandler);
    } else {
      process.stdin.off('keypress', this._keypressHandler);
    }
  }

  _handleKeypress(_char, key) {
    if (key.ctrl && key.name === 'r') {
      this._reloadApp();
    } else if (key.ctrl && key.name === 'k') {
      this.printKeyboardShortcuts();
    } else if (key.ctrl && key.name === 't') {
      this._toggleDevToolbar();
    } else if (key.ctrl && key.name === 'p') {
      this._print();
    } else if (key.ctrl && key.name === 'x') {
      this._clearStorage();
    } else if (key.ctrl && key.name === 's') {
      this._saveStorage();
    } else if (key.ctrl && key.name === 'l') {
      this._loadStorage();
    }
  }

  _reloadApp() {
    const success = this._server.debugServer.reloadApp();
    if (success) {
      this._server.terminal.message('Reloading app...');
    } else {
      this._server.terminal.messageNoAppConnected('Reload could not be sent');
    }
  }

  _toggleDevToolbar() {
    const success = this._server.debugServer.toggleDevToolbar();
    if (success) {
      this._server.terminal.message('Toggling developer toolbar...');
    } else {
      this._server.terminal.messageNoAppConnected('Could not toggle developer toolbar');
    }
  }

  async _print() {
    if (this._server.debugServer.activeConnections <= 0) {
      this._server.terminal.messageNoAppConnected('Could not print');
      return;
    }
    const result = await this._server.terminal.promptChoice('Print', {
      s: 'storage',
      u: 'UI tree'
    });
    switch(result) {
      case 's': return this._printStorage();
      case 'u': return this._printUiTree();
    }
  }

  _printStorage() {
    const success = this._server.debugServer.printStorage();
    if (success) {
      this._server.terminal.message('Printing storage contents...');
    } else {
      this._server.terminal.messageNoAppConnected('Could not print storage contents');
    }
  }

  _printUiTree() {
    const success = this._server.debugServer.printUiTree();
    if (success) {
      this._server.terminal.message('Printing UI tree...');
    } else {
      this._server.terminal.messageNoAppConnected('Could not print UI tree');
    }
  }

  _clearStorage() {
    const success = this._server.debugServer.clearStorage();
    if (success) {
      this._server.terminal.message('Clearing localStorage and secureStorage...');
    } else {
      this._server.terminal.messageNoAppConnected('Could not clear localStorage and secureStorage');
    }
  }

  async _saveStorage() {
    if (this._server.debugServer.activeConnections <= 0) {
      this._server.terminal.messageNoAppConnected('Could not save storage');
      return;
    }
    const path = await this._terminal.promptText('Save storage to:', 'storage.json');
    if (path === null) {
      return;
    }
    if (!path) {
      this._server.terminal.message('No path given, storage not saved.');
      return;
    }
    if (existsSync(path)) {
      if (!statSync(path).isFile()) {
        this._server.terminal.message(
          'Given path exists, but it is not a file, so it cannot be overwritten.'
        );
        return;
      }
      const overwrite = await this._terminal.promptBoolean('File exists, do you want to overwrite it?');
      if (!overwrite) {
        return;
      }
    }
    this._storage.save(path);
  }

  async _loadStorage() {
    if (this._server.debugServer.activeConnections <= 0) {
      this._server.terminal.messageNoAppConnected('Could not load storage');
      return;
    }
    const initialValue = existsSync('storage.json') ? 'storage.json' : '';
    const path = await this._terminal.promptText('Load storage from:', initialValue);
    if (path === null) {
      return;
    }
    if (!path) {
      this._server.terminal.message('No path given, storage not loaded.');
      return;
    }
    if (!existsSync(path)) {
      this._server.terminal.message(`${path} does not exist.`);
      return this._loadStorage();
    }
    if (!statSync(path).isFile()) {
      this._server.terminal.message(`${path} is not a file.`);
      return;
    }
    this._storage.load(path);
  }

};
