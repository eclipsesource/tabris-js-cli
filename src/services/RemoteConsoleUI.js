const {red} = require('chalk');
const readline = require('readline');

module.exports = class RemoteConsoleUI {

  constructor(debugServer) {
    this._debugServer = debugServer;
    this._readline = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'JS> '
    }).on('line', line => this._submitCommand(line))
      .on('close', () => process.exit(0));
    this._wrapConsoleObject();
  }

  _submitCommand(line) {
    const command = line.replace(/\;*$/, '');
    if (command !== '') {
      if (command === 'exit') {
        process.exit(0);
      }
      if (!this._debugServer.send(command)) {
        console.log(red('Command could not be sent'));
      }
    }
    this._readline.prompt();
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
