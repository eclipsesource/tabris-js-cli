const os = require('os');
const childProcess = require('child_process');
const proc = require('../src/helpers/proc');
const log = require('../src/helpers/log');
const {expect, stub, restore, match} = require('./test');

describe('proc', function() {

  ['exec', 'execSync'].forEach(fn => {

    let spawnFn = fn === 'exec' ? 'spawn' : 'spawnSync';

    describe(fn, function() {

      let status, platform;

      beforeEach(function() {
        status = 0;
        platform = 'linux';
        stub(process, 'exit');
        stub(log, 'command');
        stub(os, 'platform').callsFake(() => platform);
        stub(childProcess, 'spawnSync').callsFake(() => ({status}));
        const onStub = stub();
        onStub.withArgs('exit').callsFake((_event, cb) => cb(status));
        stub(childProcess, 'spawn').returns({on: onStub});
      });

      afterEach(restore);

      it('spawns command with options', function() {
        proc[fn]('foo', ['ba r', 'bak'], {option: 'value'});

        expect(childProcess[spawnFn]).to.have.been.calledWithMatch('foo', ['ba r', 'bak'], {
          stdio: 'inherit',
          shell: false,
          option: 'value'
        });
      });

      it('runs command inside of a shell on Windows', function() {
        platform = 'win32';

        proc[fn]('foo', ['bar'], {option: 'value'});

        expect(childProcess[spawnFn]).to.have.been.calledWithMatch(match.any, match.any, {
          shell: true
        });
      });

      it('normalizes command on Windows', function() {
        platform = 'win32';

        proc[fn]('fo o', ['bar'], {option: 'value'});

        expect(childProcess[spawnFn]).to.have.been.calledWithMatch('"fo o"');
      });

      it('normalizes arguments on Windows', function() {
        platform = 'win32';

        proc[fn]('foo', ['bar', 'ba k'], {option: 'value'});

        expect(childProcess[spawnFn]).to.have.been.calledWithMatch(match.any, ['bar', '"ba k"']);
      });

      if (fn === 'execSync') {
        it('throws an error when process exits with non 0 status', function() {
          status = 123;

          expect(() => {
            proc[fn]('foo', ['bar'], {option: 'value'});
          }).to.throw('The command foo exited with 123');
        });
      }

      if (fn === 'exec') {
        it('exits with 1 when process exits with non 0 status', function() {
          status = 123;

          proc[fn]('foo', ['bar'], {option: 'value'});

          expect(process.exit).to.have.been.calledWith(1);
        });
      }

    });

  });

});

