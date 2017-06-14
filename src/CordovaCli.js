const {existsSync, readFileSync} = require('fs-extra');
const proc = require('./proc');

class CordovaCli {

  constructor(cwd) {
    this._cwd = cwd;
  }

  platformAddSafe(name, spec, {options = []} = {}) {
    let platformsJsonPath = `${this._cwd}/platforms/platforms.json`;
    let opts = options.filter(truthy).map(option => '--' + option);
    let args = ['platform', 'add', spec, ...opts].filter(truthy);
    if (!existsSync(platformsJsonPath)) {
      proc.exec('cordova', args, {cwd: `${this._cwd}`});
      return this;
    }
    let platforms = JSON.parse(readFileSync(platformsJsonPath, 'utf8'));
    if (!platforms[name]) {
      proc.exec('cordova', args, {cwd: `${this._cwd}`});
    }
    return this;
  }

  platformCommand(command, platform, {options = [], platformOpts = []} = {}) {
    let opts = options.filter(truthy).map(option => '--' + option);
    let parameters = platformOpts.length && ['--', ...platformOpts] || [];
    proc.exec('cordova', [command, platform, ...opts, ...parameters].filter(truthy), {cwd: this._cwd});
    return this;
  }

}

function truthy(value) {
  return !!value;
}

module.exports = CordovaCli;
