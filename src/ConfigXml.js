const {writeFileSync, readFileSync} = require('fs-extra');
const log = require('./log');

module.exports = class ConfigXml {

  constructor(contents) {
    this._contents = contents;
  }

  static readFrom(path) {
    let contents;
    try {
      contents = readFileSync(path).toString();
    } catch(e) {
      if (e.code === 'ENOENT') {
        throw `Cannot find config.xml at ${path}`;
      }
      throw e;
    }
    return new ConfigXml(contents);
  }

  toString() {
    return this._contents;
  }

  replaceVariables(variableReplacements) {
    if (!variableReplacements) {
      return this;
    }
    log.command('Replacing variables in config.xml...');
    Object.keys(variableReplacements).forEach(name => {
      let replacement = variableReplacements[name];
      this._contents = this._contents.replace(new RegExp('\\$' + name, 'g'), replacement);
    });
    return this;
  }

  writeTo(path) {
    try {
      writeFileSync(path, this._contents);
    } catch(e) {
      if (e.code === 'ENOENT') {
        throw 'Directory does not exist';
      }
      throw e;
    }
  }

};
