const {join} = require('path');
const {readFileSync, writeFileSync, existsSync, realpathSync} = require('fs');
const {spawnSync} = require('child_process');
const {mkdirsSync} = require('fs-extra');
const {createTmpDir} = require('./tmp');
const expect = require('chai').expect;

const tabris = join(__dirname, '../src/tabris');
const mockBinDir = join(__dirname, 'bin');

describe('build', function() {

  let cwd, env, opts;

  beforeEach(function() {
    return createTmpDir('test').then(dir => {
      cwd = realpathSync(dir);
      env = {
        PATH: mockBinDir + ':' + process.env.PATH,
        TABRIS_ANDROID_PLATFORM: 'path/to/tabris-android',
        TABRIS_IOS_PLATFORM: 'path/to/tabris-ios',
        TABRIS_WINDOWS_PLATFORM: 'path/to/tabris-windows'
      };
      opts = {cwd, env, encoding: 'utf8'};
      mkdirsSync(join(cwd, 'cordova'));
      writeFileSync(join(cwd, 'package.json'), '{}');
    });
  });

  it('fails with invalid platform argument', function() {
    let result = spawnSync('node', [tabris, 'build', 'foo'], opts);

    expect(result.stderr.trim()).to.equal('Invalid platform: foo');
  });

  for (let platform of ['android', 'ios', 'windows']) {
    it(`succeeds with platform '${platform}'`, function() {
      let result = spawnSync('node', [tabris, 'build', platform], opts);

      expect(result.status).to.equal(0);
    });
  }

  it('fails with debug and release both set', function() {
    let result = spawnSync('node', [tabris, 'build', 'android', '--debug', '--release'], opts);

    expect(result.stderr.trim()).to.equal('Cannot specify both --release and --debug');
  });

  it('fails without platform environment variable', function() {
    env.TABRIS_ANDROID_PLATFORM = '';

    let result = spawnSync('node', [tabris, 'build', 'android'], opts);

    expect(result.stderr.trim()).to.equal('Missing cordova platform spec, expected in $TABRIS_ANDROID_PLATFORM');
  });

  it('copies cordova/ contents to build/cordova', function() {
    mkdirsSync(join(cwd, 'cordova/foo'));
    writeFileSync(join(cwd, 'cordova/foo/bar'), 'test');

    let result = spawnSync('node', [tabris, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(existsSync(join(cwd, 'build/cordova/foo/bar'))).to.be.true;
  });

  it('copies project contents to build/cordova/www', function() {
    mkdirsSync(join(cwd, 'src'));
    mkdirsSync(join(cwd, 'test'));
    writeFileSync(join(cwd, 'src/foo'), 'test');
    writeFileSync(join(cwd, 'test/foo'), 'test');

    let result = spawnSync('node', [tabris, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(existsSync(join(cwd, 'build/cordova/www/src/foo'))).to.be.true;
    expect(existsSync(join(cwd, 'build/cordova/www/test/foo'))).to.be.true;
  });

  it('calls cordova commands', function() {
    let result = spawnSync('node', [tabris, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`CORDOVA platform add path/to/tabris-android [${join(cwd, 'build/cordova')}]`);
    expect(result.stdout).to.contain(`CORDOVA build [${join(cwd, 'build/cordova')}]`);
  });

  it('replaces variables in config.xml', function() {
    writeFileSync(join(cwd, 'cordova', 'config.xml'), '$VAR1 $VAR2');

    spawnSync('node', [tabris, 'build', 'android', '--variables', 'VAR1=foo,VAR2=bar'], opts);

    let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
    expect(configXmlContents).to.equal('foo bar');
  });

  it('does not fail when config.xml exists, but no --variables given', function() {
    writeFileSync(join(cwd, 'cordova', 'config.xml'), '$VAR1 $VAR2');

    let result = spawnSync('node', [tabris, 'build', 'android'], opts);

    expect(result.status).to.equal(0);
  });

});
