const os = require('os');
const childProcess = require('child_process');
const proc = require('../src/helpers/proc');
const log = require('../src/helpers/log');
const {expect, stub, restore, match} = require('./test');

describe('proc', function() {

  describe('execSync', function() {

    let status, platform;

    beforeEach(function() {
      status = 0;
      platform = 'linux';
      stub(log, 'command');
      stub(os, 'platform').callsFake(() => platform);
      stub(childProcess, 'spawnSync').callsFake(() => ({status}));
    });

    afterEach(restore);

    it('spawns command with options', function() {
      proc.execSync('foo', ['ba r', 'bak'], {option: 'value'});

      expect(childProcess.spawnSync).to.have.been.calledWithMatch('foo', ['ba r', 'bak'], {
        stdio: 'inherit',
        shell: false,
        option: 'value'
      });
    });

    it('runs command inside of a shell on Windows', function() {
      platform = 'win32';

      proc.execSync('foo', ['bar'], {option: 'value'});

      expect(childProcess.spawnSync).to.have.been.calledWithMatch(match.any, match.any, {
        shell: true
      });
    });

    it('throws an error when process exits with non 0 status', function() {
      status = 123;

      expect(() => {
        proc.execSync('foo', ['bar'], {option: 'value'});
      }).to.throw('The command foo exited with 123');
    });

    it('normalizes command on Windows', function() {
      platform = 'win32';

      proc.execSync('fo o', ['bar'], {option: 'value'});

      expect(childProcess.spawnSync).to.have.been.calledWithMatch('"fo o"');
    });

    it('normalizes arguments on Windows', function() {
      platform = 'win32';

      proc.execSync('foo', ['bar', 'ba k'], {option: 'value'});

      expect(childProcess.spawnSync).to.have.been.calledWithMatch(match.any, ['bar', '"ba k"']);
    });

  });

});

