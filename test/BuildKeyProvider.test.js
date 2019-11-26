const BuildKeyProvider = require('../src/services/BuildKeyProvider');
const fs = require('fs-extra');
const temp = require('temp');
const {expect, stub, restore} = require('./test');
const {join} = require('path');

describe('BuildKeyProvider', function() {

  const VALID_KEY = '1xxxabxx-xxx2-x3xc-xx4x-xxxx56xxxxfx';

  let provider, cliDataDir, buildKeyPath;

  beforeEach(function() {
    cliDataDir = temp.mkdirSync('cliDataDir');
    provider = new BuildKeyProvider(cliDataDir);
    buildKeyPath = join(cliDataDir, 'build.key');
    process.stdout.isTTY = true;
    stub(process.stdout, 'write');
  });

  afterEach(() => {
    delete process.env.TABRIS_BUILD_KEY;
    delete process.stdout.isTTY;
    restore();
  });

  describe('getBuildKey', function() {

    describe('when TABRIS_BUILD_KEY environment variable is set', function() {

      it('returns TABRIS_BUILD_KEY value', async function() {
        process.env.TABRIS_BUILD_KEY = 'foo';

        let result = await provider.getBuildKey();

        expect(result).to.equal('foo');
      });

      it('returns TABRIS_BUILD_KEY value when both build.key exists and TABRIS_BUILD_KEY is set', async function() {
        process.env.TABRIS_BUILD_KEY = 'foo';
        fs.writeFileSync(buildKeyPath, 'invalidKey', 'utf8');

        let result = await provider.getBuildKey();

        expect(result).to.equal('foo');
      });

    });

    describe('when TABRIS_BUILD_KEY environment variable is not set', function() {

      describe('and not running within a TTY context', function() {

        beforeEach(function() {
          process.stdout.isTTY = false;
        });

        it('throws an error', async function() {
          try {
            await provider.getBuildKey();
            throw 'Expected rejection';
          } catch(e) {
            expect(e.message).to.match(/TABRIS_BUILD_KEY must be set/);
          }
        });

      });

      describe('when build.key file exists', function() {

        it('returns build.key file contents', async function() {
          fs.writeFileSync(buildKeyPath, VALID_KEY, 'utf8');

          let result = await provider.getBuildKey();

          expect(result).to.equal(VALID_KEY);
        });

        it('returns build.key file contents when build key ends with new line', async function() {
          fs.writeFileSync(buildKeyPath, VALID_KEY + '\n', 'utf8');

          let result = await provider.getBuildKey();

          expect(result).to.equal(VALID_KEY);
        });

        it('rejects when build key was invalid', async function() {
          fs.writeFileSync(buildKeyPath, 'invalidKey', 'utf8');
          try {
            await provider.getBuildKey();
            throw new Error('Expected rejection');
          } catch(e) {
            expect(e.message).to.equal('Invalid build key.');
          }
        });

      });

      describe('when build.key file does not exist', function() {

        it('resolves with given string when valid build key given', async function() {
          let promise = (async () => {
            let key = await provider.getBuildKey();
            expect(key).to.equal(VALID_KEY);
            expect(process.stdout.write).not.to.have.been.calledWith('Invalid build key.\n');
          })();
          sendLine(VALID_KEY);
          await promise;
        });

        it('prints input label', async function() {
          let promise = (async () => {
            await provider.getBuildKey();
            expect(process.stdout.write).to.have.been.calledWithMatch(/build key:/);
          })();
          sendLine(VALID_KEY);
          await promise;
        });

        it('creates build.key file with given key', async function() {
          let promise = (async () => {
            let key = await provider.getBuildKey();
            expect(key).to.equal(VALID_KEY);
            expect(fs.readFileSync(buildKeyPath, 'utf8')).to.equal(VALID_KEY);
          })();
          sendLine(VALID_KEY);
          await promise;
        });

        // TODO: does not pass on environments where tests are run by the super user
        // it('rejects with error when writing key file fails', async function() {
        //   fs.chmodSync(cliDataDir, '0000');
        //   try {
        //     let promise = (async () => {
        //       await provider.getBuildKey();
        //       throw 'Expected rejection';
        //     })();
        //     sendLine(VALID_KEY);
        //     await promise;
        //   } catch(e) {
        //     expect(e.message).to.equal('Writing build.key file failed');
        //   }
        // });

        it('prompts again for key when given key was wrong and resolves with key', async function() {
          let promise = (async () => {
            let key = await provider.getBuildKey();
            expect(key).to.equal(VALID_KEY);
            expect(process.stdout.write).to.have.been.calledWith('Invalid build key.\n');
          })();
          sendLine('boo');
          sendLine(VALID_KEY);
          await promise;
        });

        it('keys shorter than 36 characters are invalid', async function() {
          let promise = (async () => {
            await provider.getBuildKey();
            expect(process.stdout.write).to.have.been.calledWith('Invalid build key.\n');
          })();
          sendLine(VALID_KEY.slice(0, -1));
          sendLine(VALID_KEY);
          await promise;
        });

        it('keys longer than 36 characters are invalid', async function() {
          let promise = (async () => {
            let key = await provider.getBuildKey();
            expect(key).to.equal(VALID_KEY);
            expect(process.stdout.write).to.have.been.calledWith('Invalid build key.\n');
          })();
          sendLine(VALID_KEY + 'x');
          sendLine(VALID_KEY);
          await promise;
        });

        it('keys containing disallowed characters are invalid', async function() {
          let promise = (async () => {
            let key = await provider.getBuildKey();
            expect(key).to.equal(VALID_KEY);
            expect(process.stdout.write).to.have.been.calledWith('Invalid build key.\n');
          })();
          sendLine(VALID_KEY.replace(/.$/, '_'));
          sendLine(VALID_KEY);
          await promise;
        });

      });

    });

  });

});

function sendLine(line) {
  process.stdin.emit('data', line + '\n');
}
