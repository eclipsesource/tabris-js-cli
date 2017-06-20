const {join} = require('path');
const {readFileSync, writeFileSync, existsSync, realpathSync, mkdirsSync} = require('fs-extra');
const {spawnSync} = require('child_process');
const {createTmpDir} = require('./tmp');
const expect = require('chai').expect;
const packageJson = require('../package.json');

const tabris = join(__dirname, '../src/tabris');
const mockBinDir = join(__dirname, 'bin');

['run', 'build'].forEach(command => {

  describe(command, function() {

    this.timeout(10000);

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
        mkdirsSync(join(cwd, 'test_install/node_modules/tabris'));
        writeFileSync(join(cwd, 'test_install/node_modules/tabris/package.json'),
          `{"version": "${packageJson.version}"}`);
      });
    });

    it('fails with invalid platform argument', function() {
      let result = spawnSync('node', [tabris, command, 'foo'], opts);

      expect(result.stderr.trim()).to.equal('Invalid platform: foo');
    });

    for (let platform of ['android', 'ios', 'windows']) {
      it(`succeeds with platform '${platform}'`, function() {
        let result = spawnSync('node', [tabris, command, platform], opts);

        expect(result.status).to.equal(0);
      });
    }

    it('fails with debug and release both set', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--debug', '--release'], opts);

      expect(result.stderr.trim()).to.equal('Cannot specify both --release and --debug');
    });

    it('fails without platform environment variable', function() {
      env.TABRIS_ANDROID_PLATFORM = '';

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr.trim()).to.equal('Missing cordova platform spec, expected in $TABRIS_ANDROID_PLATFORM');
    });

    it('copies cordova/ contents to build/cordova', function() {
      mkdirsSync(join(cwd, 'cordova/foo'));
      writeFileSync(join(cwd, 'cordova/foo/bar'), 'test');

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.status).to.equal(0);
      expect(existsSync(join(cwd, 'build/cordova/foo/bar'))).to.be.true;
    });

    it('copies project contents to build/cordova/www/app', function() {
      mkdirsSync(join(cwd, 'src'));
      mkdirsSync(join(cwd, 'test'));
      writeFileSync(join(cwd, 'src/foo'), 'test');
      writeFileSync(join(cwd, 'test/foo'), 'test');

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.status).to.equal(0);
      expect(existsSync(join(cwd, 'build/cordova/www/app/src/foo'))).to.be.true;
      expect(existsSync(join(cwd, 'build/cordova/www/app/test/foo'))).to.be.true;
    });

    it('calls cordova commands', function() {
      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.status).to.equal(0);
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
    });

    it('passes --buildConfig to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--cordova-build-config=foo'], opts);

      expect(result.status).to.equal(0);
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --buildConfig=foo --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
    });

    it('passes --device to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--device'], opts);

      expect(result.status).to.equal(0);
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --device --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
    });

    it('passes --emulator to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--emulator'], opts);

      expect(result.status).to.equal(0);
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --emulator --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
    });

    it('passes --verbose to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--verbose'], opts);

      expect(result.status).to.equal(0);
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --verbose --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --verbose --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
    });

    it('replaces given variables in config.xml', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2</name></widget>');

      spawnSync('node', [tabris, command, 'android', '--variables', 'VAR1=foo,VAR2=bar'], opts);

      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>foo bar</name>');
    });

    it('replaces environment variables in config.xml', function() {
      Object.assign(env, {VAR1: 'foo', VAR2: 'bar'});
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2</name></widget>');

      spawnSync('node', [tabris, command, 'android'], opts);

      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>foo bar</name>');
    });

    it('replaces IS_DEBUG and IS_RELEASE in debug build', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget><name>$IS_DEBUG $IS_RELEASE</name></widget>');

      spawnSync('node', [tabris, command, 'android', '--debug'], opts);

      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>true false</name>');
    });

    it('replaces IS_DEBUG and IS_RELEASE in release build', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget><name>$IS_DEBUG $IS_RELEASE</name></widget>');

      spawnSync('node', [tabris, command, 'android', '--release'], opts);

      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>false true</name>');
    });

    it('replaces environment variables and given variables in config.xml', function() {
      Object.assign(env, {VAR1: 'foo', VAR2: 'bar'});
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2 $VAR3</name></widget>');

      spawnSync('node', [tabris, command, 'android', '--variables', 'VAR3=baz'], opts);

      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>foo bar baz</name>');
    });

    it('given variables have precedence over environment variables', function() {
      Object.assign(env, {VAR1: 'foo', VAR2: 'bar'});
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2</name></widget>');

      spawnSync('node', [tabris, command, 'android', '--variables', 'VAR1=baz'], opts);

      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>baz bar</name>');
    });

    it('does not replace environment variables when --no-replace-env-vars is given', function() {
      Object.assign(env, {VAR1: 'foo', VAR2: 'bar'});
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2 $VAR3</name></widget>');

      spawnSync('node', [tabris, command, 'android', '--no-replace-env-vars', '--variables', 'VAR3=baz'], opts);

      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>$VAR1 $VAR2 baz</name>');
    });

    it('does not fail when config.xml exists, but no --variables given', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.status).to.equal(0);
    });

  });

});

