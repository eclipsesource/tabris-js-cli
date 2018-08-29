const {join} = require('path');
const temp = require('temp').track();
const {expect, stub, restore} = require('./test');
const {FileDownloader} = require('../src/helpers/download');
const https = require('https');
const stream = require('stream');
const {existsSync} = require('fs-extra');
const {platform} = require('os');

describe('download', function() {

  let destination, fakeResponse, httpsStub, fileDownloader, dir;

  beforeEach(function() {
    httpsStub = {get: stub().returnsThis(), on: stub().returnsThis()};
    stub(https, 'get').returns(httpsStub);
    fakeResponse = {on: stub(), pipe: stub(), statusCode: 200, headers: {'content-length': 3}};
    dir = temp.mkdirSync('platformsDir');
    destination = join(dir, 'filename');
    fileDownloader = new FileDownloader();
  });

  afterEach(async () => {
    restore();
    try {
      await temp.cleanup();
    } catch(ex) {
      console.warn('Could not delete temporary test folder:');
      console.warn(dir);
      if (platform() === 'win32') {
        console.info('This is a currently unresolvable windows/node issue.');
      }
    }
  });

  describe('downloadFile', function() {

    it('passes options to https.get', function() {
      https.get.callsArgWith(1, fakeResponse);
      let options = stub();
      fileDownloader.downloadFile(options, destination);
      expect(https.get).to.have.been.calledWith(options);
    });

    it('emits "error" on request error', function() {
      https.get.callsArgWith(1, fakeResponse);
      httpsStub.on.withArgs('error').callsArgWith(1, 'error');
      let errorHandler = stub();
      fileDownloader.on('error', errorHandler).downloadFile({}, destination);
      expect(errorHandler).to.have.been.calledWith('error');
    });

    it('emits "error" on response error', function() {
      fakeResponse.on.withArgs('error').callsArgWith(1, 'error');
      https.get.callsArgWith(1, fakeResponse);
      let errorHandler = stub();
      fileDownloader.on('error', errorHandler).downloadFile({}, destination);
      expect(errorHandler).to.have.been.calledWith('error');
    });

    it('emits "error" containing status code when status code is unexpected', function() {
      fakeResponse.statusCode = 1234;
      fakeResponse.on.withArgs('error').callsArgWith(1, 'error');
      https.get.callsArgWith(1, fakeResponse);
      let errorHandler = stub();
      fileDownloader.on('error', errorHandler).downloadFile({}, destination);
      expect(errorHandler).to.have.been.calledWithMatch({message: 'Unexpected status code 1234', statusCode: 1234});
    });

    it('emits "done" on success', function(done) {
      fakeResponse = new stream.Readable();
      fakeResponse.push('foo');
      fakeResponse.push(null);
      fakeResponse.statusCode = 200;
      fakeResponse.headers = {'content-length': 3};
      https.get.callsArgWith(1, fakeResponse);
      fileDownloader
        .on('done', done)
        .on('error', error => done(error))
        .downloadFile({}, destination);
    });

    it('writes files on success', function(done) {
      fakeResponse = new stream.Readable();
      fakeResponse.push('foo');
      fakeResponse.push(null);
      fakeResponse.statusCode = 200;
      fakeResponse.headers = {'content-length': 3};
      https.get.callsArgWith(1, fakeResponse);
      fileDownloader
        .on('done', () => {
          expect(existsSync(destination)).to.be.true;
          done();
        })
        .on('error', error => done(error))
        .downloadFile({}, destination);
    });

    it('emits "progress" with progress in bytes', function(done) {
      fakeResponse = new stream.Readable();
      fakeResponse.push('foo');
      fakeResponse.push('bar');
      fakeResponse.push(null);
      fakeResponse.statusCode = 200;
      fakeResponse.headers = {'content-length': 6};
      https.get.callsArgWith(1, fakeResponse);
      let progressHandler = stub();
      fileDownloader
        .on('done', () => {
          expect(progressHandler).to.have.been.calledTwice;
          expect(progressHandler).to.have.been.calledWith({current: 3, total: 6});
          expect(progressHandler).to.have.been.calledWith({current: 6, total: 6});
          done();
        })
        .on('progress', progressHandler)
        .on('error', error => done(error))
        .downloadFile({}, destination);
    });

    it('emits "error" event when the response stream emits an error', function(done) {
      fakeResponse = new stream.Readable({
        read() {
          process.nextTick(() => this.emit('error', 'foo'));
        }
      });
      fakeResponse.statusCode = 200;
      fakeResponse.headers = {'content-length': 6};
      https.get.callsArgWith(1, fakeResponse);
      fileDownloader
        .on('error', error => {
          expect(error).to.equal('foo');
          done();
        })
        .downloadFile({}, destination);
    });

    it('removes file when the response stream emits an error', function(done) {
      fakeResponse = new stream.Readable({
        read() {
          process.nextTick(() => this.emit('error', 'foo'));
        }
      });
      fakeResponse.statusCode = 200;
      fakeResponse.headers = {'content-length': 6};
      https.get.callsArgWith(1, fakeResponse);
      fileDownloader
        .on('error', () => {
          expect(existsSync(destination)).to.be.false;
          done();
        })
        .downloadFile({}, destination);
    });

  });

});
