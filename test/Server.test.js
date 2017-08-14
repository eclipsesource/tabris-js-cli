const {join, basename} = require('path');
const {writeFileSync} = require('fs-extra');
const temp = require('temp').track();
const portscanner = require('portscanner');
const fetch = require('node-fetch');
const {expect} = require('./test');
const Server = require('../src/services/Server');


describe('Server', function() {

  let server, path;

  beforeEach(function() {
    server = new Server();
    path = temp.mkdirSync('foo');
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
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
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
      writeFileSync(join(path, 'package.json'), '{}');
      return server.serve(path).then(expectFail, err => {
        expect(err.message).to.equal('package.json must contain a "main" field');
      });
    });

    it('starts a server', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      return server.serve(path)
        .then(() => getPortStatus(server.port))
        .then((status) => {
          expect(status).to.equal('open');
        });
    });

    it('uses next unused port', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      let server2 = new Server();
      return server.serve(path).then(() => {
        return server2.serve(path).then(() => {
          expect(server.port).to.be.ok;
          expect(server2.port).to.be.ok;
          expect(server2.port).to.not.equal(server.port);
        });
      });
    });

    it('delivers directory contents', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      writeFileSync(join(path, 'foo.js'), 'content');
      return server.serve(path)
        .then(() => fetch(`http://127.0.0.1:${server.port}/foo.js`))
        .then(response => response.text())
        .then(text => {
          expect(text).to.equal('content');
        });
    });

    it('delivers a synthetic package.json for a file', function() {
      let file = join(path, 'foo.js');
      writeFileSync(file, 'content');
      return server.serve(file)
        .then(() => fetch(`http://127.0.0.1:${server.port}/package.json`))
        .then(response => response.json())
        .then(json => {
          expect(json.main).to.equal(basename(file));
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