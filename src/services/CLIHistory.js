const fs = require('fs');
const {dirname} = require('path');

const DIRECTION_PREV = 1;
const DIRECTION_NEXT = 2;
const HISTORY_LIMIT = 1000;

class CLIHistory {

  constructor(filePath) {
    this._filePath = filePath;
    if (!fs.existsSync(dirname(filePath))) {
      fs.mkdirSync(dirname(filePath));
    }
    this._history = [];
    this._historyIndex = -1;
    this._loadHistory();
  }

  addToHistory(command) {
    this._history.push(command);
    this._historyIndex = this._history.length;
    this._saveHistory();
  }

  moveHistory(direction) {
    if (direction === DIRECTION_PREV && this._historyIndex > 0) {
      --this._historyIndex;
    } else if (direction === DIRECTION_NEXT && this._historyIndex < this._history.length) {
      ++this._historyIndex;
    }
  }

  get currentHistory() {
    if (this._historyIndex > -1 && this._historyIndex < this._history.length) {
      return this._history[this._historyIndex];
    }
    return '';
  }

  _loadHistory() {
    if (fs.existsSync(this._filePath)) {
      fs.readFileSync(this._filePath)
        .toString()
        .split('\n')
        .forEach(line => {
          if (line.trim() !== '') {
            this._history.push(line);
          }
        });
      this._historyIndex = this._history.length;
    }
  }

  _saveHistory() {
    if (this._history.length > HISTORY_LIMIT) {
      this._history.shift();
      this._historyIndex = this._history.length;
    }
    fs.writeFileSync(this._filePath, this._history.join('\n'));
  }

}

module.exports = {
  CLIHistory,
  DIRECTION_PREV,
  DIRECTION_NEXT
};
