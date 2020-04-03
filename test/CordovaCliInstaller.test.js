const {realpathSync, mkdirsSync, readJsonSync} = require('fs-extra');
const temp = require('temp');
const {sep} = require('path');
const proc = require('../src/helpers/proc');
const CordovaCliInstaller = require('../src/services/CordovaCliInstaller');
const {expect, restore, stub} = require('./test');
const {version} = require('../package.json');

describe('CordovaCliInstaller', function() {

  afterEach(restore);

  describe('installCordovaCli', function() {

    it('returns cordova path if it exists', function() {
      const dir = realpathSync(temp.mkdirSync('foo'));
      mkdirsSync(`${dir}${sep}cordova${sep}6.5.0${sep}node_modules${sep}.bin${sep}cordova`);

      const installer = new CordovaCliInstaller(dir);

      const path = installer.install('6.5.0');
      expect(path).to.equal(`${dir}${sep}cordova${sep}6.5.0${sep}node_modules${sep}.bin${sep}cordova`);
    });

    it('installs cordova if it does not exist', function() {
      const dir = realpathSync(temp.mkdirSync('foo'));

      stub(proc, 'spawnSync')
        .withArgs('npm', ['install', 'cordova@6.5.0'], {cwd: `${dir}${sep}cordova${sep}6.5.0`})
        .returns({status: 0});

      const installer = new CordovaCliInstaller(dir);

      const path = installer.install('6.5.0');
      expect(path).to.equal(`${dir}${sep}cordova${sep}6.5.0${sep}node_modules${sep}.bin${sep}cordova`);
    });

    it('creates package.json', function() {
      const dir = realpathSync(temp.mkdirSync('foo'));

      stub(proc, 'spawnSync')
        .withArgs('npm', ['install', 'cordova@6.5.0'], {cwd: `${dir}${sep}cordova${sep}6.5.0`})
        .returns({status: 0});

      const installer = new CordovaCliInstaller(dir);

      const path = installer.install('6.5.0');
      const packageJson = readJsonSync(`${dir}${sep}cordova${sep}6.5.0${sep}package.json`);
      expect(path).to.equal(`${dir}${sep}cordova${sep}6.5.0${sep}node_modules${sep}.bin${sep}cordova`);
      expect(packageJson).to.deep.equal({name: 'tabris-cli-cordova-6.5.0-cache', version});
    });

    it('throws an error if npm process returns non-0 exit code', function() {
      const dir = realpathSync(temp.mkdirSync('foo'));

      stub(proc, 'spawnSync')
        .withArgs('npm', ['install', 'cordova@6.5.0'], {cwd: `${dir}${sep}cordova${sep}6.5.0`})
        .returns({status: 1});

      const installer = new CordovaCliInstaller(dir);

      expect(() => installer.install('6.5.0')).to.throw('Error installing Cordova CLI.');
    });

  });

});
