const fs = require('fs');
const os = require('os');
const {join} = require('path');
const {expect} = require('./test');
const {CLIHistory, DIRECTION_PREV, DIRECTION_NEXT} = require('../src/services/CLIHistory');

const FILE_PATH = join(os.tmpdir(), 'cli_history.log');

describe('CLI History', function() {

  let cliHistory = null;

  this.timeout(30000);

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
    for (let i = 0; i < 1100; ++i) {
      cliHistory.addToHistory(`command ${i}`);
    }
    expect(cliHistory._history.length).to.equal(1000);
  }).timeout(8000);

  it('remove old items when limit is exceeded', function() {
    for (let i = 1; i <= 1100; ++i) {
      cliHistory.addToHistory(`command ${i}`);
    }
    console.log(cliHistory._history);
    cliHistory.moveHistory(DIRECTION_PREV);
    const lastItem = cliHistory.currentHistory;
    expect(cliHistory._history[0]).to.equal('command 101')
      && expect(lastItem).to.equal('command 1100');
  }).timeout(8000);

  it('should be empty when previous item called more than limit', function() {
    for (let i = 1; i <= 2000; ++i) {
      cliHistory.moveHistory(DIRECTION_PREV);
    }
    const currentItem = cliHistory.currentHistory;
    expect(currentItem).to.equal('');
  }).timeout(8000);

  it('should be empty when next item called more than limit', function() {
    for (let i = 1; i <= 2000; ++i) {
      cliHistory.moveHistory(DIRECTION_NEXT);
    }
    const currentItem = cliHistory.currentHistory;
    expect(currentItem).to.equal('');
  }).timeout(8000);

});
