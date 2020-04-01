const os = require('os');
const {join} = require('path');
const {CLIHistory, DIRECTION_NEXT, DIRECTION_PREV} = require('./CLIHistory');
const {terminate} = require('../helpers/proc');

module.exports = class RemoteConsole {

  static create({debugServer, terminal}) {
    return new RemoteConsole(debugServer, terminal);
  }

  /**
   * @param {import('./DebugServer')} debugServer
   * @param {import('./Terminal')} terminal
   */
  constructor(debugServer, terminal) {
    this._debugServer = debugServer;
    this._terminal = terminal;
    this._terminal.promptEnabled = true;
    this._debugServer.onEvaluationCompleted = () => this._onEvaluationCompleted();
    this._cliHistory = new CLIHistory(join(os.homedir(), '.tabris-cli', 'cli_history.log'));
    this._terminal.on('line', line => this._submitCommand(line));
    this._terminal.on('keypress', key => {
      if (key.name === 'up' || key.name === 'down') {
        this._updateInput(key.name === 'up' ? DIRECTION_PREV : DIRECTION_NEXT);
      }
    });
  }

  _submitCommand(line) {
    const command = line.replace(/;*$/, '');
    if (command !== '') {
      if (command === 'exit') {
        terminate();
      }
      this._cliHistory.addToHistory(command);
      if (!this._debugServer.evaluate(command)) {
        this._terminal.message('Command could not be sent: no device connected!');
      } else {
        this._terminal.promptEnabled = false;
      }
    }
  }

  _updateInput(direction) {
    this._cliHistory.moveHistory(direction);
    const command = this._cliHistory.currentHistory;
    this._terminal.clearInput(command);
  }

  _onEvaluationCompleted() {
    this._terminal.promptEnabled = true;
  }

};
