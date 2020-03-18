const nodeWifi = require('node-wifi');
const os = require('os');
const {expect, stub, restore, match} = require('./test');
const ServerInfo = require('../src/services/ServerInfo');
const TerminalMock = require('./TerminalMock');
const {URL} = require('url');

const ansiiEscapeBlackSquare = '\u001b\\[40m {2}\u001b\\[0m';
const ansiiEscapeWhiteSquare = '\u001b\\[47m {2}\u001b\\[0m';

describe('ServerInfo', function() {

  afterEach(restore);

  describe('.show()', function() {

    it('prints QR code to console', async function() {
      const terminal = new TerminalMock();
      const serverInfo = new ServerInfo({
        port: '8080',
        terminal
      }, [new URL('http://127.0.0.1:8080')], false);

      await serverInfo.show();

      expect(terminal.log).to.have.been.calledWithMatch(/[▄█]+/);
    });

    it('prints QR code with terminal renderer to console', async function() {
      const terminal = new TerminalMock();
      const serverInfo = new ServerInfo({
        port: '8080',
        terminal,
      }, [new URL('http://127.0.0.1:8080')], false, 'terminal');

      await serverInfo.show();

      const qrCodeSize = 27;
      let regexp = new RegExp(`((${ansiiEscapeBlackSquare}|${ansiiEscapeWhiteSquare})+\\n){${qrCodeSize}}$`, 'gm');
      expect(terminal.log).to.have.been.called.calledWithMatch(regexp);
    });

    it('prints given external URL', async function() {
      const terminal = new TerminalMock();
      const serverInfo = new ServerInfo({
        port: '8081',
        terminal
      }, [new URL('http://127.0.0.1:8080')], false);

      await serverInfo.show();

      expect(terminal.infoBlock).to.have.been.calledWithMatch({
        title: match(/Available URLs/),
        body: match(/http:\/\/127.0.0.1:8080/)
      });
    });

    it('prints given external URL with https default prot', async function() {
      const terminal = new TerminalMock();
      const serverInfo = new ServerInfo({
        port: '8081',
        terminal
      }, [new URL('https://127.0.0.1:443')], false);

      await serverInfo.show();

      expect(terminal.infoBlock).to.have.been.calledWithMatch({
        title: match(/Available URLs/),
        body: match(/https:\/\/127.0.0.1:443/)
      });
    });

    it('does not print QR code to console if noIntro is true', async function() {
      const terminal = new TerminalMock();
      const serverInfo = new ServerInfo({
        port: '8080',
        terminal
      }, [new URL('http://127.0.0.1:8080')], true);

      await serverInfo.show();

      expect(terminal.log).not.to.have.been.calledWithMatch(new RegExp(ansiiEscapeBlackSquare));
    });

    it('prints actual port if noIntro is true', async function() {
      const terminal = new TerminalMock();
      const serverInfo = new ServerInfo({
        port: '8081',
        terminal
      }, [new URL('http://127.0.0.1:8080')], true);

      await serverInfo.show();

      expect(terminal.message).to.have.been.calledWithMatch(/CLI running on port 8081/);
    });

  });

  describe('.selectUrlForQRCode()', function() {

    it('returns address of only interface', async function() {
      let serverInfo = new ServerInfo({port: '8080', wsPort: '8081'}, [new URL('http://127.0.0.1:8080')]);
      stub(serverInfo, 'getFirstWifiAddress');

      let url = await serverInfo.selectUrlForQRCode();

      expect(serverInfo.getFirstWifiAddress).to.have.not.been.called;
      expect(url.hostname).to.equal('127.0.0.1');
      expect(url.protocol).to.equal('http:');
      expect(url.port).to.equal('8080');
    });

    describe('when more than external address available', function() {

      describe('on platforms other than macOS', function() {

        mockPlatform('any');

        it('returns first external address if there are no current WiFi connections', async function() {
          let serverInfo = new ServerInfo(
            {port: '8080'},
            [new URL('http://127.0.0.1:8080'), new URL('http://127.0.0.2:8081')]
          );
          stub(nodeWifi, 'init');
          stub(nodeWifi, 'getCurrentConnections').callsFake(() => Promise.resolve([]));

          let url = await serverInfo.selectUrlForQRCode();

          expect(url.host).to.equal('127.0.0.1:8080');
          expect(url.protocol).to.equal('http:');
        });

        it('returns IPv4 WiFi interface address', async function() {
          let serverInfo = new ServerInfo(
            {port: '8080'},
            [new URL('http://127.0.0.1:8080'), new URL('http://127.0.0.2:8081')]
          );
          stub(nodeWifi, 'init');
          stub(nodeWifi, 'getCurrentConnections').callsFake(() => Promise.resolve([{iface: 'my-iface'}]));
          stub(os, 'networkInterfaces').callsFake(() => ({
            'my-iface': [
              {family: 'IPv6', address: 'ipv6-address'},
              {family: 'IPv4', address: 'ipv4-address'}
            ]
          }));

          let url = await serverInfo.selectUrlForQRCode();

          expect(url.host).to.equal('ipv4-address:8080');
          expect(url.protocol).to.equal('http:');
        });

        it('returns first IPv4 WiFi interface address when multiple are available', async function() {
          let serverInfo = new ServerInfo(
            {port: '8080'},
            [new URL('http://127.0.0.1:8080'), new URL('http://127.0.0.2:8081')]
          );
          stub(nodeWifi, 'init');
          stub(nodeWifi, 'getCurrentConnections').callsFake(() => Promise.resolve([{iface: 'my-iface'}]));
          stub(os, 'networkInterfaces').callsFake(() => ({
            'my-iface': [
              {family: 'IPv4', address: 'ipv4-address-1'},
              {family: 'IPv4', address: 'ipv4-address-2'},
              {family: 'IPv4', address: 'ipv4-address-3'}
            ]
          }));

          let url = await serverInfo.selectUrlForQRCode();

          expect(url.host).to.equal('ipv4-address-1:8080');
          expect(url.protocol).to.equal('http:');        });

      });

      describe('on macOS', function() {

        mockPlatform('darwin');

        it('returns first external address and does not use node-wifi', async function() {
          let serverInfo = new ServerInfo(
            {port: '8080'},
            [new URL('http://127.0.0.1:8080'), new URL('http://127.0.0.2:8081')]
          );
          stub(nodeWifi, 'init');
          stub(nodeWifi, 'getCurrentConnections');

          let url = await serverInfo.selectUrlForQRCode();

          expect(nodeWifi.getCurrentConnections).not.to.have.been.called;
          expect(nodeWifi.init).not.to.have.been.called;
          expect(url.host).to.equal('127.0.0.1:8080');
          expect(url.protocol).to.equal('http:');
        });

      });

    });



  });

});

function mockPlatform(platform) {

  let originalPlatform;

  before(function() {
    originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {value: platform});
  });

  after(function() {
    this.originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {value: originalPlatform});
  });

}
