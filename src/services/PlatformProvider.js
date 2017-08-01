const {join} = require('path');
const fs = require('fs-extra');
const progress = require('cli-progress');
const log = require('../helpers/log');
const zip = require('../helpers/zip');
const {FileDownloader} = require('../helpers/download');
const BuildKeyProvider = require('./BuildKeyProvider');

const PATH = '/api/v1/downloads/cli';
const HOST = process.env.TABRIS_HOST || 'tabrisjs.com';

module.exports = class PlatformProvider {

  constructor(cliDataDir) {
    this._platformsDir = join(cliDataDir, 'platforms');
    this._buildKeyProvider = new BuildKeyProvider(cliDataDir);
  }

  getPlatform(platform) {
    return new Promise((resolve, reject) => {
      let platformSpec = join(this._platformsDir, platform.name, platform.version);
      let envVarPlatformSpec = process.env[`TABRIS_${platform.name.toUpperCase()}_PLATFORM`];
      if (envVarPlatformSpec) {
        resolve(envVarPlatformSpec);
      } else if (fs.existsSync(platformSpec)) {
        resolve(platformSpec);
      } else {
        this._downloadPlatform(platform)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  _downloadPlatform(platform) {
    return new Promise((resolve, reject) => {
      let platformSpec = join(this._platformsDir, platform.name, platform.version);
      let zipPath = join(this._platformsDir, `.download-${platform.name}-${platform.version}.zip`);
      let extractedZipPath = join(this._platformsDir, `.extracted-${platform.name}-${platform.version}`);
      return fs.mkdirs(this._platformsDir)
        .then(() => this._buildKeyProvider.getBuildKey())
        .then(buildKey => this._downloadPlatformZip(zipPath, buildKey, platform))
        .then(() => this._unzipPlatform(zipPath, extractedZipPath))
        .then(() => fs.move(join(extractedZipPath, `tabris-${platform.name}`), platformSpec))
        .then(() => fs.remove(extractedZipPath))
        .then(() => fs.remove(zipPath))
        .then(() => resolve(platformSpec))
        .catch((e) => fs.remove(platformSpec).then(() => reject(e)));
    });
  }

  _downloadPlatformZip(platformZipPath, buildKey, platform) {
    return new Promise((resolve, reject) => {
      log.command(`Downloading ${platform.name} platform version ${platform.version}...`);
      let options = {
        host: HOST,
        path: `${PATH}/${platform.version}/${platform.name}`,
        headers: {'X-Tabris-Build-Key': buildKey}
      };
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
              .then(buildKey => this._downloadPlatformZip(platformZipPath, buildKey, platform)));
          } else {
            fs.removeSync(platformZipPath);
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
