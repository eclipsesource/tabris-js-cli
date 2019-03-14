const nodeWifi = require('node-wifi');
const os = require('os');
const {expect, stub, restore} = require('./test');
const ServerInfo = require('../src/services/ServerInfo');
const TerminalMock = require('./TerminalMock');

describe('ServerInfo', function() {

  afterEach(restore);

  describe('.show()', function() {

    it('prints QR code to console', async function() {
      const terminal = new TerminalMock();
      const serverInfo = new ServerInfo({
        port: '8080',
        wsPort: '8081',
        terminal
      }, ['127.0.0.1']);

      await serverInfo.show();

      expect(terminal.log).to.have.been.calledWithMatch(/[▄█]+/);
    });

  });

  describe('.selectAddressForQRCode()', function() {

    it('returns address of only interface', async function() {
      let serverInfo = new ServerInfo({port: '8080', wsPort: '8081'}, ['127.0.0.1']);
      stub(serverInfo, 'getFirstWifiInterface');

      let address = await serverInfo.selectAddressForQRCode();

      expect(serverInfo.getFirstWifiInterface).to.have.not.been.called;
      expect(address).to.equal('127.0.0.1');
    });

    describe('when more than external address available', function() {

      describe('on platforms other than macOS', function() {

        mockPlatform('any');

        it('returns first external address if there are no current WiFi connections', async function() {
          let serverInfo = new ServerInfo({port: '8080', wsPort: '8081'}, ['127.0.0.1', '127.0.0.2']);
          stub(nodeWifi, 'init');
          stub(nodeWifi, 'getCurrentConnections').callsFake(() => Promise.resolve([]));

          let address = await serverInfo.selectAddressForQRCode();

          expect(address).to.equal('127.0.0.1');
        });

        it('returns IPv4 WiFi interface address', async function() {
          let serverInfo = new ServerInfo({port: '8080', wsPort: '8081'}, ['127.0.0.1', '127.0.0.2']);
          stub(nodeWifi, 'init');
          stub(nodeWifi, 'getCurrentConnections').callsFake(() => Promise.resolve([{iface: 'my-iface'}]));
          stub(os, 'networkInterfaces').callsFake(() => ({
            'my-iface': [
              {family: 'IPv6', address: 'ipv6-address'},
              {family: 'IPv4', address: 'ipv4-address'}
            ]
          }));

          let address = await serverInfo.selectAddressForQRCode();

          expect(address).to.equal('ipv4-address');
        });

        it('returns first IPv4 WiFi interface address when multiple are available', async function() {
          let serverInfo = new ServerInfo({port: '8080', wsPort: '8081'}, ['127.0.0.1', '127.0.0.2']);
          stub(nodeWifi, 'init');
          stub(nodeWifi, 'getCurrentConnections').callsFake(() => Promise.resolve([{iface: 'my-iface'}]));
          stub(os, 'networkInterfaces').callsFake(() => ({
            'my-iface': [
              {family: 'IPv4', address: 'ipv4-address-1'},
              {family: 'IPv4', address: 'ipv4-address-2'},
              {family: 'IPv4', address: 'ipv4-address-3'}
            ]
          }));

          let address = await serverInfo.selectAddressForQRCode();

          expect(address).to.equal('ipv4-address-1');
        });

      });

      describe('on macOS', function() {

        mockPlatform('darwin');

        it('returns first external address and does not use node-wifi', async function() {
          let serverInfo = new ServerInfo({port: '8080', wsPort: '8081'}, ['127.0.0.1', '127.0.0.2']);
          stub(nodeWifi, 'init');
          stub(nodeWifi, 'getCurrentConnections');

          let address = await serverInfo.selectAddressForQRCode();

          expect(nodeWifi.getCurrentConnections).not.to.have.been.called;
          expect(nodeWifi.init).not.to.have.been.called;
          expect(address).to.equal('127.0.0.1');
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
