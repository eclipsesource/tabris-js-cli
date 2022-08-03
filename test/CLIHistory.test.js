const fs = require('fs');
const os = require('os');
const {join} = require('path');
const {expect} = require('./test');
const {CLIHistory, DIRECTION_PREV, DIRECTION_NEXT} = require('../src/services/CLIHistory');

const FILE_PATH = join(os.tmpdir(), 'cli_history.log');

describe('CLI History', function() {

  this.timeout(10000);

  let cliHistory = null;

  beforeEach(function() {
    cliHistory = new CLIHistory(FILE_PATH);
  });

  afterEach(function() {
    if (fs.existsSync(FILE_PATH)) {
      fs.unlinkSync(FILE_PATH);
    }
  });

  it('should be empty first time in previous direction', function() {
    cliHistory.moveHistory(DIRECTION_PREV);
    const ch1 = cliHistory.currentHistory;
    expect(ch1).to.equal('');
  });

  it('should be empty first time in next direction', function() {
    cliHistory.moveHistory(DIRECTION_NEXT);
    const ch1 = cliHistory.currentHistory;
    expect(ch1).to.equal('');
  });

  it('add command and navigate to previous history', function() {
    const command = 'tabris.device';
    cliHistory.addToHistory(command);
    cliHistory.moveHistory(DIRECTION_PREV);
    const ch1 = cliHistory.currentHistory;
    expect(ch1).to.equal(command);
  });

  it('should keep only 1000 items', function() {
    for (let i = 0; i < 2000; ++i) {
      cliHistory.addToHistory(`command ${i}`);
    }
    expect(cliHistory._history.length).to.equal(1000);
  }).timeout(10000);

  it('remove old items when limit is exceeded', function() {
    for (let i = 1; i <= 2000; ++i) {
      cliHistory.addToHistory(`command ${i}`);
    }
    cliHistory.moveHistory(DIRECTION_PREV);
    const lastItem = cliHistory.currentHistory;
    expect(cliHistory._history[0]).to.equal('command 1001')
      && expect(lastItem).to.equal('command 2000');
  });

  it('should be empty when previous item called more than limit', function() {
    for (let i = 1; i <= 2000; ++i) {
      cliHistory.moveHistory(DIRECTION_PREV);
    }
    const currentItem = cliHistory.currentHistory;
    expect(currentItem).to.equal('');
  });

  it('should be empty when next item called more than limit', function() {
    for (let i = 1; i <= 2000; ++i) {
      cliHistory.moveHistory(DIRECTION_NEXT);
    }
    const currentItem = cliHistory.currentHistory;
    expect(currentItem).to.equal('');
  });

});
