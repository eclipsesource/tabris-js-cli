const fs = require('fs-extra');
const {realpathSync, mkdirSync, mkdirsSync, writeFileSync} = require('fs-extra');
const {createTmpDir} = require('./tmp');
const proc = require('../src/proc');
const {join} = require('path');
const {expect, stub, restore, match} = require('./test');
const CordovaCli = require('../src/CordovaCli');

describe('CordovaCli', function() {

  let cli, cwd;

  beforeEach(function() {
    proc.exec = stub(proc, 'exec');
    stub(fs, 'removeSync');
    proc.exec.withArgs('npm', ['bin']).returns({stdout: 'path'});
    return createTmpDir('test').then(dir => {
      cwd = realpathSync(dir);
      cli = new CordovaCli(cwd);
    });
  });

  afterEach(restore);

  describe('platformAddSafe', function() {

    it('calls cordova platform add', function() {
      cli.platformAddSafe('name', 'spec');

      let args = match.array.contains(['platform', 'add', 'spec']);
      expect(proc.exec).to.have.been.calledWith('path/cordova', args, {cwd});
    });

    it('passes --no-update-notifier to cordova', function() {
      cli.platformAddSafe('name', 'spec');

      expect(proc.exec).to.have.been.calledWith('path/cordova', match.array.endsWith(['--no-update-notifier']), {cwd});
    });

    it('calls cordova platform add with options', function() {
      cli.platformAddSafe('name', 'spec', {options: ['foo']});

      let args = match.array.contains(['platform', 'add', 'spec', '--foo']);
      expect(proc.exec).to.have.been.calledWith('path/cordova', args, {cwd});
    });

    it('calls cordova platform add if platforms.json exists but misses platform', function() {
      mkdirSync(join(cwd, 'platforms'));
      writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{}');
      cli.platformAddSafe('name', 'spec');

      expect(fs.removeSync).not.to.have.been.called;
      let args = match.array.contains(['platform', 'add', 'spec']);
      expect(proc.exec).to.have.been.calledWith('path/cordova', args, {cwd});
    });

    it('does not call cordova platform add if platform declared', function() {
      mkdirSync(join(cwd, 'platforms'));
      writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{"name": "foo"}');

      cli.platformAddSafe('name', 'bar');

      expect(fs.removeSync).not.to.have.been.called;
      expect(proc.exec).not.to.have.been.calledWith('path/cordova');
    });

    it('removes platform directory before platform add if existing and missing from platforms.json', function() {
      mkdirsSync(join(cwd, 'platforms', 'name'));
      writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{}');
      cli.platformAddSafe('name', 'spec');

      expect(fs.removeSync).to.have.been.calledWithMatch(/platforms\/name$/);
      let args = match.array.contains(['platform', 'add', 'spec']);
      expect(proc.exec).to.have.been.calledWith('path/cordova', args, {cwd});
    });

    it('removes platform directory before platform add if existing and platforms.json missing', function() {
      mkdirsSync(join(cwd, 'platforms', 'name'));
      cli.platformAddSafe('name', 'spec');

      expect(fs.removeSync).to.have.been.calledWithMatch(/platforms\/name$/);
      let args = match.array.contains(['platform', 'add', 'spec']);
      expect(proc.exec).to.have.been.calledWith('path/cordova', args, {cwd});
    });

  });

  describe('platformCommand', function() {

    it('calls cordova command', function() {
      cli.platformCommand('command', 'platform');

      expect(proc.exec).to.have.been.calledWith('path/cordova', match.array.contains(['command', 'platform']));
    });

    it('passes --no-update-notifier to cordova', function() {
      cli.platformCommand('command', 'platform');

      expect(proc.exec).to.have.been.calledWith('path/cordova', match.array.endsWith(['--no-update-notifier']));
    });

    it('does not pass falsy options', function() {
      cli.platformCommand('command', 'platform', {options: [null, false]});

      expect(proc.exec).to.have.been.calledWith('path/cordova', match.array.contains(['command', 'platform']));
    });

    it('passes options to cordova', function() {
      cli.platformCommand('command', 'platform', {options: ['foo', 'bar']});

      let args = match.array.contains(['command', 'platform', '--foo', '--bar']);
      expect(proc.exec).to.have.been.calledWith('path/cordova', args);
    });

    it('passes platformOpts to cordova', function() {
      cli.platformCommand('command', 'platform', {platformOpts: ['foo', 'bar']});

      let args = match.array.contains(['command', 'platform', '--', 'foo', 'bar']);
      expect(proc.exec).to.have.been.calledWith('path/cordova', args);
    });

    it('passes options and platformOpts to cordova', function() {
      cli.platformCommand('command', 'platform', {options: ['baz'], platformOpts: ['foo']});

      let args = match.array.contains(['command', 'platform', '--baz', '--', 'foo']);
      expect(proc.exec).to.have.been.calledWith('path/cordova', args);
    });

  });

});
