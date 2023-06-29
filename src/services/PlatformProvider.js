const {join, normalize} = require('path');
const fs = require('fs-extra');
const progress = require('cli-progress');
const log = require('../helpers/log');
const zip = require('../helpers/zip');
const {FileDownloader} = require('../helpers/download');
const PlatformsCache = require('./PlatformsCache');
const proc = require('../helpers/proc');

const PATH = '/downloads';
const HOST = process.env.TABRIS_HOST || 'tabrisjs.com';

module.exports = class PlatformProvider {

  constructor(cliDataDir) {
    this._platformsDir = join(cliDataDir, 'platforms');
    this._platformsCache = new PlatformsCache(cliDataDir);
  }

  async getPlatform(platform) {
    const path = await this._getPlatformPath(platform);
    const hasPackageJson = fs.pathExistsSync(join(path, 'package.json'));
    const hasNodeModules = fs.pathExistsSync(join(path, 'node_modules'));
    if (hasPackageJson && !hasNodeModules) {
      log.command('Installing platform dependencies');
      proc.spawnSync('npm', ['install'], {cwd: normalize(path)});
    }
    return path;
  }

  _getPlatformPath(platform) {
    const envVarPlatformSpec = process.env[`TABRIS_${platform.name.toUpperCase()}_PLATFORM`];
    if (envVarPlatformSpec) {
      return Promise.resolve(envVarPlatformSpec);
    } else if (this._platformsCache.has(platform)) {
      return Promise.resolve(this._platformsCache.get(platform));
    } else {
      return this._downloadPlatform(platform);
    }
  }

  async _downloadPlatform(platform) {
    const zipPath = join(this._platformsDir, `.download-${platform.name}-${platform.version}.zip`);
    const extractedZipPath = join(this._platformsDir, `.extracted-${platform.name}-${platform.version}`);
    const platformDir = join(extractedZipPath, `tabris-${platform.name}`);
    await fs.mkdirs(this._platformsDir);
    await this._downloadPlatformZip(zipPath, platform);
    await this._unzipPlatform(zipPath, extractedZipPath);
    this._platformsCache.set(platform, platformDir);
    await fs.remove(extractedZipPath);
    await fs.remove(zipPath);
    return this._platformsCache.get(platform);
  }

  async _downloadPlatformZip(platformZipPath, platform) {
    log.command(`Downloading ${platform.name} platform version ${platform.version}...`);
    console.info(`${PATH}/${platform.version}/platforms/tabris-${platform.name}.zip`);
    const options = {
      host: HOST,
      path: `${PATH}/${platform.version}/platforms/tabris-${platform.name}.zip`,
      headers: {}
    };
    const progressBar = new progress.Bar({
      clearOnComplete: true,
      stopOnComplete: true,
      format: ' {bar} {percentage}% | ETA: {eta}s | {value}/{total} MB'
    }, progress.Presets.shades_classic);
    await new Promise((resolve, reject) => {
      new FileDownloader(options, platformZipPath)
        .on('error', async e => {
          try {
            if (e.statusCode === 401) {
              console.error('\nBuild key rejected. Please enter your key again.');
              const buildKey = await this._buildKeyProvider.promptBuildKey();
              await this._downloadPlatformZip(platformZipPath, buildKey, platform);
              resolve();
            } else {
              reject(new Error('Unable to download platform: ' + e.message || e));
            }
          } catch(e) { reject(e); }
        })
        .on('done', resolve)
        .on('progress', ({current, total}) => {
          const MEGABYTE = 1000 * 1000;
          const currentMb = (current / MEGABYTE).toFixed(2);
          const totalMb = (total / MEGABYTE).toFixed(2);
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
