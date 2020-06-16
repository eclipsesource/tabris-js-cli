const {join} = require('path');
const fs = require('fs-extra');
const {existsSync, readFileSync} = require('fs-extra');
const proc = require('../helpers/proc');

class CordovaCli {

  constructor(cwd, cordovaPath) {
    this._cwd = cwd;
    this._cordovaPath = cordovaPath;
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

  platformCommand(command, platform, {options = [], cordovaPlatformOpts = []} = {}) {
    this._execCordova([command, platform], options, cordovaPlatformOpts);
    return this;
  }

  _platformDirectoryExists(platform) {
    const platformDirectory = join(this._cwd, 'platforms', platform);
    return existsSync(platformDirectory);
  }

  _platformDeclared(name) {
    return this._platformDeclaredInPlatformsJson(name) || this._platformDeclaredInPackageJson(name);
  }

  _platformDeclaredInPlatformsJson(name) {
    const platformsJsonPath = join(this._cwd, 'platforms', 'platforms.json');
    if (!existsSync(platformsJsonPath)) {
      return false;
    }
    const platforms = JSON.parse(readFileSync(platformsJsonPath, 'utf8'));
    return !!platforms[name];
  }

  _platformDeclaredInPackageJson(name) {
    const packageJsonPath = join(this._cwd, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return false;
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson &&
      packageJson.cordova &&
      packageJson.cordova.platforms &&
      packageJson.cordova.platforms instanceof Array &&
      packageJson.cordova.platforms.includes(name);
  }

  _execCordova(args, opts = [], platformOpts = []) {
    const nonOptionArgs = platformOpts.length ? ['--', ...platformOpts] : [];
    const options = opts.filter(truthy).map(opt => `--${opt}`);
    proc.spawnSync(this._cordovaPath,
      [...args, ...options, '--no-update-notifier', ...nonOptionArgs], {cwd: this._cwd});
  }

}

function truthy(value) {
  return !!value;
}

module.exports = CordovaCli;
