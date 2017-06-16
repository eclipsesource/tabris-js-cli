const {join} = require('path');
const fs = require('fs-extra');
const {existsSync, readFileSync} = require('fs-extra');
const proc = require('./proc');

class CordovaCli {

  constructor(cwd) {
    this._cwd = cwd;
    this._resolveCordovaPath();
  }

  _resolveCordovaPath() {
    let binPath = proc.exec('npm', ['bin'], {cwd: __dirname, stdio: 'pipe'});
    let dir = binPath.stdout.toString().trim();
    this._cordova = join(dir, 'cordova');
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
    proc.exec(this._cordova, args, {cwd: `${this._cwd}`});
    return this;
  }

  platformCommand(command, platform, {options = [], platformOpts = []} = {}) {
    let opts = options.filter(truthy).map(option => '--' + option);
    let parameters = platformOpts.length && ['--', ...platformOpts] || [];
    proc.exec(this._cordova, [command, platform, ...opts, ...parameters].filter(truthy), {cwd: this._cwd});
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
