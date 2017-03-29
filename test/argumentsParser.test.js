const {parseVariables} = require('../src/argumentsParser');
const {expect} = require('./test');

describe('argumentsParser', function() {

  describe('parseVariables', function() {

    it('does not fail with empty input', function() {
      let result = parseVariables();

      expect(result).to.eql({});
    });

    it('parses variables string to a map', function() {
      let result = parseVariables('foo=bar,baz=bak');

      expect(result).to.eql({foo: 'bar', baz: 'bak'});
    });

    it('does not fail with space after ","', function() {
      let result = parseVariables('foo=bar, baz=bak');

      expect(result).to.eql({foo: 'bar', baz: 'bak'});
    });

    it('fails when assignment left-hand missing', function() {
      expect(() => parseVariables('=bar,baz=foo')).to.throw('Invalid variable assignment "=bar"');
    });

    it('assigns empty string when right-hand missing', function() {
      let result = parseVariables('baz=');

      expect(result).to.eql({baz: ''});
    });

    it('fails when = missing in assignment', function() {
      expect(() => parseVariables('foo')).to.throw('Invalid variable assignment "foo"');
    });

  });

});
