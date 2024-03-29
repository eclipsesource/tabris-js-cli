const fs = require('fs-extra');
const {realpathSync, mkdirSync, mkdirsSync, writeFileSync} = require('fs-extra');
const temp = require('temp');
const proc = require('../src/helpers/proc');
const {join} = require('path');
const {expect, stub, restore, match} = require('./test');
const CordovaCli = require('../src/services/CordovaCli');

const CORDOVA = 'path/cordova';

describe('CordovaCli', function() {

  let cli, cwd;

  beforeEach(function() {
    stub(proc, 'spawnSync');
    stub(fs, 'removeSync');
    const dir = temp.mkdirSync();
    cwd = realpathSync(dir);
    cli = new CordovaCli(cwd, 'path/cordova');
  });

  afterEach(restore);

  describe('platformAddSafe', function() {

    it('calls cordova platform add', function() {
      cli.platformAddSafe('name', 'spec');

      const args = match.array.contains(['platform', 'add', 'spec']);
      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args, {cwd});
    });

    it('passes --no-update-notifier to cordova', function() {
      cli.platformAddSafe('name', 'spec');

      expect(proc.spawnSync)
        .to.have.been.calledWith(CORDOVA, match.array.endsWith(['--no-update-notifier']), {cwd});
    });

    it('calls cordova platform add with options', function() {
      cli.platformAddSafe('name', 'spec', {options: ['foo']});

      const args = match.array.contains(['platform', 'add', 'spec', '--foo']);
      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args, {cwd});
    });

    describe('platform declaration in platforms.json', function() {
      it('calls cordova platform add if platforms.json exists but misses platform', function() {
        mkdirSync(join(cwd, 'platforms'));
        writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{}');
        cli.platformAddSafe('name', 'spec');

        expect(fs.removeSync).not.to.have.been.called;
        const args = match.array.contains(['platform', 'add', 'spec']);
        expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args, {cwd});
      });

      it('does not call cordova platform add if platform declared', function() {
        mkdirSync(join(cwd, 'platforms'));
        writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{"name": "foo"}');

        cli.platformAddSafe('name', 'bar');

        expect(fs.removeSync).not.to.have.been.called;
        expect(proc.spawnSync).not.to.have.been.calledWith(CORDOVA);
      });

      it('returns self if platform declared', function() {
        mkdirSync(join(cwd, 'platforms'));
        writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{"name": "foo"}');

        expect(cli.platformAddSafe('name', 'bar')).to.equal(cli);
      });

      it('removes platform directory before platform add if existing and missing from platforms.json', function() {
        mkdirsSync(join(cwd, 'platforms', 'name'));
        writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{}');
        cli.platformAddSafe('name', 'spec');

        expect(fs.removeSync).to.have.been.calledWithMatch(/platforms.name$/);
        const args = match.array.contains(['platform', 'add', 'spec']);
        expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args, {cwd});
      });

    });

    describe('platform declaration in package.json', function() {

      it('calls cordova platform add if package.json exists but misses platform', function() {
        mkdirSync(join(cwd, 'platforms'));
        writeFileSync(join(cwd, 'package.json'), '{"cordova": {"platforms": ["other"]}}');
        cli.platformAddSafe('name', 'spec');

        expect(fs.removeSync).not.to.have.been.called;
        const args = match.array.contains(['platform', 'add', 'spec']);
        expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args, {cwd});
      });

      it('calls cordova platform add if package.json exists but misses platforms array', function() {
        mkdirSync(join(cwd, 'platforms'));
        writeFileSync(join(cwd, 'package.json'), '{"cordova": {}}');
        cli.platformAddSafe('name', 'spec');

        expect(fs.removeSync).not.to.have.been.called;
        const args = match.array.contains(['platform', 'add', 'spec']);
        expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args, {cwd});
      });

      it('does not call cordova platform add if platform declared', function() {
        mkdirSync(join(cwd, 'platforms'));
        writeFileSync(join(cwd, 'package.json'), '{"cordova": {"platforms": ["name"]}}');

        cli.platformAddSafe('name', 'bar');

        expect(fs.removeSync).not.to.have.been.called;
        expect(proc.spawnSync).not.to.have.been.calledWith(CORDOVA);
      });

      it('returns self if platform declared', function() {
        mkdirSync(join(cwd, 'platforms'));
        writeFileSync(join(cwd, 'package.json'), '{"cordova": {"platforms": ["name"]}}');

        expect(cli.platformAddSafe('name', 'bar')).to.equal(cli);
      });

      it('removes platform directory before platform add if existing and missing from package.json', function() {
        mkdirsSync(join(cwd, 'platforms', 'name'));
        writeFileSync(join(cwd, 'package.json'), '{"cordova": {"platforms": ["other"]}}');
        cli.platformAddSafe('name', 'spec');

        expect(fs.removeSync).to.have.been.calledWithMatch(/platforms.name$/);
        const args = match.array.contains(['platform', 'add', 'spec']);
        expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args, {cwd});
      });

    });

    it('removes platform directory before platform add if existing and platform declaration files', function() {
      mkdirsSync(join(cwd, 'platforms', 'name'));
      cli.platformAddSafe('name', 'spec');

      expect(fs.removeSync).to.have.been.calledWithMatch(/platforms.name$/);
      const args = match.array.contains(['platform', 'add', 'spec']);
      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args, {cwd});
    });

  });

  describe('platformCommand', function() {

    it('calls cordova command', function() {
      cli.platformCommand('command', 'platform');

      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, match.array.contains(['command', 'platform']));
    });

    it('passes --no-update-notifier to cordova', function() {
      cli.platformCommand('command', 'platform');

      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, match.array.endsWith(['--no-update-notifier']));
    });

    it('does not pass falsy options', function() {
      cli.platformCommand('command', 'platform', {options: [null, false]});

      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, match.array.contains(['command', 'platform']));
    });

    it('passes options to cordova', function() {
      cli.platformCommand('command', 'platform', {options: ['foo', 'bar']});

      const args = match.array.contains(['command', 'platform', '--foo', '--bar']);
      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args);
    });

    it('passes platformOpts to cordova', function() {
      cli.platformCommand('command', 'platform', {cordovaPlatformOpts: ['foo', 'bar']});

      const args = match.array.contains(['command', 'platform', '--', 'foo', 'bar']);
      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args);
    });

    it('passes options and platformOpts to cordova', function() {
      cli.platformCommand('command', 'platform', {options: ['baz'], cordovaPlatformOpts: ['foo']});

      const args = match.array.contains(['command', 'platform', '--baz', '--', 'foo']);
      expect(proc.spawnSync).to.have.been.calledWith(CORDOVA, args);
    });

  });

});
