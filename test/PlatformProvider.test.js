const {mkdirsSync, readdirSync, readFileSync} = require('fs-extra');
const {join} = require('path');
const https = require('https');
const yazl = require('yazl');
const temp = require('temp').track();
const {expect, stub, restore, match} = require('./test');
const PlatformProvider = require('../src/services/PlatformProvider');
const log = require('../src/helpers/log');

const name = 'bar';
const version = '2.3';

describe('PlatformProvider', function() {

  let cliDataDir, provider, platformPath;

  beforeEach(function() {
    stub(log, 'command');
    stub(console, 'error');
    stub(https, 'get');
    process.env.TABRIS_BUILD_KEY = 'key';
    cliDataDir = temp.mkdirSync('cliDataDir');
    platformPath = join(cliDataDir, 'platforms', name, version);
    provider = new PlatformProvider(cliDataDir);
  });

  afterEach(() => {
    delete process.env.TABRIS_BUILD_KEY;
    restore();
  });

  describe('getPlatform', function() {

    describe('when TABRIS_XXX_PLATFORM is set', function() {

      beforeEach(function() {
        process.env.TABRIS_BAR_PLATFORM = 'customSpec';
      });

      afterEach(function() {
        delete process.env.TABRIS_BAR_PLATFORM;
      });

      it('resolves with custom platform spec', function() {
        return provider.getPlatform({name, version}).then(platform => {
          expect(platform).to.equal('customSpec');
        });
      });

    });

    describe('when platform directory exists', function() {

      beforeEach(function() {
        mkdirsSync(platformPath);
      });

      it('resolves with platform path', function() {
        return provider.getPlatform({name, version}).then(platform => {
          expect(platform).to.equal(platformPath);
        });
      });

    });

    describe('when platform download is successful', function() {

      beforeEach(function() {
        fakeResponse(200);
      });

      it('downloads and extracts platform', function() {
        return provider.getPlatform({name, version}).then(() => {
          expect(readFileSync(join(platformPath, 'foo.file'), 'utf8')).to.equal('hello');
        });
      });

      it('resolves with platform spec', function() {
        return provider.getPlatform({name, version}).then(platform => {
          expect(platform).to.equal(platformPath);
        });
      });

      it('removes temporary files', function() {
        return provider.getPlatform({name, version}).then(() => {
          let children = readdirSync(join(cliDataDir, 'platforms'));
          expect(children).to.deep.equal([name]);
        });
      });

    });

    describe('when platform download returns error code', function() {

      beforeEach(function() {
        fakeResponse(418);
      });

      it('fails on unexpected statusCode', function() {
        return provider.getPlatform({name, version}).then(expectFail, (err) => {
          expect(err.message).to.equal('Unable to download platform: Unexpected status code 418');
        });
      });

      it('does not create any files', function() {
        return provider.getPlatform({name, version}).then(expectFail, () => {
          let children = readdirSync(join(cliDataDir, 'platforms'));
          expect(children).to.be.empty;
        });
      });

    });

    describe('when platform download rejects build key', function() {

      beforeEach(function() {
        fakeResponse(401);
      });

      it('prompts build key again', function() {
        stub(provider._buildKeyProvider, 'promptBuildKey').callsFake(() => {
          fakeResponse(200);
          return Promise.resolve('key');
        });
        return provider.getPlatform({name, version}).then(() => {
          expect(readFileSync(join(platformPath, 'foo.file'), 'utf8')).to.equal('hello');
        });
      });

      it('prompts build key again more than once', function() {
        stub(provider._buildKeyProvider, 'promptBuildKey')
          .onCall(0).returns(Promise.resolve('key'))
          .onCall(1).callsFake(() => {
            fakeResponse(200);
            return Promise.resolve('key');
          });
        return provider.getPlatform({name, version}).then(() => {
          expect(readFileSync(join(platformPath, 'foo.file'), 'utf8')).to.equal('hello');
        });
      });

    });

  });

});

function fakeResponse(statusCode) {
  https.get
    .withArgs({
      host: 'tabrisjs.com',
      path: `/api/v1/downloads/cli/${version}/${name}`,
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

function expectFail() {
  throw new Error('expected to fail');
}
