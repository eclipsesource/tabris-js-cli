const {join} = require('path');
const {writeFileSync, realpathSync} = require('fs-extra');
const temp = require('temp');
const portscanner = require('portscanner');
const fetch = require('node-fetch');
const {expect, stub, restore, writeTabrisProject} = require('./test');
const Server = require('../src/services/Server');
const proc = require('../src/helpers/proc');
const TerminalMock = require('./TerminalMock.js');
const htmllint = require('htmllint');

describe('Server', function() {

  let server, path;

  beforeEach(function() {
    path = realpathSync(temp.mkdirSync('foo'));
    server = new Server({terminal: new TerminalMock()});
    stub(proc, 'execSync');
    stub(proc, 'exec').returns({stdout: {on: stub()}, stderr: {on: stub()}});
  });

  afterEach(function() {
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

    it('returns port number when started', async function() {
      writeTabrisProject(path);
      await server.serve(path);
      expect(server.port).to.be.a('number');
      expect(server.port).to.be.at.least(8080);
    });

  });

  describe('serve', function() {

    it('fails without path argument', async function() {
      try {
        await server.serve();
        expectFail();
      } catch(e) {
        expect(e.message).to.equal('path missing');
      }
    });

    it('fails with non-existent path', async function() {
      try {
        await server.serve('foobar.js');
        expectFail();
      } catch(e) {
        expect(e.message).to.equal('No such file or directory: foobar.js');
      }
    });

    it('fails with a directory that is missing a package.json', async function() {
      try {
        await server.serve(path);
        expectFail();
      } catch(e) {
        expect(e.message).to.equal('Directory must contain package.json');
      }
    });

    it('fails with package.json that is missing a `main` field', async function() {
      writeTabrisProject(path, '{}');
      try {
        await server.serve(path);
        expectFail();
      } catch(e) {
        expect(e.message).to.equal('package.json must contain a "main" field');
      }
    });

    it('fails if tabris module is not installed', async function() {
      writeTabrisProject(path, null, false);
      try {
        await server.serve(path);
        expectFail();
      } catch(e) {
        expect(e.message).to.equal('No tabris module installed; did you run npm install?');
      }
    });

    it('fails with interactive flag if tabris version is not supported', async function() {
      writeTabrisProject(path, null, '{"version": "2.0.0"}');
      server =  new Server({watch: true, terminal: new TerminalMock(), interactive: true});

      try {
        await server.serve(path);
        expectFail();
      } catch(e) {
        expect(e.message).to.equal('Interactive console (-i, --interactive) feature requires a Tabris.js 3.x project');
      }
    });

    it('fails with autoReload flag if tabris version is not supported', async function() {
      writeTabrisProject(path, null, '{"version": "2.0.0"}');
      server =  new Server({watch: true, terminal: new TerminalMock(), autoReload: true});

      try {
        await server.serve(path);
        expectFail();
      } catch(e) {
        expect(e.message).to.equal('Auto reload (-a, --auto-reload) feature requires a Tabris.js 3.x project');
      }
    });

    it('runs build script', async function() {
      writeTabrisProject(path);
      await server.serve(path);
      expect(proc.execSync).to.have.been.calledWith('npm', ['run', '--if-present', 'build'], {cwd: path});
    });

    it('runs watch script when watch option given', async function() {
      server = new Server({watch: true, terminal: new TerminalMock()});
      writeTabrisProject(path);
      await server.serve(path);
      expect(proc.execSync).not.to.have.been.called;
      expect(proc.exec).to.have.been.calledWith('npm', ['run', '--if-present', 'watch'], {
        cwd: path,
        stdio: 'pipe'
      });
    });

    it('starts a server', async function() {
      writeTabrisProject(path);
      await server.serve(path);
      let status = await getPortStatus(server.port);
      expect(status).to.equal('open');
    });

    it('uses next unused port', async function() {
      writeTabrisProject(path);
      let server2 = new Server({terminal: new TerminalMock()});
      await server.serve(path);
      await server2.serve(path);
      expect(server.port).to.be.ok;
      expect(server2.port).to.be.ok;
      expect(server2.port).to.not.equal(server.port);
    });

    it('delivers directory contents', async function() {
      writeTabrisProject(path);
      writeFileSync(join(path, 'foo.js'), 'content');
      await server.serve(path);
      let response = await fetch(`http://127.0.0.1:${server.port}/foo.js`);
      let text = await response.text();
      expect(text).to.equal('content');
    });

    it('shows a dynamic message on the default route', async function() {
      writeTabrisProject(path);
      writeFileSync(join(path, 'package.json'), '{"main": "unused.js"}');
      await server.serve(path);

      let response = await fetch(`http://127.0.0.1:${server.port}/`);
      let text = await response.text();

      expect(text).to.match(/Tabris\.js CLI is running/);
      expect(text).to.match(/src="data:image\/png;base64/);
      expect(text).to.match(/URL/);
      expect(text).to.match(/Scan the QR Code below/);
      expect(text).to.match(/href="https:\/\/docs.tabris.com\/latest\/developer-app.html"/);
      expect(await htmllint(text, {
        'attr-bans': [],
        'indent-style': 'spaces',
        'indent-width': 2,
        'img-req-alt': false,
        'tag-close': false
      })).to.deep.equal([]);
    });

  });

});

function getPortStatus(port) {
  return portscanner.checkPortStatus(port, '127.0.0.1');
}

function expectFail() {
  throw new Error('expected to fail');
}
