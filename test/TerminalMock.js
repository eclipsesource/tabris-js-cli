const {stub} = require('./test');
const EventEmitter = require('events');

module.exports = class TerminalMock extends EventEmitter {

  constructor() {
    super();
    this.log = stub();
    this.info = stub();
    this.debug = stub();
    this.warn = stub();
    this.infoBlock = stub();
    this.message = stub();
    this.error = stub();
    this.output = stub();
    this.returnValue = stub();
    this._line = '';
    this._promptEnabled = false;
  }

  set line(line) {
    this._line = line;
  }

  get line() {
    return this._line;
  }

  set promptEnabled(enabled) {
    this._promptEnabled = !!enabled;
    if (this._promptEnabled) {
      this._line = '';
    }
  }

  get promptEnabled() {
    return this._promptEnabled;
  }

};
