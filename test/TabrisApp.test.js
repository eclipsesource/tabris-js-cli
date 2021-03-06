const {mkdirsSync, mkdirSync, existsSync, removeSync, writeFileSync, realpathSync} = require('fs-extra');
const {join} = require('path');
const temp = require('temp');
const proc = require('../src/helpers/proc');
const log = require('../src/helpers/log');
const {expect, stub, restore} = require('./test');
const TabrisApp = require('../src/services/TabrisApp');
const path = require('path');

describe('TabrisApp', function() {

  this.timeout(10000);

  let cwd;

  beforeEach(function() {
    stub(log, 'command');
    stub(proc, 'spawnSync');
    const dir = temp.mkdirSync('test');
    cwd = realpathSync(dir);
    writeFileSync(join(cwd, 'package.json'), '{"main": "foo.js"}');
    mkdirSync(join(cwd, 'cordova'));
  });

  afterEach(restore);

  describe('constructor', function() {

    it('fails if package.json is missing', function() {
      removeSync(join(cwd, 'package.json'));

      expect(() => new TabrisApp(cwd)).to.throw('Could not find package.json');
    });

    it('fails if package.json does not contain a main field', function() {
      writeFileSync(join(cwd, 'package.json'), '{}');

      expect(() => new TabrisApp(cwd)).to.throw('package.json must contain a "main" field');
    });

    it('fails if cordova/ is missing', function() {
      removeSync(join(cwd, 'cordova'));

      expect(() => new TabrisApp(cwd)).to.throw('Could not find cordova directory');
    });

  });

  describe('validateInstalledTabrisVersion', function() {

    let tabrisApp;
    let tabrisVersion;

    beforeEach(function() {
      tabrisApp = new TabrisApp(cwd);
      proc.spawnSync.callsFake(() => {
        const tabrisModulePath = join(cwd, 'destination', 'www', 'app', 'node_modules', 'tabris');
        mkdirsSync(tabrisModulePath);
        writeFileSync(join(tabrisModulePath, 'package.json'), `{"version": "${tabrisVersion}"}`);
      });
    });

    it('does not throw if installed tabris version >= 2', function() {
      tabrisVersion = '2.0.2';
      tabrisApp.createCordovaProject(join(cwd, 'destination'));

      expect(() => tabrisApp.validateInstalledTabrisVersion())
        .not.to.throw();
    });

    it('throws if tabris major version is lower than 2', function() {
      tabrisVersion = '1.5.0';
      tabrisApp.createCordovaProject(join(cwd, 'destination'));

      expect(() => tabrisApp.validateInstalledTabrisVersion())
        .to.throw(/App uses incompatible tabris version: 1.5.0, >= 2.0.0 required/);
    });

    it('throws if tabris version is invalid', function() {
      tabrisVersion = 'bogus.crap';
      tabrisApp.createCordovaProject(join(cwd, 'destination'));

      expect(() => tabrisApp.validateInstalledTabrisVersion())
        .to.throw(/App uses invalid tabris version: bogus.crap/);
    });

  });

  describe('runPackageJsonBuildScripts', function() {

    let project;

    beforeEach(function() {
      project = new TabrisApp(cwd);
    });

    it('runs build scripts with platform', function() {
      project.runPackageJsonBuildScripts('foo');

      expect(proc.spawnSync).to.have.been.calledWith('npm', ['run', '--if-present', 'build:foo']);
      expect(proc.spawnSync).to.have.been.calledWith('npm', ['run', '--if-present', 'build']);
    });

  });

  describe('createCordovaProject', function() {

    let project;

    beforeEach(function() {
      project = new TabrisApp(cwd);
      proc.spawnSync.callsFake(() => {
        const tabrisModulePath = join(cwd, 'destination', 'www', 'app', 'node_modules', 'tabris');
        mkdirsSync(tabrisModulePath);
        writeFileSync(join(tabrisModulePath, 'package.json'), '{"version": "2.0.0+buildMetadata"}');
      });
    });

    it('copies project contents to destination/www/app', function() {
      mkdirSync(join(cwd, 'src'));
      mkdirSync(join(cwd, 'test'));
      writeFileSync(join(cwd, 'src/foo'), 'test');
      writeFileSync(join(cwd, 'test/foo'), 'test');

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination/www/app/src/foo'))).to.be.true;
      expect(existsSync(join(cwd, 'destination/www/app/test/foo'))).to.be.true;
    });

    it('deletes contents of www/app before copying project contents to destination/www/app', function() {
      mkdirsSync(join(cwd, 'destination/www/app'));
      writeFileSync(join(cwd, 'destination/www/app/obsoleted'), '');
      mkdirSync(join(cwd, 'src'));
      mkdirSync(join(cwd, 'test'));
      writeFileSync(join(cwd, 'src/foo'), 'test');
      writeFileSync(join(cwd, 'test/foo'), 'test');

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination/www/app/obsoleted'))).to.be.false;
    });

    it('copies cordova/ contents to destination/cordova', function() {
      mkdirSync(join(cwd, 'cordova/foo'));
      writeFileSync(join(cwd, 'cordova/foo/bar'), 'test');

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination/foo/bar'))).to.be.true;
    });

    it('excludes cordova build artifacts from copying to destination/cordova', function() {
      mkdirSync(join(cwd, 'cordova/foo'));
      writeFileSync(join(cwd, 'cordova/foo/bar'), 'test');
      mkdirSync(join(cwd, 'cordova/www'));
      writeFileSync(join(cwd, 'cordova/www/bar'), 'test');
      mkdirSync(join(cwd, 'cordova/platform'));
      mkdirSync(join(cwd, 'cordova/plugins'));

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination/foo/bar'))).to.be.true;
      expect(existsSync(join(cwd, 'destination/www/bar'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/platform'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/plugins'))).to.be.false;
    });

    it('excludes default blacklisted contents from copying to destination/www/app', function() {
      mkdirSync(join(cwd, '.git'));
      mkdirSync(join(cwd, 'build'));
      mkdirSync(join(cwd, 'node_modules'));
      writeFileSync(join(cwd, '.git/foo'), 'test');
      writeFileSync(join(cwd, 'build/foo'), 'test');
      writeFileSync(join(cwd, 'cordova/foo'), 'test');
      writeFileSync(join(cwd, 'node_modules/foo'), 'test');
      writeFileSync(join(cwd, '.tabrisignore'), 'test');

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination/www/app/.git'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/.tabrisignore'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/destination'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/build'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/cordova'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/node_modules/foo'))).to.be.false;
    });

    it('does not exclude cordova/ and build/ from app subdirectories', function() {
      mkdirsSync(join(cwd, 'subdir', 'build'));
      mkdirsSync(join(cwd, 'subdir', 'cordova'));
      writeFileSync(join(cwd, 'subdir/build/foo'), 'test');
      writeFileSync(join(cwd, 'subdir/cordova/foo'), 'test');

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination', 'www', 'app', 'subdir', 'build', 'foo'))).to.be.true;
      expect(existsSync(join(cwd, 'destination', 'www', 'app', 'subdir', 'cordova', 'foo'))).to.be.true;
    });

    it('excludes .tabrisignore contents from copying to destination/www/app', function() {
      mkdirSync(join(cwd, 'test'));
      mkdirSync(join(cwd, 'dist'));
      writeFileSync(join(cwd, 'test/foo'), 'test');
      writeFileSync(join(cwd, 'dist/foo'), 'test');
      writeFileSync(join(cwd, '.tabrisignore'), 'test/\ndist/\n');

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination/www/app/test'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/dist'))).to.be.false;
    });

    it('excludes folders with leading slash from copying to destination/www/app', function() {
      mkdirSync(join(cwd, 'test'));
      writeFileSync(join(cwd, 'test/foo'), 'test');
      writeFileSync(join(cwd, '.tabrisignore'), '/test/');

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination/www/app/test'))).to.be.false;
    });

    it('installs production dependencies in destination/www/app', function() {
      const destination = join(cwd, 'destination');

      project.createCordovaProject(destination);

      expect(proc.spawnSync)
        .to.have.been.calledWith('npm', ['install', '--production'], {cwd: path.join(destination, 'www', 'app')});
    });

    it('installs production dependencies using npm ci when package-lock.json exists', function() {
      const destination = join(cwd, 'destination');
      writeFileSync(join(cwd, 'package-lock.json'), '');

      project.createCordovaProject(destination);

      expect(proc.spawnSync)
        .to.have.been.calledWith('npm', ['ci', '--production'], {cwd: path.join(destination, 'www', 'app')});
    });

    it('installedTabrisVersion returns version without build metadata', function() {
      const destination = join(cwd, 'destination');
      writeFileSync(join(cwd, 'package-lock.json'), '');

      project.createCordovaProject(destination);

      expect(project.installedTabrisVersion).to.equal('2.0.0');
    });

  });

});
