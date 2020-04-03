const {gray, yellow, red, blue, bold} = require('chalk');
const readline = require('../lib/readline/readline');
const {pathCompleter} = require('./pathCompleter');
const EventEmitter = require('events');
const boxen = require('boxen');
const {terminate} = require('../helpers/proc');

const PROMPT = blue.bold('>> ');

module.exports = class Terminal extends EventEmitter {

  static create(options) {
    const readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: options.interactive ? PROMPT : '',
      historySize: 0
    });
    return new Terminal(console, readlineInterface, options.interactive);
  }

  /**
   * @param {Console} console
   * @param {readline.Interface} readlineInterface
   * @param {boolean} interactive
   */
  constructor(console, readlineInterface, interactive) {
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
    this._readline.on('close', () => terminate());
    if (interactive) {
      this._handleReadlineInputEvents();
    }
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
    this._hidePrompt();
    this._console.log(boxen(
      yellow(title) + '\n' + indentedBody
      , {padding: {left: 1, right: 1}, borderStyle: 'round'}));
    this._restorePrompt();
  }

  message(text) {
    this._hidePrompt();
    this._console.log(yellow(text));
    this._restorePrompt();
  }

  output(text) {
    this._hidePrompt();
    this._console.log(text);
    this._restorePrompt();
  }

  log(text) {
    this._hidePrompt();
    this._console.log(indentLog(text, ' '));
    this._restorePrompt();
  }

  info(text) {
    this._hidePrompt();
    this._console.log(blue(indentLog(text, '>')));
    this._restorePrompt();
  }

  debug(text) {
    this._hidePrompt();
    this._console.log(indentLog(text, ' '));
    this._restorePrompt();
  }

  warn(text) {
    this._hidePrompt();
    this._console.log(yellow(indentLog(text, '>')));
    this._restorePrompt();
  }

  error(text) {
    this._hidePrompt();
    this._console.error(red(indentLog(text, '>')));
    this._restorePrompt();
  }

  returnValue(text) {
    this._hidePrompt();
    this._console.log(`${gray('<')}  ${text}`);
    this._restorePrompt();
  }

  messageNoAppConnected(message) {
    this.message(`${message}: no Tabris.js 3 app connected!`);
  }

  /**
   * @param {string} prefix
   * @param {string} initialText
   */
  async promptText(prefix, initialText = '') {
    this._readline.completer = pathCompleter;
    this.emit('question');
    let result = await new Promise(resolve => {
      this._readline.line = initialText;
      this._readline.question(bold(`${prefix} ${blue('>> ')}`), resolve);
      this._readline._moveCursor(Infinity);
    });
    this.emit('questionAnswered');
    this._readline.completer = null;
    this._readline.prompt();
    return result;
  }

  /**
   *
   * @param {string} prefix
   */
  async promptBoolean(prefix) {
    this.emit('question');
    this._readline.setPrompt(bold(`${prefix} (y/n) ${blue('>> ')}`));
    this._readline.prompt();
    let result = await new Promise(resolve => {
      this._readline.input.once('keypress', (_char, key) => resolve(key.name === 'y'));
    });
    this.emit('questionAnswered');
    this._readline.line = '';
    this._readline.setPrompt(PROMPT);
    this._readline.prompt();
    return result;
  }

  _handleReadlineInputEvents() {
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

const indentLog = (log, prefix) => log.split('\n').map((line, i) => `${i === 0 ? prefix : ' '}  ${line}`).join('\n');
