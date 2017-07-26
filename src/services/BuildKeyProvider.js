const {join, dirname} = require('path');
const fs = require('fs-extra');
const promptly = require('promptly');

const BUILD_KEY_PROMPT_LABEL = 'Build key (https://tabrisjs.com/settings/account):';
const BUILD_KEY_ENV_VAR = 'TABRIS_BUILD_KEY';
const BUILD_KEY_VALIDATION_REGEX = /^[a-zA-Z0-9-]{36}$/;
const INPUT_REPLACE_CHAR = '●';

class BuildKeyProvider {

  constructor(cliDataDir) {
    this._cliDataDir = cliDataDir;
    this._buildKeyFilePath = join(this._cliDataDir, 'build.key');
  }

  getBuildKey() {
    return new Promise((resolve, reject) => {
      if (process.env[BUILD_KEY_ENV_VAR]) {
        return resolve(process.env[BUILD_KEY_ENV_VAR]);
      }
      if (fs.existsSync(this._buildKeyFilePath)) {
        let buildKey = fs.readFileSync(this._buildKeyFilePath, 'utf8').trim();
        this._validateBuildKey(buildKey);
        return resolve(buildKey);
      }
      this.promptBuildKey().then(resolve).catch(reject);
    });
  }

  promptBuildKey() {
    return promptly.prompt(BUILD_KEY_PROMPT_LABEL, {
      silent: true,
      replace: INPUT_REPLACE_CHAR,
      validator: this._validateBuildKey
    }).then(key => {
      this._writeBuildKey(key);
      return key;
    });
  }

  _validateBuildKey(value) {
    if (!BUILD_KEY_VALIDATION_REGEX.test(value)) {
      throw new Error('Invalid build key.');
    }
    return value;
  }

  _writeBuildKey(key) {
    try {
      fs.mkdirsSync(dirname(this._buildKeyFilePath));
      fs.writeFileSync(this._buildKeyFilePath, key);
    } catch(e) {
      throw new Error('Writing build.key file failed');
    }
    return key;
  }

}

module.exports = BuildKeyProvider;
