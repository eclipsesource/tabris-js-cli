const {join} = require('path');
const {readFileSync, writeFileSync, existsSync, realpathSync, mkdirsSync, removeSync} = require('fs-extra');
const {spawnSync} = require('child_process');
const expect = require('chai').expect;
const temp = require('temp');
const {platform} = require('os');
const packageJson = require('../package.json');
const {restore} = require('./test');

const tabris = join(__dirname, '../src/tabris');
const mockBinDir = join(__dirname, 'bin');

['run', 'build'].forEach(command => {

  describe(command, function() {

    this.timeout(10000);

    let cwd, env, opts, home;

    beforeEach(function() {
      let dir = temp.mkdirSync('test');
      cwd = realpathSync(dir);
      home = join(cwd, 'test_home');
      mkdirsSync(join(home, '.tabris-cli', 'platforms', 'ios', packageJson.version));
      mkdirsSync(join(home, '.tabris-cli', 'platforms', 'android', packageJson.version));
      mkdirsSync(join(home, '.tabris-cli', 'platforms', 'windows', packageJson.version));
      env = {
        HOME: home,
        USERPROFILE: home,
        APPDATA: 'appdata',
        PATH: mockBinDir + (platform() === 'win32' ? ';' : ':') + process.env.PATH,
        TABRIS_ANDROID_PLATFORM: 'path/to/tabris-android',
        TABRIS_IOS_PLATFORM: 'path/to/tabris-ios',
        TABRIS_WINDOWS_PLATFORM: 'path/to/tabris-windows'
      };
      opts = {cwd, env, encoding: 'utf8'};
      mkdirsSync(join(cwd, 'cordova'));
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"></widget>');
      writeFileSync(join(cwd, 'package.json'), '{"main": "foo.js"}');
      mkdirsSync(join(cwd, 'test_install/node_modules/tabris'));
      writeFileSync(join(cwd, 'test_install/node_modules/tabris/package.json'),
        `{"version": "${packageJson.version}"}`);
    });

    afterEach(restore);

    it('fails with invalid platform argument', function() {
      let result = spawnSync('node', [tabris, command, 'foo'], opts);

      expect(result.stderr.trim()).to.equal('Invalid platform: foo');
      expect(result.status).to.equal(1);
    });

    for (let platform of ['android', 'ios', 'windows']) {
      it(`succeeds with platform '${platform}'`, function() {
        let truthy = x => !!x;
        let isWindows = platform === 'windows';
        let isBuild = command === 'build';
        let archArgument = isBuild && isWindows && '--arch=x86';

        let result = spawnSync('node', [tabris, command, platform, archArgument].filter(truthy), opts);

        expect(result.stderr).to.equal('');
        expect(result.status).to.equal(0);
      });
    }

    it('fails with debug and release both set', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--debug', '--release'], opts);

      expect(result.stderr.trim()).to.equal('Cannot specify both --release and --debug');
      expect(result.status).to.equal(1);
    });

    it('fails when config.xml is missing', function() {
      removeSync(join(cwd, 'cordova', 'config.xml'));

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr.trim()).to.match(/config\.xml does not exist at cordova.config\.xml/);
      expect(result.status).to.equal(1);
    });

    it('copies cordova/ contents to build/cordova', function() {
      mkdirsSync(join(cwd, 'cordova/foo'));
      writeFileSync(join(cwd, 'cordova/foo/bar'), 'test');

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr).to.equal('');
      expect(existsSync(join(cwd, 'build/cordova/foo/bar'))).to.be.true;
      expect(result.status).to.equal(0);
    });

    it('copies JavaScript files to build/cordova/www/app', function() {
      mkdirsSync(join(cwd, 'src'));
      mkdirsSync(join(cwd, 'test'));
      writeFileSync(join(cwd, 'src/foo'), 'test');
      writeFileSync(join(cwd, 'test/foo'), 'test');

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr).to.equal('');
      expect(existsSync(join(cwd, 'build/cordova/www/app/src/foo'))).to.be.true;
      expect(existsSync(join(cwd, 'build/cordova/www/app/test/foo'))).to.be.true;
      expect(result.status).to.equal(0);
    });

    it('creates build-key.sha256 in build/cordova/www/app', function() {
      writeFileSync(join(home, '.tabris-cli', 'build.key'), 'key');
      let buildKeyHashPath = join(cwd, 'build/cordova/www/build-key.sha256');
      let buildKeyHash = '2c70e12b7a0646f92279f427c7b38e7334d8e5389cff167a1dc30e73f826b683';

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr).to.equal('');
      expect(readFileSync(buildKeyHashPath, 'utf8')).to.equal(buildKeyHash);
      expect(result.status).to.equal(0);
    });

    it('calls cordova commands', function() {
      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr).to.equal('');
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.status).to.equal(0);
    });

    it('passes --buildConfig to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--cordova-build-config=foo'], opts);

      expect(result.stderr).to.equal('');
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --buildConfig=foo --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.status).to.equal(0);
    });

    it('passes --device to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--device'], opts);

      expect(result.stderr).to.equal('');
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --device --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.status).to.equal(0);
    });

    it('passes --emulator to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--emulator'], opts);

      expect(result.stderr).to.equal('');
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --emulator --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.status).to.equal(0);
    });

    it('passes --verbose to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--verbose'], opts);

      expect(result.stderr).to.equal('');
      expect(result.stdout).to.contain(
        `CORDOVA platform add path/to/tabris-android --verbose --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --verbose --no-update-notifier [${join(cwd, 'build/cordova')}]`
      );
      expect(result.status).to.equal(0);
    });

    it('passes platformOpts to Cordova', function() {
      let result = spawnSync('node', [tabris, command, 'android', '--', '--foo=bar', '--baz=foo'], opts);

      expect(result.stderr).to.equal('');
      expect(result.stdout).to.contain(
        `CORDOVA ${command} android --no-update-notifier -- --foo=bar --baz=foo [${join(cwd, 'build/cordova')}]`
      );
      expect(result.status).to.equal(0);
    });

    it('replaces given variables in config.xml', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android', '--variables', 'VAR1=foo,VAR2=bar'], opts);

      expect(result.stderr).to.equal('');
      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>foo bar</name>');
      expect(result.status).to.equal(0);
    });

    it('replaces environment variables in config.xml', function() {
      Object.assign(env, {VAR1: 'foo', VAR2: 'bar'});
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr).to.equal('');
      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>foo bar</name>');
      expect(result.status).to.equal(0);
    });

    it('replaces IS_DEBUG and IS_RELEASE in default build', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'),
        '<widget id="test"><name>$IS_DEBUG $IS_RELEASE</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr).to.equal('');
      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>true false</name>');
      expect(result.status).to.equal(0);
    });

    it('replaces IS_DEBUG and IS_RELEASE in debug build', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'),
        '<widget id="test"><name>$IS_DEBUG $IS_RELEASE</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android', '--debug'], opts);

      expect(result.stderr).to.equal('');
      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>true false</name>');
      expect(result.status).to.equal(0);
    });

    it('replaces IS_DEBUG and IS_RELEASE in release build', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'),
        '<widget id="test"><name>$IS_DEBUG $IS_RELEASE</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android', '--release'], opts);

      expect(result.stderr).to.equal('');
      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>false true</name>');
      expect(result.status).to.equal(0);
    });

    it('replaces environment variables and given variables in config.xml', function() {
      Object.assign(env, {VAR1: 'foo', VAR2: 'bar'});
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2 $VAR3</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android', '--variables', 'VAR3=baz'], opts);

      expect(result.stderr).to.equal('');
      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>foo bar baz</name>');
      expect(result.status).to.equal(0);
    });

    it('given variables have precedence over environment variables', function() {
      Object.assign(env, {VAR1: 'foo', VAR2: 'bar'});
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android', '--variables', 'VAR1=baz'], opts);

      expect(result.stderr).to.equal('');
      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>baz bar</name>');
      expect(result.status).to.equal(0);
    });

    it('does not replace environment variables when --no-replace-env-vars is given', function() {
      Object.assign(env, {VAR1: 'foo', VAR2: 'bar'});
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2 $VAR3</name></widget>');

      let result = spawnSync('node', [
        tabris,
        command,
        'android',
        '--no-replace-env-vars',
        '--variables',
        'VAR3=baz'
      ], opts);

      expect(result.stderr).to.equal('');
      let configXmlContents = readFileSync(join(cwd, 'build/cordova/config.xml')).toString();
      expect(configXmlContents).to.contain('<name>$VAR1 $VAR2 baz</name>');
      expect(result.status).to.equal(0);
    });

    it('does not fail when config.xml exists, but no --variables given', function() {
      writeFileSync(join(cwd, 'cordova', 'config.xml'), '<widget id="test"><name>$VAR1 $VAR2</name></widget>');

      let result = spawnSync('node', [tabris, command, 'android'], opts);

      expect(result.stderr).to.equal('');
      expect(result.status).to.equal(0);
    });

    if (command === 'build') {

      describe('--arch', function() {

        it('fails when used with an unsupported value', function() {
          let result = spawnSync('node', [tabris, 'build', 'windows', '--arch=foo'], opts);

          expect(result.stderr.trim()).to.equal('--arch can only be one of "x86", "x64" and "arm"');
          expect(result.status).to.equal(1);
        });

        it('fails when used with an unsupported platform', function() {
          let result = spawnSync('node', [tabris, 'build', 'android', '--arch=x86'], opts);

          expect(result.stderr.trim()).to.equal('--arch is only supported for Windows builds');
          expect(result.status).to.equal(1);
        });

        it('fails when used with more than one architecture', function() {
          let result = spawnSync('node', [tabris, 'build', 'windows', '--arch="x86 x64"'], opts);

          expect(result.stderr.trim()).to.equal('--arch only accepts a single architecture');
          expect(result.status).to.equal(1);
        });

        it('fails when building for Windows without --arch', function() {
          let result = spawnSync('node', [tabris, 'build', 'windows'], opts);

          expect(result.stderr.trim()).to.equal('--arch must be given for Windows builds');
          expect(result.status).to.equal(1);
        });

        it('passes --archs to Cordova', function() {
          let result = spawnSync('node', [tabris, 'build', 'windows', '--arch', 'x86'], opts);

          expect(result.stderr).to.equal('');
          expect(result.stdout).to.contain(
            `CORDOVA platform add path/to/tabris-windows --no-update-notifier [${join(cwd, 'build/cordova')}]`
          );
          expect(result.stdout).to.contain(
            `CORDOVA build windows --archs=x86 --no-update-notifier [${join(cwd, 'build/cordova')}]`
          );
          expect(result.status).to.equal(0);
        });

      });

    }

    if (command === 'run') {

      it('passes --target to Cordova', function() {
        let result = spawnSync('node', [tabris, 'run', 'android', '--target=foo'], opts);

        expect(result.stderr).to.equal('');
        expect(result.stdout).to.contain(
          `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
        );
        expect(result.stdout).to.contain(
          `CORDOVA ${command} android --target=foo --no-update-notifier [${join(cwd, 'build/cordova')}]`
        );
        expect(result.status).to.equal(0);
      });

      it('passes --list to Cordova', function() {
        let result = spawnSync('node', [tabris, 'run', 'android', '--list-targets'], opts);

        expect(result.stderr).to.equal('');
        expect(result.stdout).to.contain(
          `CORDOVA platform add path/to/tabris-android --no-update-notifier [${join(cwd, 'build/cordova')}]`
        );
        expect(result.stdout).to.contain(
          `CORDOVA ${command} android --list --no-update-notifier [${join(cwd, 'build/cordova')}]`
        );
        expect(result.status).to.equal(0);
      });

    }

  });

});

