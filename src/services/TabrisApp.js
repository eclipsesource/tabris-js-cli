const {copySync, statSync, readFileSync, readJsonSync, existsSync, removeSync} = require('fs-extra');
const {relative, join, sep} = require('path');
const ignore = require('ignore');
const semver = require('semver');
const log = require('../helpers/log');
const proc = require('../helpers/proc');

const DEFAULT_IGNORES = [
  '.git/',
  '.tabrisignore',
  '/node_modules/',
  '/build/',
  '/cordova/'
];

class TabrisApp {

  constructor(path) {
    this._path = path;
    if (!existsSync(join(path, 'package.json'))) {
      throw 'Could not find package.json';
    }
    if (!readJsonSync(join(path, 'package.json')).main) {
      throw 'package.json must contain a "main" field';
    }
    if (!existsSync(join(path, 'cordova'))) {
      throw 'Could not find cordova directory';
    }
  }

  get installedTabrisVersion() {
    return this._installedTabrisVersion;
  }

  runPackageJsonBuildScripts(platform) {
    proc.spawnSync('npm', ['run', '--if-present', `build:${platform}`]);
    proc.spawnSync('npm', ['run', '--if-present', 'build']);
    return this;
  }

  createCordovaProject(destination) {
    this._copyCordovaFiles(destination);
    this._copyJsFiles(destination);
    this._installProductionDependencies(destination);
    this._installedTabrisVersion = this._getTabrisVersion(destination);
    return this;
  }

  validateInstalledTabrisVersion() {
    if (!semver.valid(this.installedTabrisVersion)) {
      throw Error('App uses invalid tabris version: ' + this.installedTabrisVersion);
    }
    if (semver.major(this.installedTabrisVersion) < 2) {
      throw new Error(`App uses incompatible tabris version: ${this.installedTabrisVersion}, >= 2.0.0 required.\n`);
    }
    return this;
  }

  _copyCordovaFiles(destination) {
    log.command(`Copying Cordova files to ${destination} ...`);
    const excludedPaths = ['www', 'platform', 'plugins']
      .map(subdir => join(this._path, 'cordova', subdir));
    copySync(join(this._path, 'cordova'), destination, {
      filter: path => !excludedPaths.includes(path)
    });
  }

  _copyJsFiles(destination) {
    const appDir = join(destination, 'www', 'app');
    if (existsSync(appDir)) {
      log.command(`Removing old JavaScript files in ${appDir} ...`);
      removeSync(appDir);
    }
    log.command(`Copying JavaScript files to ${appDir} ...`);
    const tabrisignorePath = join(this._path, '.tabrisignore');
    const ig = ignore().add([relative(this._path, destination), ...DEFAULT_IGNORES]);
    if (existsSync(tabrisignorePath)) {
      ig.add(readFileSync(tabrisignorePath).toString());
    }
    copySync(this._path, appDir, {
      filter: (filePath) => {
        const stats = statSafe(filePath);
        let appRelativeFilePath = relative(this._path, filePath);
        appRelativeFilePath += stats && stats.isDirectory() && !appRelativeFilePath.endsWith(sep) ? sep : '';
        return !ig.ignores(appRelativeFilePath);
      }
    });
  }

  _installProductionDependencies(destination) {
    if (existsSync(join(destination, 'www', 'app', 'package-lock.json'))) {
      proc.spawnSync('npm', ['ci', '--production'], {cwd: join(destination, 'www', 'app')});
    } else {
      proc.spawnSync('npm', ['install', '--production'], {cwd: join(destination, 'www', 'app')});
    }
  }

  _getTabrisVersion(cordovaProjectPath) {
    const tabrisPackageJsonPath = join(cordovaProjectPath, 'www', 'app', 'node_modules', 'tabris', 'package.json');
    const tabrisPackageJson = JSON.parse(readFileSync(tabrisPackageJsonPath, 'utf8'));
    return tabrisPackageJson.version.replace(/\+.*$/, '');
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
