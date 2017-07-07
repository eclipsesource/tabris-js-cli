const BuildKeyProvider = require('../src/BuildKeyProvider');
const fs = require('fs-extra');
const temp = require('temp').track();
const {expect, stub, restore} = require('./test');
const {join} = require('path');

describe('BuildKeyProvider', function() {

  const VALID_KEY = '1xxxabxx-xxx2-x3xc-xx4x-xxxx56xxxxfx';

  let provider, cliDataDir, buildKeyPath;

  beforeEach(function() {
    cliDataDir = temp.mkdirSync('cliDataDir');
    provider = new BuildKeyProvider(cliDataDir);
    buildKeyPath = join(cliDataDir, 'build.key');
    stub(process.stdout, 'write');
  });

  afterEach(() => {
    delete process.env.TABRIS_BUILD_KEY;
    restore();
  });

  describe('getBuildKey', function() {

    describe('when TABRIS_BUILD_KEY environment variable is set', function() {

      it('returns TABRIS_BUILD_KEY value', function() {
        process.env.TABRIS_BUILD_KEY = 'foo';

        return provider.getBuildKey().then(result => {
          expect(result).to.equal('foo');
        });
      });

    });

    describe('when build.key file exists', function() {

      it('returns build.key file contents', function() {
        fs.writeFileSync(buildKeyPath, VALID_KEY, 'utf8');

        return provider.getBuildKey().then(result => {
          expect(result).to.equal(VALID_KEY);
        });
      });

      it('returns build.key file contents when build key ends with new line', function() {
        fs.writeFileSync(buildKeyPath, VALID_KEY + '\n', 'utf8');

        return provider.getBuildKey().then(result => {
          expect(result).to.equal(VALID_KEY);
        });
      });

      it('rejects when build key was invalid', function() {
        fs.writeFileSync(buildKeyPath, 'invalidKey', 'utf8');

        return provider.getBuildKey().then(() => {
          throw 'Expected rejection';
        })
        .catch(e => {
          expect(e.message).to.equal('Invalid build key.');
        });
      });

      it('returns TABRIS_BUILD_KEY value when both build.key exists and TABRIS_BUILD_KEY is set', function() {
        process.env.TABRIS_BUILD_KEY = 'foo';
        fs.writeFileSync(buildKeyPath, 'invalidKey', 'utf8');

        return provider.getBuildKey().then(result => {
          expect(result).to.equal('foo');
        });
      });

    });

    describe('when build.key file does not exist', function() {

      it('resolves with given string when valid build key given', function() {
        let promise = provider.getBuildKey().then(key => {
          expect(key).to.equal(VALID_KEY);
          expect(process.stdout.write).not.to.have.been.calledWith('Invalid build key.\n');
        });
        sendLine(VALID_KEY);
        return promise;
      });

      it('prints input label', function() {
        let promise = provider.getBuildKey().then(() => {
          expect(process.stdout.write).to.have.been.calledWith('Build key (https://tabrisjs.com/settings/account): ');
        });
        sendLine(VALID_KEY);
        return promise;
      });

      it('creates build.key file with given key', function() {
        let promise = provider.getBuildKey().then(key => {
          expect(key).to.equal(VALID_KEY);
          expect(fs.readFileSync(buildKeyPath, 'utf8')).to.equal(VALID_KEY);
        });
        sendLine(VALID_KEY);
        return promise;
      });

      // TODO: does not pass on environments where tests are run by the super user
      xit('rejects with error when writing key file fails', function() {
        fs.chmodSync(cliDataDir, '0000');
        let promise = provider.getBuildKey()
          .then(() => {
            throw 'Expected rejection';
          })
          .catch(e => {
            expect(e.message).to.equal('Writing build.key file failed');
          });
        sendLine(VALID_KEY);
        return promise;
      });

      it('prompts again for key when given key was wrong and resolves with key', function() {
        provider.getBuildKey().then(key => {
          expect(key).to.equal(VALID_KEY);
          expect(process.stdout.write).to.have.been.calledWith('Invalid build key.\n');
        });
        sendLine('boo');
        sendLine(VALID_KEY);
      });

      it('keys shorter than 36 characters are invalid', function() {
        let promise = provider.getBuildKey().then(() => {
          expect(process.stdout.write).to.have.been.calledWith('Invalid build key.\n');
        });
        sendLine(VALID_KEY.slice(0, -1));
        sendLine(VALID_KEY);
        return promise;
      });

      it('keys longer than 36 characters are invalid', function() {
        let promise = provider.getBuildKey().then(key => {
          expect(key).to.equal(VALID_KEY);
          expect(process.stdout.write).to.have.been.calledWith('Invalid build key.\n');
        });
        sendLine(VALID_KEY + 'x');
        sendLine(VALID_KEY);
        return promise;
      });

      it('keys containing disallowed characters are invalid', function() {
        let promise = provider.getBuildKey().then(key => {
          expect(key).to.equal(VALID_KEY);
          expect(process.stdout.write).to.have.been.calledWith('Invalid build key.\n');
        });
        sendLine(VALID_KEY.replace(/.$/, '_'));
        sendLine(VALID_KEY);
        return promise;
      });

    });

  });

});

function sendLine(line) {
  process.stdin.emit('data', line + '\n');
}
