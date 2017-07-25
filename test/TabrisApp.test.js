const {mkdirsSync, mkdirSync, existsSync, removeSync, writeFileSync, realpathSync} = require('fs-extra');
const {join} = require('path');
const temp = require('temp').track();
const proc = require('../src/helpers/proc');
const log = require('../src/helpers/log');
const {expect, stub, restore} = require('./test');
const TabrisApp = require('../src/services/TabrisApp');

describe('TabrisApp', function() {

  let cwd;

  beforeEach(function() {
    stub(log, 'command');
    stub(proc, 'execSync');
    let dir = temp.mkdirSync('test');
    cwd = realpathSync(dir);
    writeFileSync(join(cwd, 'package.json'), '{"main": "foo.js"}');
    mkdirSync(join(cwd, 'cordova'));
  });

  afterEach(() => restore());

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

    beforeEach(function() {
      tabrisApp = new TabrisApp(cwd);
      mkdirsSync(join(cwd, 'www', 'app', 'node_modules', 'tabris'));
    });

    it('does not throw if tabris has lower patch version', function() {
      tabrisApp._installedTabrisVersion = '2.0.0';
      expect(() => tabrisApp.validateInstalledTabrisVersion('2.0.1'))
        .not.to.throw();
    });

    it('does not throw if tabris has higher patch version', function() {
      tabrisApp._installedTabrisVersion = '2.0.2';
      expect(() => tabrisApp.validateInstalledTabrisVersion('2.0.1'))
        .not.to.throw();
    });

    it('throws if tabris version is lower', function() {
      tabrisApp._installedTabrisVersion = '2.0.0';
      expect(() => tabrisApp.validateInstalledTabrisVersion('2.1.3'))
        .to.throw(/App uses incompatible tabris version: 2.0.0, 2.1.x required/);
    });

    it('throws if tabris version is higher', function() {
      tabrisApp._installedTabrisVersion = '2.2.0';
      expect(() => tabrisApp.validateInstalledTabrisVersion('2.1.3'))
        .to.throw(/App uses incompatible tabris version: 2.2.0, 2.1.x required/);
    });

    it('throws if tabris version is invalid', function() {
      tabrisApp._installedTabrisVersion = 'bogus.crap';
      expect(() => tabrisApp.validateInstalledTabrisVersion('2.1.3'))
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

      expect(proc.execSync).to.have.been.calledWith('npm', ['run', '--if-present', 'build:foo']);
      expect(proc.execSync).to.have.been.calledWith('npm', ['run', '--if-present', 'build']);
    });

  });

  describe('createCordovaProject', function() {

    let project;

    beforeEach(function() {
      project = new TabrisApp(cwd);
      proc.execSync.callsFake(() => {
        let tabrisModulePath = join(cwd, 'destination', 'www', 'app', 'node_modules', 'tabris');
        mkdirsSync(tabrisModulePath);
        writeFileSync(join(tabrisModulePath, 'package.json'), '{"version": "2.0.0"}');
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

    it('copies cordova/ contents to destination/cordova', function() {
      mkdirSync(join(cwd, 'cordova/foo'));
      writeFileSync(join(cwd, 'cordova/foo/bar'), 'test');

      project.createCordovaProject(join(cwd, 'destination'));

      expect(existsSync(join(cwd, 'destination/foo/bar'))).to.be.true;
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
      expect(existsSync(join(cwd, 'destination/www/app/destination'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/cordova'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/node_modules/foo'))).to.be.false;
      expect(existsSync(join(cwd, 'destination/www/app/.tabrisignore'))).to.be.false;
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

    it('installs production dependencies in destination/www/app', function() {
      let destination = join(cwd, 'destination');

      project.createCordovaProject(destination);

      expect(proc.execSync)
        .to.have.been.calledWith('npm', ['install', '--production'], {cwd: `${destination}/www/app`});
    });

  });

});
