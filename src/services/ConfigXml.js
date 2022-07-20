const {writeFileSync, readFileSync} = require('fs-extra');
const {XMLParser, XMLBuilder, XMLValidator} = require('fast-xml-parser');
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
    const widgetEl = this._parsedXml.find(child => child['widget'] != null);
    return widgetEl && widgetEl[':@'] && widgetEl[':@']['@_id'];
  }

  _validateContents() {
    const widgetEl = this._parsedXml.find(child => child['widget'] != null);
    if (!widgetEl) {
      throw new Error('Missing or empty <widget> element in config.xml');
    }
    if (!widgetEl[':@'] || !widgetEl[':@']['@_id']) {
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
    const widgetEl = this._parsedXml.find(child => child['widget'] != null);
    const widgetElChildren = widgetEl['widget'];
    const contentEl = widgetElChildren && widgetElChildren.find(child => child['content'] != null);
    if (contentEl && contentEl[':@'] && contentEl[':@']['@_src']) {
      contentEl[':@']['@_src'] = this._join('app', contentEl[':@']['@_src']);
    } else if (contentEl) {
      contentEl[':@'] = {'@_src': 'app/package.json'};
    } else {
      widgetElChildren.push({content: [], ':@': {'@_src': 'app/package.json'}});
    }
    const builder = new XMLBuilder({preserveOrder: true, ignoreAttributes: false, suppressEmptyNode: true});
    this._contents = builder.build(this._parsedXml);
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
    const validationResult = XMLValidator.validate(xml);
    if (validationResult !== true) {
      throw new Error('Could not parse config.xml: ' + validationResult.err.message);
    }
    return new XMLParser({preserveOrder: true, ignoreAttributes: false}).parse(xml);
  }

  _join(...segments) {
    // segments of config.xml paths must be separated by forward slashes on all platforms
    return segments.join('/');
  }

};
