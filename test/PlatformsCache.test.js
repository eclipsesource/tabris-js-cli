const {join} = require('path');
const {writeJsonSync, mkdirsSync, readJsonSync, existsSync} = require('fs-extra');
const temp = require('temp');
const {expect, restore} = require('./test');
const PlatformsCache = require('../src/services/PlatformsCache');

describe('PlatformsCache', function() {

  let cache, cliDataDir;

  beforeEach(function() {
    process.env.TABRIS_BUILD_KEY = 'key';
    cliDataDir = temp.mkdirSync('cliDataDir');
    cache = new PlatformsCache(cliDataDir);
  });

  afterEach(restore);

  describe('get', function() {

    it('returns platform path when platform in cache', function() {
      let platformPath = join(cliDataDir, 'platforms', 'foo', 'bar');
      mkdirsSync(platformPath);

      expect(cache.get({name: 'foo', version: 'bar'})).to.equal(platformPath);
    });

    it('returns null when platform not in cache', function() {
      expect(cache.get({name: 'foo', version: 'bar'})).to.be.null;
    });

  });

  describe('has', function() {

    it('returns true when platform in cache', function() {
      mkdirsSync(join(cliDataDir, 'platforms', 'foo', 'bar'));

      expect(cache.has({name: 'foo', version: 'bar'})).to.be.true;
    });

    it('returns false when platform not in cache', function() {
      expect(cache.has({name: 'foo', version: 'bar'})).to.be.false;
    });

  });

  describe('set', function() {

    it('copies given path to cache', function() {
      let file = temp.openSync().path;

      cache.set({name: 'foo', version: 'bar'}, file);

      return expect(existsSync(join(cliDataDir, 'platforms', 'foo', 'bar'))).to.be.true;
    });

    it('overwrites platform if existing', function() {
      let newPlatformPath = temp.openSync().path;
      mkdirsSync(join(cliDataDir, 'platforms', 'foo'));
      let existingPlatformPath = join(cliDataDir, 'platforms', 'foo', 'bar');
      writeJsonSync(existingPlatformPath, 'existingPlatform');
      writeJsonSync(newPlatformPath, 'newPlatform');

      cache.set({name: 'foo', version: 'bar'}, newPlatformPath);

      return expect(readJsonSync(join(cliDataDir, 'platforms', 'foo', 'bar'))).to.equal('newPlatform');
    });

  });

  describe('prune', function() {

    it('removes nightlies older than latest one', function() {
      let nightly1 = join(cliDataDir, 'platforms', 'foo', '0.0.0-dev.20000119');
      let nightly2 = join(cliDataDir, 'platforms', 'foo', '0.0.0-dev.20000120');
      mkdirsSync(nightly1);
      mkdirsSync(nightly2);

      cache.prune();

      expect(existsSync(nightly2)).to.be.true;
      expect(existsSync(nightly1)).to.be.false;
    });

    it('keeps latest nightly per platform', function() {
      let nightly1 = join(cliDataDir, 'platforms', 'foo', '0.0.0-dev.20000118');
      let nightly2 = join(cliDataDir, 'platforms', 'foo', '0.0.0-dev.20000120');
      let nightly3 = join(cliDataDir, 'platforms', 'bar', '0.0.0-dev.20000119');
      mkdirsSync(nightly1);
      mkdirsSync(nightly2);
      mkdirsSync(nightly3);

      cache.prune();

      expect(existsSync(nightly1)).to.be.false;
      expect(existsSync(nightly2)).to.be.true;
      expect(existsSync(nightly3)).to.be.true;
    });

    it('does not remove non-dev platforms', function() {
      let nightly1 = join(cliDataDir, 'platforms', 'foo', '0.0.0-aaa.20000118');
      let nightly2 = join(cliDataDir, 'platforms', 'foo', '0.0.0-dev.20000120');
      mkdirsSync(nightly1);
      mkdirsSync(nightly2);

      cache.prune();

      expect(existsSync(nightly1)).to.be.true;
    });

  });

});
