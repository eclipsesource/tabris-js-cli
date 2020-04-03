const {parseVariables} = require('../src/helpers/argumentsParser');
const {expect} = require('./test');

describe('argumentsParser', function() {

  describe('parseVariables', function() {

    it('does not fail with empty input', function() {
      const result = parseVariables();

      expect(result).to.eql({});
    });

    it('parses variables string to a map', function() {
      const result = parseVariables('foo=bar,baz=bak');

      expect(result).to.eql({foo: 'bar', baz: 'bak'});
    });

    it('does not fail with space after ","', function() {
      const result = parseVariables('foo=bar, baz=bak');

      expect(result).to.eql({foo: 'bar', baz: 'bak'});
    });

    it('fails when assignment left-hand missing', function() {
      expect(() => parseVariables('=bar,baz=foo')).to.throw('Invalid variable assignment "=bar"');
    });

    it('assigns empty string when right-hand missing', function() {
      const result = parseVariables('baz=');

      expect(result).to.eql({baz: ''});
    });

    it('fails when = missing in assignment', function() {
      expect(() => parseVariables('foo')).to.throw('Invalid variable assignment "foo"');
    });

  });

});
