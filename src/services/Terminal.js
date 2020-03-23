const {gray, yellow, red, blue} = require('chalk');
const readline = require('../lib/readline/readline');
const EventEmitter = require('events');
const {Readable} = require('stream');
const boxen = require('boxen');

module.exports = class Terminal extends EventEmitter {

  static create(options) {
    const readlineInterface = readline.createInterface({
      input: options.interactive ? process.stdin : new Readable({read: () => undefined}),
      output: process.stdout,
      prompt: options.interactive ? blue('>> ') : '',
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
    this._promptEnabled = false;
    this._ignoreInput = true;
    this._readline.on('close', () => this.emit('close'));
    this._readline.on('line', line => {
      if (this._ignoreInput) {
        return;
      }
      if (line) {
        this.emit('line', line);
      } else {
        this.clearInput();
      }
    });
    this._readline.input.prependListener('keypress', (_ev, key) => {
      if (key.name === 'return') {
        this._replacePromptInLineWith(gray('>> '));
      }
    });
    this._readline.input.on('keypress', (ev, key) => {
      if (!this._ignoreInput) {
        this.emit('keypress', key);
      }
    });
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
    if (enabled && !this._promptEnabled) {
      this._promptEnabled = true;
      this._restorePrompt();
    } else if (!enabled && this._promptEnabled) {
      this._hidePrompt();
      this._promptEnabled = false;
    }
  }

  get promptEnabled() {
    return this._promptEnabled;
  }

  infoBlock({title, body}) {
    const indentedBody = body.split(/\n/).map(line => `  ${blue(line)}`).join('\n');
    this.log(boxen(
      yellow(title) + '\n' + indentedBody
      , {padding: {left: 1, right: 1}, borderStyle: 'round'}));
  }

  message(text) {
    this.log(yellow(text));
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
    this._console.error(red(text));
    this._restorePrompt();
  }

  returnValue(text) {
    this._hidePrompt();
    this._console.log(`${gray('<-')} ${text}`);
    this._restorePrompt();
  }

  _replacePromptInLineWith(prefix) {
    this._clearLine();
    this._readline.output.write(prefix + this._readline.line);
  }

  _hidePrompt() {
    if (this._promptEnabled) {
      if (this._line === null) {
        this._line = this._readline.line;
      }
      this._ignoreInput = true;
      this._clearLine();
    }
  }

  _restorePrompt() {
    if (this._promptEnabled) {
      const command = this._line || '';
      this._readline.line = command;
      this._readline.cursor = command.length;
      this._readline.prompt(true);
      this._ignoreInput = false;
      this._line = null;
    }
  }

  _clearLine() {
    this._readline.output.write('\x1b[2K\r');
  }

};
