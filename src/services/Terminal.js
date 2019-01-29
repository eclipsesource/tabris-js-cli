const {yellow, blue} = require('chalk');
const readline = require('../lib/readline/readline');
const EventEmitter = require('events');

module.exports = class Terminal extends EventEmitter {

  static create() {
    const readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: blue('>> '),
      historySize: 0
    });
    return new Terminal(console, readlineInterface);
  }

  /**
   * @param {Console} console
   * @param {readline.Interface} readlineInterface
   */
  constructor(console, readlineInterface) {
    super();
    if (!console) {
      throw new Error('console is missing');
    }
    if (!readlineInterface) {
      throw new Error('readlineInterface is missing');
    }
    this._line = null;
    this._console = console;
    this._readline = readlineInterface;
    this._readline.on('close', () => this.emit('close'));
    this._readline.on('line', line => {
      if (line) {
        this._line = null;
        this.emit('line', line);
      } else {
        this.clearInput();
      }
    });
    this._readline.pause();
    this._readline.input.on('keypress', (ev, key) => this.emit('keypress', key));
    this._promptEnabled = false;
  }

  clearInput(line = '') {
    if (line && !this.promptEnabled) {
      throw new Error('Prompt disabled');
    }
    this._clearLine();
    this._line = line;
    this._restorePrompt();
  }

  set promptEnabled(enabled) {
    if (this._promptEnabled === !!enabled) {
      return;
    }
    if (!enabled) {
      this._hidePrompt();
    }
    this._promptEnabled = !!enabled;
    if (this._promptEnabled) {
      this._restorePrompt();
    }
  }

  get promptEnabled() {
    return this._promptEnabled;
  }

  log(text) {
    this._hidePrompt();
    this._console.log(text);
    this._restorePrompt();
  }

  info(text) {
    this._hidePrompt();
    this._console.log(blue(text));
    this._restorePrompt();
  }

  debug(text) {
    this._hidePrompt();
    this._console.log(text);
    this._restorePrompt();
  }

  warn(text) {
    this._hidePrompt();
    this._console.log(yellow(text));
    this._restorePrompt();
  }

  error(text) {
    this._hidePrompt();
    this._console.error(text);
    this._restorePrompt();

  }

  _hidePrompt() {
    if (this._promptEnabled) {
      if (this._line === null) {
        this._line = this._readline.line;
      }
      this._readline.pause();
      this._clearLine();
    }
  }

  _restorePrompt() {
    if (this._promptEnabled) {
      const command = this._line || '';
      this._readline.line = command;
      this._readline.cursor = command.length;
      this._readline.prompt(true);
      this._line = null;
    }
  }

  _clearLine() {
    this._readline.output.write('\x1b[2K\r');
  }

};
