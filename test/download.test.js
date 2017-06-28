const {join} = require('path');
const {expect, stub, restore} = require('./test');
const download = require('../src/download');
const {createTmpDir} = require('./tmp');
const https = require('https');
const stream = require('stream');

describe('download', function() {

  let destination, fakeResponse, httpsStub;

  beforeEach(function() {
    httpsStub = {get: stub().returnsThis(), on: stub().returnsThis()};
    stub(https, 'get').returns(httpsStub);
    fakeResponse = {on: stub(), pipe: stub(), statusCode: 200};
    return createTmpDir('platformsDir').then(dir => {
      destination = join(dir, 'filename');
    });
  });

  afterEach(restore);

  describe('downloadFile', function() {

    it('passes options to https.get', function() {
      https.get.callsArgWith(1, fakeResponse);
      let options = stub();
      download.downloadFile(options, destination);
      expect(https.get).to.have.been.calledWith(options);
    });

    it('rejects with error on request error', function() {
      https.get.callsArgWith(1, fakeResponse);
      httpsStub.on.withArgs('error').callsArgWith(1, 'error');
      return download.downloadFile({}, destination).then(() => {
        throw 'Expected rejection';
      }).catch(e => {
        expect(e.message).to.equal('Error downloading file');
      });
    });

    it('rejects with error on response error', function() {
      fakeResponse.on.withArgs('error').callsArgWith(1, 'error');
      https.get.callsArgWith(1, fakeResponse);
      return download.downloadFile({}, destination).then(() => {
        throw 'Expected rejection';
      }).catch(e => {
        expect(e.message).to.equal('Error downloading file');
      });
    });

    it('rejects with error containing status code when status code is unexpected', function() {
      fakeResponse.statusCode = 1234;
      fakeResponse.on.withArgs('error').callsArgWith(1, 'error');
      https.get.callsArgWith(1, fakeResponse);
      return download.downloadFile({}, destination).then(() => {
        throw 'Expected rejection';
      }).catch(e => {
        expect(e.message).to.equal('Unexpected status code 1234');
        expect(e.statusCode).to.equal(1234);
      });
    });

    it('resolves on success', function() {
      fakeResponse = new stream.Readable();
      fakeResponse.push('foo');
      fakeResponse.push(null);
      fakeResponse.statusCode = 200;
      https.get.callsArgWith(1, fakeResponse);
      return download.downloadFile({}, destination).then(result => {
        expect(result).to.be.undefined;
      });
    });

  });

});
