const {realpathSync, mkdirSync, writeFileSync} = require('fs-extra');
const {createTmpDir} = require('./tmp');
const proc = require('../src/proc');
const {join} = require('path');
const {expect, stub, restore} = require('./test');
const CordovaCli = require('../src/CordovaCli');

describe('CordovaCli', function() {

  let cli, cwd;

  beforeEach(function() {
    proc.exec = stub(proc, 'exec');
    return createTmpDir('test').then(dir => {
      cwd = realpathSync(dir);
      cli = new CordovaCli(cwd);
    });
  });

  afterEach(restore);

  describe('platformAddSafe', function() {

    it('calls cordova platform add', function() {
      cli.platformAddSafe('name', 'spec');

      expect(proc.exec).to.have.been.calledWith('cordova', ['platform', 'add', 'spec'], {cwd});
    });

    it('calls cordova platform add if platforms.json exists and platform not declared', function() {
      mkdirSync(join(cwd, 'platforms'));
      writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{}');
      cli.platformAddSafe('name', 'spec');

      expect(proc.exec).to.have.been.calledWith('cordova', ['platform', 'add', 'spec'], {cwd});
    });

    it('does not call cordova platform add if platform declared', function() {
      mkdirSync(join(cwd, 'platforms'));
      writeFileSync(join(cwd, 'platforms', 'platforms.json'), '{"name": "foo"}');

      cli.platformAddSafe('name', 'bar');

      expect(proc.exec).not.to.have.been.called;
    });

  });

  describe('platformCommand', function() {

    it('calls cordova command', function() {
      cli.platformCommand('command');

      expect(proc.exec).to.have.been.calledWith('cordova', ['command']);
    });

    it('does not pass falsy options', function() {
      cli.platformCommand('command', {options: [null, false]});

      expect(proc.exec).to.have.been.calledWith('cordova', ['command']);
    });

    it('passes options to cordova', function() {
      cli.platformCommand('command', {options: ['foo', 'bar']});

      expect(proc.exec).to.have.been.calledWith('cordova', ['command', '--foo', '--bar']);
    });

    it('passes platformOpts to cordova', function() {
      cli.platformCommand('command', {platformOpts: ['foo', 'bar']});

      expect(proc.exec).to.have.been.calledWith('cordova', ['command', '--', 'foo', 'bar']);
    });

    it('passes options and platformOpts to cordova', function() {
      cli.platformCommand('command', {options: ['baz'], platformOpts: ['foo']});

      expect(proc.exec).to.have.been.calledWith('cordova', ['command', '--baz', '--', 'foo']);
    });

  });

});
