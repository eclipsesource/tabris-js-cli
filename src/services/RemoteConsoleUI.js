const os = require('os');
const {blue, red} = require('chalk');
const {join} = require('path');
const readline = require('readline');
const {CLIHistory, DIRECTION_NEXT, DIRECTION_PREV} = require('./CLIHistory');

module.exports = class RemoteConsoleUI {

  constructor(debugServer) {
    this._debugServer = debugServer;
    this._cliHistory = new CLIHistory(join(os.homedir(), '.tabris-cli', 'cli_history.log'));
    this._readline = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: blue('>> ')
    }).on('line', line => this._submitCommand(line))
      .on('close', () => process.exit(0));
    this._readline.input.on('keypress', (e, key) => {
      if (key.name === 'up' || key.name === 'down') {
        this._updateInput(key.name === 'up' ? DIRECTION_PREV : DIRECTION_NEXT);
      }
    });
    this._wrapConsoleObject();
  }

  _submitCommand(line) {
    const command = line.replace(/\;*$/, '');
    if (command !== '') {
      if (command === 'exit') {
        process.exit(0);
      }
      this._cliHistory.addToHistory(command);
      if (!this._debugServer.send(command)) {
        console.log(red('Command could not be sent'));
      }
    }
    this._readline.prompt();
  }

  _updateInput(direction) {
    this._cliHistory.moveHistory(direction);
    const command = this._cliHistory.currentHistory;
    this._readline.line = command;
    this._readline.cursor = command.length;
    this._readline.prompt(true);
  }

  _wrapConsoleObject() {
    const levels = ['log', 'info', 'error', 'debug', 'warn'];
    for (const level of levels) {
      const oldConsole = console[level];
      console[level] = (...args) => {
        // VT100 escape code to delete line
        this._readline.output.write('\x1b[2K\r');
        oldConsole.apply(console, Array.prototype.slice.call(args));
        this._readline.prompt(true);
      };
    }
  }

};
