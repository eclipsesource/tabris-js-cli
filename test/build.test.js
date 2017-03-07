const {join} = require('path');
const {writeFileSync, statSync, existsSync} = require('fs');
const {spawnSync} = require('child_process');
const {mkdirsSync, removeSync} = require('fs-extra');
const temp = require('temp').track();
const expect = require('chai').expect;

const file = join(__dirname, '../src/tabris');
const mockBinDir = join(__dirname, 'bin');

describe('build', function() {

  let cwd, env, opts;

  beforeEach(function() {
    return createTmpDir('test').then(dir => {
      cwd = dir;
      env = {
        PATH: mockBinDir + ':' + process.env.PATH,
        TABRIS_ANDROID_PLATFORM: 'path/to/tabris-android'
      };
      opts = {cwd, env, encoding: 'utf8'};
      mkdirsSync(join(cwd, 'cordova'));
      writeFileSync(join(cwd, 'package.json'), '{}');
    });
  });

  it('fails without platform argument', function() {
    let result = spawnSync('node', [file, 'build'], opts);

    expect(result.stderr.trim()).to.equal('Missing platform');
  });

  it('fails with invalid platform argument', function() {
    let result = spawnSync('node', [file, 'build', 'foo'], opts);

    expect(result.stderr.trim()).to.equal('Invalid platform: foo');
  });

  it('fails without platform environment variable', function() {
    env.TABRIS_ANDROID_PLATFORM = '';

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.stderr.trim()).to.equal('Missing cordova platform spec, expected in $TABRIS_ANDROID_PLATFORM');
  });

  it('fails if package.json is missing', function() {
    removeSync(join(cwd, 'package.json'));

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.stderr.trim()).to.equal('Could not find package.json');
  });

  it('fails if cordova/ is missing', function() {
    removeSync(join(cwd, 'cordova'));

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.stderr.trim()).to.equal('Could not find cordova directory');
  });

  it('succeeds', function() {
    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
  });

  it('creates a new build/cordova/www folder', function() {
    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(statSync(join(cwd, 'build/cordova/www')).isDirectory()).to.be.true;
  });

  it('cleans existing build/cordova folder', function() {
    mkdirsSync(join(cwd, 'build/cordova/foo'));

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(existsSync(join(cwd, 'build/cordova/foo'))).to.be.false;
  });

  it('does not clean existing build folder', function() {
    mkdirsSync(join(cwd, 'build/foo'));
    writeFileSync(join(cwd, 'build/foo/bar'), 'test');

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(existsSync(join(cwd, 'build/foo/bar'))).to.be.true;
  });

  it('copies cordova/ contents to build/cordova', function() {
    mkdirsSync(join(cwd, 'cordova/foo'));
    writeFileSync(join(cwd, 'cordova/foo/bar'), 'test');

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(existsSync(join(cwd, 'build/cordova/foo/bar'))).to.be.true;
  });

  it('copies project contents to build/cordova/www', function() {
    mkdirsSync(join(cwd, 'src'));
    mkdirsSync(join(cwd, 'test'));
    writeFileSync(join(cwd, 'src/foo'), 'test');
    writeFileSync(join(cwd, 'test/foo'), 'test');

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(existsSync(join(cwd, 'build/cordova/www/src/foo'))).to.be.true;
    expect(existsSync(join(cwd, 'build/cordova/www/test/foo'))).to.be.true;
  });

  it('excludes default blacklisted contents from copying to build/cordova/www', function() {
    mkdirsSync(join(cwd, '.git'));
    mkdirsSync(join(cwd, 'build'));
    mkdirsSync(join(cwd, 'cordova'));
    mkdirsSync(join(cwd, 'node_modules'));
    writeFileSync(join(cwd, '.git/foo'), 'test');
    writeFileSync(join(cwd, 'build/foo'), 'test');
    writeFileSync(join(cwd, 'cordova/foo'), 'test');
    writeFileSync(join(cwd, 'node_modules/foo'), 'test');
    writeFileSync(join(cwd, '.tabrisignore'), 'test');

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(existsSync(join(cwd, 'build/cordova/www/.git'))).to.be.false;
    expect(existsSync(join(cwd, 'build/cordova/www/build'))).to.be.false;
    expect(existsSync(join(cwd, 'build/cordova/www/cordova'))).to.be.false;
    expect(existsSync(join(cwd, 'build/cordova/www/node_modules'))).to.be.false;
    expect(existsSync(join(cwd, 'build/cordova/www/.tabrisignore'))).to.be.false;
  });

  it('excludes .tabrisignore contents from copying to build/cordova/www', function() {
    mkdirsSync(join(cwd, 'test'));
    mkdirsSync(join(cwd, 'dist'));
    writeFileSync(join(cwd, 'test/foo'), 'test');
    writeFileSync(join(cwd, 'dist/foo'), 'test');
    writeFileSync(join(cwd, '.tabrisignore'), 'test/\ndist/\n');

    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(existsSync(join(cwd, 'build/cordova/www/test'))).to.be.false;
    expect(existsSync(join(cwd, 'build/cordova/www/dist'))).to.be.false;
  });

  it('calls npm commands', function() {
    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`NPM run --if-present build:android [${cwd}]`);
    expect(result.stdout).to.contain(`NPM run --if-present build [${cwd}]`);
    expect(result.stdout).to.contain(`NPM install --production [${join(cwd, 'build/cordova/www')}]`);
  });

  it('calls cordova commands', function() {
    let result = spawnSync('node', [file, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`CORDOVA platform add path/to/tabris-android [${join(cwd, 'build/cordova')}]`);
    expect(result.stdout).to.contain(`CORDOVA build [${join(cwd, 'build/cordova')}]`);
  });

});

function createTmpDir(name) {
  return new Promise((resolve, reject) => {
    temp.mkdir(name, (err, path) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}
