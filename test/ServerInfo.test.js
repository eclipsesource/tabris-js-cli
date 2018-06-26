const {expect, stub} = require('./test');
const ServerInfo = require('../src/services/ServerInfo');

describe('ServerInfo', function() {

  describe('.show()', function() {

    it('prints QR code to console', async function() {
      let serverInfo = new ServerInfo({port: '8080', wsPort: '8081'}, ['127.0.0.1']);

      let message = await new Promise(resolve => {
        serverInfo.show(message => resolve(message));
      });

      expect(message).to.have.string('▄').and.to.have.string('█');
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

    it('returns address of wifi interface', async function() {
      let serverInfo = new ServerInfo({port: '8080', wsPort: '8081'}, ['127.0.0.1', '127.0.0.2']);
      stub(serverInfo, 'getFirstWifiInterface').returns(Promise.resolve({address: '127.0.0.2'}));

      let address = await serverInfo.selectAddressForQRCode();

      expect(serverInfo.getFirstWifiInterface).to.have.been.called;
      expect(address).to.equal('127.0.0.2');
    });

  });

});
