const {expect, stub, spy} = require('./test');
const readline = require('readline');
const {Readable, Writable} = require('stream');
const Terminal = require('../src/services/Terminal');

class ReadableMock extends Readable {
  _read() {}
}

class WritableMock extends Writable {
  _write() {}
}

describe('Terminal', function() {

  /** @type {readline.Interface} */
  let rlInterface;
  let consoleMock;
  /** @type {Terminal} */
  let terminal;

  beforeEach(function() {
    rlInterface = readline.createInterface({
      input: new ReadableMock(),
      output: new WritableMock()
    });
    consoleMock = {
      log: stub(),
      error: stub()
    };
    terminal = new Terminal(consoleMock, rlInterface, true);
  });

  describe('on user keypress', function() {

    let listener;

    beforeEach(function() {
      listener = spy();
      terminal.on('keypress', listener);
    });

    it('fires keypress event', function() {
      terminal.promptEnabled = true;
      rlInterface.input.emit('keypress', {}, {name: 'up'});
      expect(listener).to.have.been.calledWith({name: 'up'});
    });

    it('does not fire keypress event when prompt is disabled', function() {
      terminal.promptEnabled = false;
      rlInterface.input.emit('keypress', {}, {name: 'up'});
      expect(listener).not.to.have.been.calledWith({name: 'up'});
    });

  });

  describe('on user line input', function() {

    let listener;

    beforeEach(function() {
      listener = spy();
      terminal.on('line', listener);
    });

    it('fires keypress event', function() {
      terminal.promptEnabled = true;
      rlInterface.emit('line', 'foo');
      expect(listener).to.have.been.calledWith('foo');
    });

    it('does not fire keypress event when prompt is disabled', function() {
      terminal.promptEnabled = false;
      rlInterface.emit('line', 'foo');
      expect(listener).not.to.have.been.called;
    });
  });

  describe('clearInput', function() {

    it('writes control characters ', function() {
      terminal.promptEnabled = true;
      spy(rlInterface.output, 'write');

      terminal.clearInput();

      expect(rlInterface.output.write).to.have.been.calledWith('\x1b[2K\r');
    });

    it('replaces current line', function() {
      terminal.promptEnabled = true;
      spy(rlInterface.output, 'write');
      spy(rlInterface, 'prompt');

      terminal.clearInput('foo');

      expect(rlInterface.output.write).to.have.been.calledWith('\x1b[2K\r');
      expect(rlInterface.line).to.equal('foo');
      expect(rlInterface.cursor).to.equal(3);
    });

    it('can not replace input when prompt is disabled ', function() {
      expect(() => terminal.clearInput('foo')).to.throw('Prompt disabled');
    });

  });

  describe('promptEnabled', function() {

    it('is false initially', function() {
      expect(terminal.promptEnabled).to.be.false;
    });

    it('can be set', function() {
      terminal.promptEnabled = true;
      expect(terminal.promptEnabled).to.be.true;
    });

  });

  ['log', 'info', 'debug', 'warn'].forEach(level => {

    describe(level, function() {

      it('clears line', function() {
        terminal.promptEnabled = true;
        spy(rlInterface.output, 'write');

        terminal[level]('foo');

        expect(rlInterface.output.write).to.have.been.calledWith('\x1b[2K\r');
      });

      it('logs to console', function() {
        terminal[level]('foo');
        expect(consoleMock.log).to.have.been.calledWithMatch(/foo/);
      });

      it('restores prompt', function() {
        terminal.promptEnabled = true;
        rlInterface.line = 'foo';
        spy(rlInterface, 'prompt');
        terminal[level]('foo');
        expect(rlInterface.prompt).to.have.been.calledWith(true);
        expect(rlInterface.line).to.equal('foo');
        expect(rlInterface.cursor).to.equal(3);
      });

      it('does not re-enable prompt', function() {
        terminal.promptEnabled = false;
        spy(rlInterface, 'prompt');

        terminal[level]('foo');

        expect(rlInterface.prompt).not.to.have.been.called;
      });

    });

  });

  describe('error', function() {

    it('clears line', function() {
      terminal.promptEnabled = true;
      spy(rlInterface.output, 'write');

      terminal.error('foo');

      expect(rlInterface.output.write).to.have.been.calledWith('\x1b[2K\r');
    });

    it('logs to error console', function() {
      terminal.error('foo');
      expect(consoleMock.error).to.have.been.calledWithMatch('foo');
    });

    it('restores prompt', function() {
      terminal.promptEnabled = true;
      rlInterface.line = 'foo';
      spy(rlInterface, 'prompt');
      terminal.error('foo');
      expect(rlInterface.prompt).to.have.been.calledWith(true);
      expect(rlInterface.line).to.equal('foo');
      expect(rlInterface.cursor).to.equal(3);
    });

    it('does not re-enable prompt', function() {
      terminal.promptEnabled = false;
      spy(rlInterface, 'prompt');

      terminal.error('foo');

      expect(rlInterface.prompt).not.to.have.been.called;
    });

  });

});
