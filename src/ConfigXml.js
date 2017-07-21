const {join} = require('path');
const {writeFileSync, readFileSync} = require('fs-extra');
const {Parser, Builder} = require('xml2js');
const log = require('./helpers/log');

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

  replaceVariables(vars) {
    if (!vars) {
      return this;
    }
    log.command('Replacing variables in config.xml...');
    this._contents = this._contents.replace(/\$(\w+)/g, (match, name) => name in vars ? vars[name] : match);
    return this;
  }

  adjustContentPath() {
    let parser = new Parser({trim: true});
    let builder = new Builder();
    parser.parseString(this._contents, (err, root) => {
      if (err) {
        throw new Error('Could not parse config.xml: ' + err.message);
      }
      if (!root.widget) {
        throw new Error('Missing or empty <widget> element in config.xml');
      }
      if (root.widget.content) {
        let src = root.widget.content[0].$.src;
        root.widget.content[0].$.src = join('app', src);
      } else {
        root.widget.content = [{$: {src: 'app/package.json'}}];
      }
      this._contents = builder.buildObject(root);
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
