const {join} = require('path');
const {writeFileSync, realpathSync} = require('fs-extra');
const temp = require('temp');
const portscanner = require('portscanner');
const fetch = require('node-fetch');
const {expect, stub, restore, spy, writeTabrisProject} = require('./test');
const Server = require('../src/services/Server');
const proc = require('../src/helpers/proc');
const TerminalMock = require('./TerminalMock.js');

describe('Server', function() {

  let server, path, oldCwd;

  beforeEach(function() {
    path = realpathSync(temp.mkdirSync('foo'));
    oldCwd = process.cwd();
    process.chdir(path);
    server = new Server({terminal: new TerminalMock()});
    stub(proc, 'execSync');
    spy(proc, 'exec');
  });

  afterEach(function() {
    process.chdir(oldCwd);
    restore();
  });

  describe('externalAddresses', function() {

    it('returns an array of IP addresses', function() {
      expect(Server.externalAddresses).to.be.an('array');
      expect(Server.externalAddresses[0]).to.match(/\d+.\d+.\d+.\d+/);
    });

  });

  describe('port', function() {

    it('defaults to `null`', function() {
      expect(server.port).to.be.null;
    });

    it('returns port number when started', function() {
      writeTabrisProject(path);
      return server.serve(path).then(() => {
        expect(server.port).to.be.a('number');
        expect(server.port).to.be.at.least(8080);
      });
    });

  });

  describe('serve', function() {

    it('fails without path argument', function() {
      return server.serve().then(expectFail, err => {
        expect(err.message).to.equal('path missing');
      });
    });

    it('fails with non-existent path', function() {
      return server.serve('foobar.js').then(expectFail, err => {
        expect(err.message).to.equal('No such file or directory: foobar.js');
      });
    });

    it('fails with a directory that is missing a package.json', function() {
      return server.serve(path).then(expectFail, err => {
        expect(err.message).to.equal('Directory must contain package.json');
      });
    });

    it('fails with package.json that is missing a `main` field', function() {
      writeTabrisProject(path, '{}');
      return server.serve(path).then(expectFail, err => {
        expect(err.message).to.equal('package.json must contain a "main" field');
      });
    });

    it('fails if tabris module is not installed', function() {
      writeTabrisProject(path, null, false);
      return server.serve(path).then(expectFail, err => {
        expect(err.message).to.equal('No tabris module installed');
      });
    });

    it('fails with interactive flag if tabris version is not supported', function() {
      writeTabrisProject(path, null, '{"version": "2.0.0"}');
      server =  new Server({watch: true, terminal: new TerminalMock(), interactive: true});

      return server.serve(path).then(expectFail, err => {
        expect(err.message).to.equal(
          'Interactive console (-i, --interactive) feature requires a Tabris.js 3.x project'
        );
      });
    });

    it('fails with autoReload flag if tabris version is not supported', function() {
      writeTabrisProject(path, null, '{"version": "2.0.0"}');
      server =  new Server({watch: true, terminal: new TerminalMock(), autoReload: true});

      return server.serve(path).then(expectFail, err => {
        expect(err.message).to.equal('Auto reload (-a, --auto-reload) feature requires a Tabris.js 3.x project');
      });
    });

    it('runs build script', function() {
      writeTabrisProject(path);
      return server.serve(path)
        .then(() => {
          expect(proc.execSync).to.have.been.calledWith('npm', ['run', '--if-present', 'build'], {cwd: path});
        });
    });

    it('runs watch script when watch option given', function() {
      server =  new Server({watch: true, terminal: new TerminalMock()});
      writeTabrisProject(path);
      return server.serve(path)
        .then(() => {
          expect(proc.execSync).not.to.have.been.calledWith('npm', ['run', '--if-present', 'build'], {cwd: path});
          expect(proc.exec).to.have.been.calledWith('npm', ['run', '--if-present', 'watch'], {
            cwd: path,
            stdio: [null, 'pipe', null]
          });
        });
    });

    it('starts a server', function() {
      writeTabrisProject(path);
      return server.serve(path)
        .then(() => getPortStatus(server.port))
        .then((status) => {
          expect(status).to.equal('open');
        });
    });

    it('uses next unused port', function() {
      writeTabrisProject(path);
      let server2 = new Server({terminal: new TerminalMock()});
      return server.serve(path).then(() => {
        return server2.serve(path).then(() => {
          expect(server.port).to.be.ok;
          expect(server2.port).to.be.ok;
          expect(server2.port).to.not.equal(server.port);
        });
      });
    });

    it('delivers directory contents', function() {
      writeTabrisProject(path);
      writeFileSync(join(path, 'foo.js'), 'content');
      return server.serve(path)
        .then(() => fetch(`http://127.0.0.1:${server.port}/foo.js`))
        .then(response => response.text())
        .then(text => {
          expect(text).to.equal('content');
        });
    });

  });

});

function getPortStatus(port) {
  return portscanner.checkPortStatus(port, '127.0.0.1');
}

function expectFail() {
  throw new Error('expected to fail');
}
