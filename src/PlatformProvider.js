const fs = require('fs-extra');
const {join} = require('path');
const log = require('./log');
const os = require('os');
const zip = require('./zip');
const {FileDownloader} = require('./download');
const BuildKeyProvider = require('./BuildKeyProvider');
const progress = require('cli-progress');

const PATH = '/api/v1/downloads/cli';
const HOST = 'tabrisjs.com';

module.exports = class PlatformProvider {

  constructor() {
    this._cliDataDir = join(os.homedir(), '.tabris-cli');
    this._platformsDir = join(this._cliDataDir, 'platforms');
    this._buildKeyProvider = new BuildKeyProvider(this._cliDataDir);
  }

  getPlatform({version, platform}) {
    let zipPath = join(this._platformsDir, `.download-${platform}-${version}.zip`);
    let extractedZipPath = join(this._platformsDir, `.extracted-${platform}-${version}`);
    let platformSpec = join(this._platformsDir, platform, version);
    let envVarPlatformSpec = process.env[`TABRIS_${platform.toUpperCase()}_PLATFORM`];
    if (envVarPlatformSpec) {
      return Promise.resolve(envVarPlatformSpec);
    }
    if (fs.existsSync(platformSpec)) {
      return Promise.resolve(platformSpec);
    }
    return this._buildKeyProvider.getBuildKey()
      .then((buildKey) => {
        fs.mkdirsSync(this._platformsDir);
        return this._downloadPlatformZip(zipPath, buildKey, platform, version);
      })
      .then(() => this._unzipPlatform(zipPath, extractedZipPath))
      .then(() => fs.moveSync(join(extractedZipPath, `tabris-${platform}`), platformSpec))
      .then(() => {
        fs.removeSync(extractedZipPath);
        fs.removeSync(zipPath);
      })
      .then(() => platformSpec)
      .catch((e) => {
        fs.removeSync(platformSpec);
        return Promise.reject(e);
      });
  }

  _downloadPlatformZip(platformZipPath, buildKey, platform, version) {
    log.command(`Downloading ${platform} platform version ${version}...`);
    let options = {
      host: HOST,
      path: `${PATH}/${version}/${platform}`,
      headers: {'X-Tabris-Build-Key': buildKey}
    };
    return new Promise((resolve, reject) => {
      let progressBar = new progress.Bar({
        clearOnComplete: true,
        stopOnComplete: true,
        format: ' {bar} {percentage}% | ETA: {eta}s | {value}/{total} MB'
      }, progress.Presets.shades_classic);
      new FileDownloader(options, platformZipPath)
        .on('error', e => {
          if (e.statusCode === 401) {
            console.error('\nBuild key rejected. Please enter your key again.');
            resolve(this._buildKeyProvider.promptBuildKey()
              .then(buildKey => this._downloadPlatformZip(platformZipPath, buildKey, platform, version)));
          } else {
            reject(new Error('Unable to download platform: ' + e.message || e));
          }
        })
        .on('done', resolve)
        .on('progress', ({current, total}) => {
          const MEGABYTE = 1000 * 1000;
          let currentMb = (current / MEGABYTE).toFixed(2);
          let totalMb = (total / MEGABYTE).toFixed(2);
          if (!progressBar.started) {
            progressBar.start(totalMb, currentMb);
            return progressBar.started = true;
          }
          progressBar.update(currentMb);
        })
        .downloadFile(options, platformZipPath);
    });
  }

  _unzipPlatform(zipPath, destination) {
    log.command('Extracting platform...');
    return zip.unzip(zipPath, destination);
  }

};
