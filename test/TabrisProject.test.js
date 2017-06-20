const {mkdirSync, existsSync, removeSync, writeFileSync, realpathSync} = require('fs-extra');
const {join} = require('path');
const {createTmpDir} = require('./tmp');
const proc = require('../src/proc');
const {expect, stub, restore} = require('./test');
const TabrisProject = require('../src/TabrisProject');

describe('TabrisProject', function() {

  let cwd;

  beforeEach(function() {
    stub(console, 'log');
    return createTmpDir('test').then(dir => {
      cwd = realpathSync(dir);
      stub(proc, 'exec');
      writeFileSync(join(cwd, 'package.json'), '{}');
      mkdirSync(join(cwd, 'cordova'));
    });
  });

  afterEach(() => restore());

  describe('constructor', function() {

    it('fails if package.json is missing', function() {
      removeSync(join(cwd, 'package.json'));

      expect(() => new TabrisProject(cwd)).to.throw('Could not find package.json');
    });

    it('fails if cordova/ is missing', function() {
      removeSync(join(cwd, 'cordova'));

      expect(() => new TabrisProject(cwd)).to.throw('Could not find cordova directory');
    });

  });

  describe('runPackageJsonBuildScripts', function() {

    let project;

    beforeEach(function() {
      project = new TabrisProject(cwd);
    });

    it('runs build scripts with platform', function() {
      project.runPackageJsonBuildScripts('foo');

      expect(proc.exec).to.have.been.calledWith('npm', ['run', '--if-present', 'build:foo']);
      expect(proc.exec).to.have.been.calledWith('npm', ['run', '--if-present', 'build']);
    });

  });

  describe('createCordovaProject', function() {

    let project;

    beforeEach(function() {
      project = new TabrisProject(cwd);
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
      expect(existsSync(join(cwd, 'destination/www/app/node_modules'))).to.be.false;
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
      let destination = join(cwd, 'foo');

      project.createCordovaProject(destination);

      expect(proc.exec).to.have.been.calledWith('npm', ['install', '--production'], {cwd: `${destination}/www/app`});
    });

  });

});
