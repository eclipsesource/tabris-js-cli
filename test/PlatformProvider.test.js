const {mkdirsSync, existsSync, readFileSync} = require('fs-extra');
const {join} = require('path');
const https = require('https');
const yazl = require('yazl');
const temp = require('temp').track();
const {expect, stub, restore, match} = require('./test');
const PlatformProvider = require('../src/PlatformProvider');
const log = require('../src/log');

describe('PlatformProvider', function() {

  let cliDataDir, provider;

  beforeEach(function() {
    stub(log, 'command');
    stub(console, 'error');
    stub(https, 'get');
    process.env.TABRIS_BUILD_KEY = 'key';
    cliDataDir = temp.mkdirSync('cliDataDir');
    provider = new PlatformProvider(cliDataDir);
  });

  afterEach(() => {
    delete process.env.TABRIS_BUILD_KEY;
    restore();
  });

  describe('getPlatform', function() {

    describe('when TABRIS_<platform>_PLATFORM is set', function() {

      beforeEach(function() {
        process.env.TABRIS_BAR_PLATFORM = 'barSpec';
      });

      afterEach(function() {
        delete process.env.TABRIS_BAR_PLATFORM;
      });

      it('resolves with platform spec', function() {
        return provider.getPlatform({version: 'foo', platform: 'bar'}).then(platform => {
          expect(platform).to.equal('barSpec');
        });
      });

    });

    describe('when TABRIS_<platform>_PLATFORM is not set', function() {

      beforeEach(function() {
        provider = new PlatformProvider(cliDataDir);
      });

      it('resolves with platform spec when platform exists at location', function() {
        let platformPath = join(cliDataDir, 'platforms', 'bar', 'foo');
        mkdirsSync(platformPath);
        return provider.getPlatform({version: 'foo', platform: 'bar'}).then(platform => {
          expect(platform).to.equal(platformPath);
        });
      });

      it('downloads and extracts platform', function() {
        fakeResponse(200);
        return provider.getPlatform({version: 'foo', platform: 'bar'}).then(() => {
          let platformPath = join(cliDataDir, 'platforms', 'bar', 'foo');

          expect(readFileSync(join(platformPath, 'foo.file'), 'utf8')).to.equal('hello');
        });
      });

      it('resolves with platform spec', function() {
        fakeResponse(200);
        return provider.getPlatform({version: 'foo', platform: 'bar'}).then(platform => {
          let platformPath = join(cliDataDir, 'platforms', 'bar', 'foo');

          expect(platform).to.equal(platformPath);
        });
      });

      it('prompts build key again when statusCode is 401', function() {
        let promptBuildKey = stub(provider._buildKeyProvider, 'promptBuildKey');
        promptBuildKey
          .callsFake(() => {
            fakeResponse(200);
            return Promise.resolve('key');
          });
        fakeResponse(401);
        return provider.getPlatform({version: 'foo', platform: 'bar'})
          .then(() => {
            let platformPath = join(cliDataDir, 'platforms', 'bar', 'foo');
            expect(readFileSync(join(platformPath, 'foo.file'), 'utf8')).to.equal('hello');
          });
      });

      it('prompts build key more than one time when statusCode is 401', function() {
        let promptBuildKey = stub(provider._buildKeyProvider, 'promptBuildKey');
        promptBuildKey
          .onCall(0).returns(Promise.resolve('key'))
          .onCall(1).callsFake(() => {
            fakeResponse(200);
            return Promise.resolve('key');
          });
        fakeResponse(401);
        return provider.getPlatform({version: 'foo', platform: 'bar'})
          .then(() => {
            let platformPath = join(cliDataDir, 'platforms', 'bar', 'foo');
            expect(readFileSync(join(platformPath, 'foo.file'), 'utf8')).to.equal('hello');
          });
      });

      it('fails on unexpected statusCode', function() {
        fakeResponse(1337);
        return provider.getPlatform({version: 'foo', platform: 'bar'})
          .then(() => {
            throw 'Expected rejection';
          })
          .catch((e) => {
            expect(e.message).to.equal('Unable to download platform: Unexpected status code 1337');
          });
      });

      it('removes temporal files', function() {
        fakeResponse(200);
        return provider.getPlatform({version: 'foo', platform: 'bar'}).then(() => {
          expect(existsSync(join(cliDataDir, 'platforms', '.extracted-bar-foo'))).to.be.false;
          expect(existsSync(join(cliDataDir, 'platforms', '.download-bar-foo.zip'))).to.be.false;
        });
      });

    });

  });

});

function fakeResponse(statusCode) {
  https.get
    .withArgs({
      host: 'tabrisjs.com',
      path: '/api/v1/downloads/cli/foo/bar',
      headers: {'X-Tabris-Build-Key': 'key'}
    }, match.func)
    .callsArgWith(1, statusCode === 200 ? createPlatformResponseStream(statusCode) : {statusCode, headers: {}})
    .returns({get: https.get, on: stub().returnsThis()});
}

function createPlatformResponseStream(statusCode) {
  let zipFile = new yazl.ZipFile();
  zipFile.addBuffer(Buffer.from('hello'), 'tabris-bar/foo.file');
  zipFile.end();
  zipFile.outputStream.statusCode = statusCode;
  zipFile.outputStream.headers = {'content-length': 1000};
  return zipFile.outputStream;
}
