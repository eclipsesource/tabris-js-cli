const {createTmpDir} = require('./tmp');
const {readFileSync, writeFileSync} = require('fs-extra');
const {join} = require('path');
const ConfigXml = require('../src/ConfigXml');
const {expect, stub, restore} = require('./test');

describe('ConfigXml', function() {

  let cwd;

  beforeEach(function() {
    stub(console, 'log');
    return createTmpDir('test').then(directory => cwd = directory);
  });

  afterEach(restore);

  describe('constructor', function() {

    it('sets contents', function() {
      let configXml = new ConfigXml('foo');

      expect(configXml.toString()).to.equal('foo');
    });

  });

  describe('readFrom', function() {

    it('fails when file does not exist', function() {
      expect(
        () => ConfigXml.readFrom('foo/bar/config.xml')
      ).to.throw('Cannot find config.xml at foo/bar/config.xml') ;
    });

    it('creates ConfigXml with contents', function() {
      writeFileSync(join(cwd, 'config.xml'), 'foo');

      let configXml = ConfigXml.readFrom(join(cwd, 'config.xml'));

      expect(configXml.toString()).to.equal('foo');
    });

  });

  describe('replaceVariables', function() {

    it('does not fail when variables undefined', function() {
      let configXml = new ConfigXml('$VAR1 $VAR2')
        .replaceVariables();

      expect(configXml.toString()).to.equal('$VAR1 $VAR2');
    });

    it('replaces variables in config.xml', function() {
      let configXml = new ConfigXml('$VAR1 $VAR2')
        .replaceVariables({VAR1: 'foo', VAR2: 'bar'});

      expect(configXml.toString()).to.equal('foo bar');
    });

    it('replaces all variables in config.xml with the same name', function() {
      let configXml = new ConfigXml('$VAR1 $VAR1 $VAR2')
        .replaceVariables({VAR1: 'foo', VAR2: 'bar'});

      expect(configXml.toString()).to.equal('foo foo bar');
    });

    it('does not replace content other than given variables', function() {
      let configXml = new ConfigXml('boo $VAR1 $VAR2')
        .replaceVariables({VAR1: 'foo', VAR2: 'bar'});

      expect(configXml.toString()).to.equal('boo foo bar');
    });

    it('does not replace variables which were not provided', function() {
      let configXml = new ConfigXml('$FOO $VAR1 $VAR2')
        .replaceVariables({VAR1: 'foo', VAR2: 'bar'});

      expect(configXml.toString()).to.equal('$FOO foo bar');
    });

    it('only replaces variables prefixed with $', function() {
      let configXml = new ConfigXml('$VAR VAR')
        .replaceVariables({VAR: 'foo'});

      expect(configXml.toString()).to.equal('foo VAR');
    });

  });

  describe('writeTo', function() {

    it('fails when directory does not exist', function() {
      let configXml = new ConfigXml('foo');
      let path = join(cwd, '/foo/bar/config.xml');

      expect(
        () => configXml.writeTo(path)
      ).to.throw('Directory does not exist');
    });

    it('writes contents to file', function() {
      let configXml = new ConfigXml('foo');

      let path = join(cwd, 'config.xml');
      configXml.writeTo(path);

      expect(readFileSync(path).toString()).to.equal('foo');
    });

  });

});
