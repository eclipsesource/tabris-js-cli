const {join} = require('path');
const {existsSync, copySync, readdirSync, statSync, removeSync} = require('fs-extra');

module.exports = class PlatformsCache {

  constructor(cliDataDir) {
    this._cachePath = join(cliDataDir, 'platforms');
  }

  set(platform, path) {
    let cachePath = join(this._cachePath, platform.name, platform.version);
    try {
      copySync(path, cachePath);
    } catch(e) {
      throw new Error('Could not copy platform to ' + cachePath + '. Error: ' + (e.message || e));
    }
  }

  get(platform) {
    let platformPath = join(this._cachePath, platform.name, platform.version);
    if (existsSync(platformPath)) {
      return platformPath;
    }
    return null;
  }

  has(platform) {
    return !!this.get(platform);
  }

  prune() {
    this._cleanUpNightlies();
  }

  _cleanUpNightlies() {
    let nightlies = this._getPlatformNightlies();
    Object.keys(nightlies).forEach(platform => {
      let [, ...tail] = nightlies[platform].sort().reverse();
      tail.forEach(version => removeSync(join(this._cachePath, platform, version)));
    });
  }

  _getPlatformNightlies() {
    let nightlies = {};
    listDirectories(this._cachePath).forEach(platform => {
      listDirectories(join(this._cachePath, platform)).forEach(version => {
        if (isNightly(version)) {
          nightlies[platform] = nightlies[platform] || [];
          nightlies[platform].push(version);
        }
      });
    });
    return nightlies;
  }

};

function isNightly(version) {
  return /dev.(.*)/.test(version);
}

function listDirectories(path) {
  return readdirSync(path).filter(file => statSync(join(path, file)).isDirectory());
}
