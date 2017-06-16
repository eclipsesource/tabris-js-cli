const {existsSync, readFileSync} = require('fs-extra');
const fs = require('fs-extra');
const proc = require('./proc');
const {join} = require('path');

class CordovaCli {

  constructor(cwd) {
    this._cwd = cwd;
  }

  platformAddSafe(platform, spec, {options = []} = {}) {
    let opts = options.filter(truthy).map(option => '--' + option);
    let args = ['platform', 'add', spec, ...opts].filter(truthy);
    if (this._platformDeclared(platform)) {
      return;
    }
    if (this._platformDirectoryExists(platform)) {
      fs.removeSync(join(this._cwd, 'platforms', platform));
    }
    proc.exec('cordova', args, {cwd: `${this._cwd}`});
    return this;
  }

  platformCommand(command, platform, {options = [], platformOpts = []} = {}) {
    let opts = options.filter(truthy).map(option => '--' + option);
    let parameters = platformOpts.length && ['--', ...platformOpts] || [];
    proc.exec('cordova', [command, platform, ...opts, ...parameters].filter(truthy), {cwd: this._cwd});
    return this;
  }

  _platformDirectoryExists(platform) {
    let platformDirectory = join(this._cwd, 'platforms', platform);
    return existsSync(platformDirectory);
  }

  _platformDeclared(name) {
    let platformsJsonPath = join(this._cwd, 'platforms', 'platforms.json');
    if (!existsSync(platformsJsonPath)) {
      return false;
    }
    let platforms = JSON.parse(readFileSync(platformsJsonPath, 'utf8'));
    return !!platforms[name];
  }

}

function truthy(value) {
  return !!value;
}

module.exports = CordovaCli;
