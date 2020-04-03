const {writeFileSync, readFileSync} = require('fs-extra');
const {Parser, Builder} = require('xml2js');
const log = require('../helpers/log');

module.exports = class ConfigXml {

  constructor(contents) {
    this._contents = contents;
    this._parsedXml = this._parseXml(this._contents);
    this._validateContents();
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

  get widgetId() {
    return this._parsedXml.widget.$.id;
  }

  _validateContents() {
    if (!this._parsedXml.widget) {
      throw new Error('Missing or empty <widget> element in config.xml');
    }
    if (!(this._parsedXml.widget.$ && this._parsedXml.widget.$.id)) {
      throw new Error('"id" attribute of <widget> element in config.xml missing');
    }
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
    if (this._parsedXml.widget.content) {
      const src = this._parsedXml.widget.content[0].$.src;
      this._parsedXml.widget.content[0].$.src = this._join('app', src);
    } else {
      this._parsedXml.widget.content = [{$: {src: this._join('app', 'package.json')}}];
    }
    this._contents = new Builder().buildObject(this._parsedXml);
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

  _parseXml(xml) {
    let result;
    new Parser({trim: true, async: false})
      .parseString(xml, (err, root) => {
        if (err) {
          throw new Error('Could not parse config.xml: ' + err.message);
        }
        result = root;
      });
    return result;
  }

  _join(...segments) {
    // segments of config.xml paths must be separated by forward slashes on all platforms
    return segments.join('/');
  }

};
