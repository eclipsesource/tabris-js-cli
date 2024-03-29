const {readFileSync, writeFileSync} = require('fs-extra');
const {join} = require('path');
const temp = require('temp');
const ConfigXml = require('../src/services/ConfigXml');
const {expect, stub, restore} = require('./test');

describe('ConfigXml', function() {

  let cwd;

  beforeEach(function() {
    stub(console, 'log');
    cwd = temp.mkdirSync('test');
  });

  afterEach(restore);

  describe('constructor', function() {

    it('sets contents', function() {
      const configXml = new ConfigXml(createContent());

      expect(configXml.toString()).to.equal(createContent());
    });

    it('fails on malformed input', function() {
      expect(() => new ConfigXml('This is not XML!')).to.throw(Error, 'Could not parse config.xml');
    });

    it('fails when the <widget> element in config.xml is missing', function() {
      expect(() => new ConfigXml('<foo></foo>')).to.throw(Error, 'Missing or empty <widget> element in config.xml');
    });

    it('fails when the id attribute of the <widget> element in config.xml is missing', function() {
      expect(() => new ConfigXml('<widget>foo</widget>'))
        .to.throw(Error, '"id" attribute of <widget> element in config.xml missing');
    });

  });

  describe('readFrom', function() {

    it('fails when file does not exist', function() {
      expect(
        () => ConfigXml.readFrom('foo/bar/config.xml')
      ).to.throw('Cannot find config.xml at foo/bar/config.xml') ;
    });

    it('creates ConfigXml with contents', function() {
      writeFileSync(join(cwd, 'config.xml'), createContent());

      const configXml = ConfigXml.readFrom(join(cwd, 'config.xml'));

      expect(configXml.toString()).to.equal(createContent());
    });

  });

  describe('get widgetId', function() {

    it('returns widget ID', function() {
      writeFileSync(join(cwd, 'config.xml'), createContent());

      const configXml = ConfigXml.readFrom(join(cwd, 'config.xml'));

      expect(configXml.widgetId).to.equal('test');
    });

  });

  describe('replaceVariables', function() {

    it('does not fail when variables undefined', function() {
      const configXml = new ConfigXml(createContent('$VAR1 $VAR2'))
        .replaceVariables();

      expect(configXml.toString()).to.equal(createContent('$VAR1 $VAR2'));
    });

    it('replaces variables in config.xml', function() {
      const configXml = new ConfigXml(createContent('$VAR1 $VAR2'))
        .replaceVariables({VAR1: 'foo', VAR2: 'bar'});

      expect(configXml.toString()).to.equal(createContent('foo bar'));
    });

    it('replaces all variables in config.xml with the same name', function() {
      const configXml = new ConfigXml(createContent('$VAR1 $VAR1 $VAR2'))
        .replaceVariables({VAR1: 'foo', VAR2: 'bar'});

      expect(configXml.toString()).to.equal(createContent('foo foo bar'));
    });

    it('does not replace content other than given variables', function() {
      const configXml = new ConfigXml(createContent('boo $VAR1 $VAR2'))
        .replaceVariables({VAR1: 'foo', VAR2: 'bar'});

      expect(configXml.toString()).to.equal(createContent('boo foo bar'));
    });

    it('does not replace variables which were not provided', function() {
      const configXml = new ConfigXml(createContent('$FOO $VAR1 $VAR2'))
        .replaceVariables({VAR1: 'foo', VAR2: 'bar'});

      expect(configXml.toString()).to.equal(createContent('$FOO foo bar'));
    });

    it('only replaces variables prefixed with $', function() {
      const configXml = new ConfigXml(createContent('$VAR VAR'))
        .replaceVariables({VAR: 'foo'});

      expect(configXml.toString()).to.equal(createContent('foo VAR'));
    });

  });

  describe('adjustContentPath', function() {

    it('inserts missing content element', function() {
      const configXml = new ConfigXml(createContent());

      configXml.adjustContentPath();

      expect(configXml.toString()).to.contain('<content src="app/package.json"/>');
    });

    it('prefixes existing content element', function() {
      const configXml = new ConfigXml(createContent('<content src="foo/package.json"/>'));

      configXml.adjustContentPath();

      expect(configXml.toString()).to.contain('<content src="app/foo/package.json"/>');
    });

    it('adds src attribute to existing content element without src attribute', function() {
      const configXml = new ConfigXml(createContent('<content />'));

      configXml.adjustContentPath();

      expect(configXml.toString()).to.contain('<content src="app/package.json"/>');
    });

    it('returns context', function() {
      const configXml = new ConfigXml(createContent());

      const result = configXml.adjustContentPath();

      expect(result).to.equal(configXml);
    });

  });

  describe('writeTo', function() {

    it('fails when directory does not exist', function() {
      const configXml = new ConfigXml(createContent());
      const path = join(cwd, '/foo/bar/config.xml');

      expect(
        () => configXml.writeTo(path)
      ).to.throw('Directory does not exist');
    });

    it('writes contents to file', function() {
      const configXml = new ConfigXml(createContent());

      const path = join(cwd, 'config.xml');
      configXml.writeTo(path);

      expect(readFileSync(path).toString()).to.equal(createContent());
    });

  });

});

function createContent(content) {
  return `<widget id="test">${content}</widget>`;
}
