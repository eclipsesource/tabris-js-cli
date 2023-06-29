const {mkdirsSync, readFileSync, readdirSync, existsSync} = require('fs-extra');
const {join} = require('path');
const https = require('https');
const yazl = require('yazl');
const temp = require('temp');
const {expect, stub, restore, match} = require('./test');
const PlatformProvider = require('../src/services/PlatformProvider');
const log = require('../src/helpers/log');

const name = 'bar';
const version = '2.3';

describe('PlatformProvider', function() {

  let cliDataDir, provider, platformPath;

  this.timeout(20000);

  beforeEach(function() {
    stub(log, 'command');
    stub(console, 'error');
    stub(https, 'get');
    cliDataDir = temp.mkdirSync('cliDataDir');
    platformPath = join(cliDataDir, 'platforms', name, version);
    provider = new PlatformProvider(cliDataDir);
  });

  afterEach(() => {
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

      it('resolves with custom platform spec', async function() {
        const platform = await provider.getPlatform({name, version});
        expect(platform).to.equal('customSpec');
      });

    });

    describe('when platform directory exists', function() {

      beforeEach(function() {
        mkdirsSync(platformPath);
      });

      it('resolves with platform path', async function() {
        const platform = await provider.getPlatform({name, version});
        expect(platform).to.equal(platformPath);
      });

    });

    describe('when platform download is successful', function() {

      beforeEach(function() {
        fakeResponse(200);
      });

      it('downloads and extracts platform', async function() {
        await provider.getPlatform({name, version});
        expect(readFileSync(join(platformPath, 'foo.file'), 'utf8')).to.equal('hello');
      });

      it('resolves with platform spec', async function() {
        const platform = await provider.getPlatform({name, version});
        expect(platform).to.equal(platformPath);
      });

      it('removes temporary files', async function() {
        await provider.getPlatform({name, version});
        const children = readdirSync(join(cliDataDir, 'platforms'));
        expect(children).to.deep.equal([name]);
      });

      it('runs npm install if needed', async function() {
        await provider.getPlatform({name, version});
        expect(existsSync(join(platformPath, 'package.json'))).to.be.true;
      });

    });

    describe('when platform download returns error code', function() {

      beforeEach(function() {
        fakeResponse(418);
      });

      it('fails on unexpected statusCode', async function() {
        try {
          await provider.getPlatform({name, version});
          expectFail();
        } catch(e) {
          expect(e.message).to.equal('Unable to download platform: Unexpected status code 418');
        }
      });

      it('does not create any files', async function() {
        try {
          await provider.getPlatform({name, version});
          expectFail();
        } catch(e) {
          const children = readdirSync(join(cliDataDir, 'platforms'));
          expect(children).to.be.empty;
        }
      });

    });

  });

});

function fakeResponse(statusCode) {
  https.get
    .withArgs({
      host: 'tabrisjs.com',
      path: `/downloads/${version}/platforms/tabris-${name}.zip`,
      headers: {}
    }, match.func)
    .callsArgWith(1, statusCode === 200 ? createPlatformResponseStream(statusCode) : {statusCode, headers: {}})
    .returns({get: https.get, on: stub().returnsThis()});
}

function createPlatformResponseStream(statusCode) {
  const zipFile = new yazl.ZipFile();
  zipFile.addBuffer(Buffer.from('hello'), 'tabris-bar/foo.file');
  zipFile.addBuffer(Buffer.from('{}'), 'tabris-bar/package.json');
  zipFile.end();
  zipFile.outputStream.statusCode = statusCode;
  zipFile.outputStream.headers = {'content-length': 1000};
  return zipFile.outputStream;
}

function expectFail() {
  throw new Error('expected to fail');
}
