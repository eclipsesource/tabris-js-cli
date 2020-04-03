const {mkdirsSync, existsSync, writeJsonSync} = require('fs-extra');
const proc = require('../helpers/proc');
const {sep} = require('path');
const packageJson = require('../../package.json');

module.exports = class CordovaCliInstaller {

  constructor(cliDataDir) {
    this._cliDataDir = cliDataDir;
  }

  install(version) {
    const cordovaDir = `${this._cliDataDir}${sep}cordova${sep}${version}`;
    const installedCordovaPath = `${cordovaDir}${sep}node_modules${sep}.bin${sep}cordova`;
    if (existsSync(installedCordovaPath)) {
      return installedCordovaPath;
    }
    mkdirsSync(`${this._cliDataDir}${sep}cordova${sep}${version}`);
    writeJsonSync(`${this._cliDataDir}${sep}cordova${sep}${version}${sep}package.json`, {
      name: `tabris-cli-cordova-${version}-cache`,
      version: packageJson.version
    });
    const {status} = proc.spawnSync('npm', ['install', `cordova@${version}`], {cwd: cordovaDir});
    if (status !== 0) {
      throw new Error('Error installing Cordova CLI.');
    }
    return installedCordovaPath;
  }

};
