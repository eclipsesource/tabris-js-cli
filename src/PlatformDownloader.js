const fs = require('fs-extra');
const {join} = require('path');
const log = require('./log');
const zip = require('./zip');
const download = require('./download');

const PATH = '/api/v1/downloads/cli';
const HOST = 'tabrisjs.com';

module.exports = class PlatformDownloader {

  constructor({version, platform, buildKey}) {
    this._version = version;
    this._platform = platform;
    this._buildKey = buildKey;
  }

  download(platformsDir) {
    let zipPath = join(platformsDir, `.download-${this._platform}-${this._version}.zip`);
    let extractedZipPath = join(platformsDir, `.extracted-${this._platform}-${this._version}`);
    let destination = join(platformsDir, this._platform, this._version);
    if (fs.existsSync(destination)) {
      return Promise.resolve(destination);
    }
    log.command(`Downloading ${this._platform} platform version ${this._version}...`);
    fs.mkdirsSync(platformsDir);
    return this._downloadPlatformZip(zipPath)
      .then(() => this._unzipPlatform(zipPath, extractedZipPath))
      .then(() => fs.moveSync(join(extractedZipPath, `tabris-${this._platform}`), destination))
      .then(() => {
        fs.removeSync(extractedZipPath);
        fs.removeSync(zipPath);
      })
      .then(() => destination)
      .catch((e) => {
        fs.removeSync(destination);
        return Promise.reject(e);
      });
  }

  _downloadPlatformZip(platformZipPath) {
    let options = {
      host: HOST,
      path: `${PATH}/${this._version}/${this._platform}`,
      headers: {'X-Tabris-Access-Key': this._buildKey}
    };
    return download.downloadFile(options, platformZipPath).catch(e => {
      if (e.statusCode === 401) {
        throw new Error('Invalid build key.');
      }
      throw new Error('Unable to download platform');
    });
  }

  _unzipPlatform(zipPath, destination) {
    log.command('Extracting platform...');
    return zip.unzip(zipPath, destination);
  }

};
