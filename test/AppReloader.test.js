const {EventEmitter} = require('events');
const {expect, stub} = require('./test');
const AppReloader = require('../src/services/AppReloader');
const TerminalMock = require('./TerminalMock');

describe('AppReloader', function() {

  let server;
  let watcher;
  let appReloader;
  const SESSION_ID = 1;


  beforeEach(() => {
    server = new ServerMock();
    watcher = new FileWatcherMock();
    appReloader = new AppReloader(server, watcher);
  });

  it('tracks files on deliver', () => {
    server.emit('deliver', 'file-path');

    expect(watcher.add).to.have.been.calledWith('app-path/file-path');
  });

  describe('start', () => {

    beforeEach(() => appReloader.start());

    it('ignores file changes before first connection', () => {
      watcher.emit('change', 'filename', 'stat');

      expect(server.debugServer.reloadApp).not.to.have.been.called;
      expect(server.terminal.info).not.to.have.been.called;
    });

    describe('after first connection', () => {

      beforeEach(() => server.debugServer.emit('connect', SESSION_ID));

      it('does not reload app when file stats not available ', () => {
        watcher.emit('change', 'filename');

        expect(server.debugServer.reloadApp).not.to.have.been.called;
      });

      it('reloads app when file stats available', () => {
        watcher.emit('change', 'filename', 'stat');

        expect(server.debugServer.reloadApp).to.have.been.calledOnce;
      });

      it('prints info', () => {
        watcher.emit('change', 'filename', 'stat');

        expect(server.terminal.message).to.have.been.calledWithMatch(/'filename' changed/);
      });

      describe('when reload fails', () => {

        beforeEach(() => server.debugServer.reloadApp.returns(false));

        it('reloads on reconnect', () => {
          watcher.emit('change', 'filename', 'stat');

          server.debugServer.reloadApp.reset();
          server.debugServer.reloadApp.returns(true);
          server.debugServer.emit('connect', SESSION_ID);

          expect(server.debugServer.reloadApp).to.have.been.calledOnce;
        });

        it('does not reload on reconnect if connected with a new session ID', () => {
          watcher.emit('change', 'filename', 'stat');

          server.debugServer.reloadApp.reset();
          server.debugServer.reloadApp.returns(true);
          server.debugServer.emit('connect', SESSION_ID + 1);

          expect(server.debugServer.reloadApp).not.to.have.been.called;
        });

        it('does not reload more than once when reconnecting multiple times', () => {
          watcher.emit('change', 'filename', 'stat');

          server.debugServer.reloadApp.reset();
          server.debugServer.reloadApp.returns(true);
          server.debugServer.emit('connect', SESSION_ID);
          server.debugServer.emit('connect', SESSION_ID);
          server.debugServer.emit('connect', SESSION_ID);

          expect(server.debugServer.reloadApp).to.have.been.calledOnce;
        });

        it('reloads only once on reconnect when files changed multiple times while the connection was lost', () => {
          watcher.emit('change', 'filename', 'stat');
          watcher.emit('change', 'filename', 'stat');
          watcher.emit('change', 'filename', 'stat');

          server.debugServer.reloadApp.reset();
          server.debugServer.reloadApp.returns(true);
          server.debugServer.emit('connect', SESSION_ID);

          expect(server.debugServer.reloadApp).to.have.been.calledOnce;
        });

      });

    });

  });

});

class ServerMock extends EventEmitter {
  constructor() {
    super();
    this.terminal = new TerminalMock();
    this.debugServer = new DebugServerMock();
    this.appPath = 'app-path';
  }
}

class FileWatcherMock extends EventEmitter {
  constructor() {
    super();
    this.add = stub();
  }
}

class DebugServerMock extends EventEmitter {
  constructor() {
    super();
    this.reloadApp = stub();
  }
}
