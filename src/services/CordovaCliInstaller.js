const {mkdirsSync, existsSync} = require('fs-extra');
const proc = require('../helpers/proc');
const {sep} = require('path');

module.exports = class CordovaCliInstaller {

  constructor(cliDataDir) {
    this._cliDataDir = cliDataDir;
  }

  install(version) {
    let cordovaDir = `${this._cliDataDir}${sep}cordova${sep}${version}`;
    let installedCordovaPath = `${cordovaDir}${sep}node_modules${sep}.bin${sep}cordova`;
    if (existsSync(installedCordovaPath)) {
      return installedCordovaPath;
    }
    mkdirsSync(`${this._cliDataDir}${sep}cordova${sep}${version}`);
    let {status} = proc.execSync('npm', ['install', `cordova@${version}`], {cwd: cordovaDir});
    if (status !== 0) {
      throw new Error('Error installing Cordova CLI.');
    }
    return installedCordovaPath;
  }

};
