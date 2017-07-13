const {copySync, statSync, readFileSync, existsSync} = require('fs-extra');
const {relative, join} = require('path');
const ignore = require('ignore');
const log = require('./log');
const proc = require('./proc');
const semver = require('semver');

class TabrisApp {

  constructor(path) {
    this._path = path;
    if (!existsSync(`${path}/package.json`)) {
      throw 'Could not find package.json';
    }
    if (!existsSync(`${path}/cordova`)) {
      throw 'Could not find cordova directory';
    }
  }

  get installedTabrisVersion() {
    return this._installedTabrisVersion;
  }

  runPackageJsonBuildScripts(platform) {
    proc.exec('npm', ['run', '--if-present', `build:${platform}`]);
    proc.exec('npm', ['run', '--if-present', 'build']);
    return this;
  }

  createCordovaProject(destination) {
    this._copyCordovaFiles(destination);
    this._copyJsFiles(destination);
    this._installProductionDependencies(destination);
    this._installedTabrisVersion = this._getTabrisVersion(destination);
    return this;
  }

  validateInstalledTabrisVersion(range) {
    if (!semver.satisfies(this.installedTabrisVersion, range)) {
      let message =
        `App uses incompatible Tabris.js version ${this.installedTabrisVersion}, ${range} required.\n` +
        (semver.gtr(this.installedTabrisVersion, range) ?
          'Make sure Tabris.js CLI is up to date.' :
          `Please migrate your app to tabris ${range}.`);
      throw new Error(message);
    }
    return this;
  }

  _copyCordovaFiles(destination) {
    log.command(`Copying Cordova files to ${destination} ...`);
    copySync(`${this._path}/cordova`, destination);
  }

  _copyJsFiles(destination) {
    log.command(`Copying JavaScript files to ${destination}/www/app/ ...`);
    let tabrisignorePath = join(this._path, '.tabrisignore');
    let ig = ignore().add(['.git/', 'node_modules/', 'cordova/', relative(this._path, destination), '.tabrisignore']);
    if (existsSync(tabrisignorePath)) {
      ig.add(readFileSync(tabrisignorePath).toString());
    }
    copySync(this._path, join(destination, 'www/app'), {
      filter: (path) => {
        let stats = statSafe(path);
        let dirPath = stats && stats.isDirectory() && !path.endsWith('/') ? path + '/' : path;
        return !ig.ignores(dirPath);
      }
    });
  }

  _installProductionDependencies(destination) {
    proc.exec('npm', ['install', '--production'], {cwd: join(destination, 'www/app')});
  }

  _getTabrisVersion(cordovaProjectPath) {
    let tabrisPackageJsonPath = join(cordovaProjectPath, 'www', 'app', 'node_modules', 'tabris', 'package.json');
    let tabrisPackageJson = JSON.parse(readFileSync(tabrisPackageJsonPath, 'utf8'));
    return tabrisPackageJson.version;
  }

}

function statSafe(file) {
  try {
    return statSync(file);
  } catch (e) {
    return null;
  }
}

module.exports = TabrisApp;
