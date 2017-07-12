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
    this._cordovaPath = join(dir, 'cordova');
  }

  platformAddSafe(platform, spec, {options = []} = {}) {
    if (this._platformDeclared(platform)) {
      return this;
    }
    if (this._platformDirectoryExists(platform)) {
      fs.removeSync(join(this._cwd, 'platforms', platform));
    }
    this._execCordova(['platform', 'add', spec], options);
    return this;
  }

  platformCommand(command, platform, {options = []} = {}) {
    this._execCordova([command, platform], options);
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

  _execCordova(args, opts = []) {
    let options = opts.filter(truthy).map(opt => `--${opt}`);
    proc.exec(this._cordovaPath, [...args, ...options, '--no-update-notifier'], {cwd: this._cwd});
  }

}

function truthy(value) {
  return !!value;
}

module.exports = CordovaCli;
