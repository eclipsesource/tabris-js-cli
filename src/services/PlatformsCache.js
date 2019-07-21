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
      if (isNightly(platform.version)) {
        this._removeOtherNightlies(platform);
      }
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

  _removeOtherNightlies(platform) {
    listDirectories(join(this._cachePath, platform.name))
      .filter(isNightly)
      .filter(version => version !== platform.version)
      .forEach(version => removeSync(join(this._cachePath, platform.name, version)));
  }

};

function isNightly(version) {
  return /dev.(.*)/.test(version);
}

function listDirectories(path) {
  return readdirSync(path).filter(file => statSync(join(path, file)).isDirectory());
}
