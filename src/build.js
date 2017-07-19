const crypto = require('crypto');
const os = require('os');
const {join} = require('path');
const {writeFile, existsSync, readFileSync} = require('fs-extra');
const program = require('commander');
const {handleErrors, fail} = require('./errorHandler');
const {parseVariables} = require('./argumentsParser');

const APP_DIR = '.';
const CORDOVA_PROJECT_DIR = 'build/cordova';
const CLI_DATA_DIR = join(os.homedir(), '.tabris-cli');

const PARAMS_DESCRIPTION = `

  <platform>:\t\t\tandroid, ios or windows
  [cordova-platform-opts...]:\tplatform-specific options passed to Cordova
`;
const BUILD_DESCRIPTION = `Builds a Tabris.js app. ${PARAMS_DESCRIPTION}`;
const RUN_DESCRIPTION = `Builds a Tabris.js app and runs it on a connected device or emulator. ${PARAMS_DESCRIPTION}`;
const VARIABLES_DESCRIPTION = `comma separated list of variable replacements in config.xml
\t\t\t\te.g. --variables FOO=bar replaces all "$FOO" with "bar".`;
const CORDOVA_BUILD_CONFIG_DESCRIPTION =
  'path to a build configuration file passed to Cordova (relative to cordova/ directory)';

registerBuildCommand('build', BUILD_DESCRIPTION);
registerBuildCommand('run', RUN_DESCRIPTION);

function registerBuildCommand(name, description) {
  program
    .command(`${name} <platform> [cordova-platform-opts...]`)
    .option('--variables <replacements>', VARIABLES_DESCRIPTION, parseVariables)
    .option('--cordova-build-config <path>', CORDOVA_BUILD_CONFIG_DESCRIPTION)
    .option('--debug', 'perform a debug build')
    .option('--device', 'build the app for a device')
    .option('--emulator', 'build the app for an emulator')
    .option('--release', 'perform a release build')
    .option('--no-replace-env-vars', 'do not replace environment variables in config.xml')
    .option('--verbose', 'print more verbose output')
    .description(description)
    .action(handleErrors((platform, cordovaPlatformOpts, options) => {
      const TabrisApp = require('./TabrisApp');
      const PlatformProvider = require('./PlatformProvider');
      const ConfigXml = require('./ConfigXml');
      const packageJson = require('../package.json');
      const {join} = require('path');
      const {existsSync} = require('fs-extra');

      validateArguments({platform, debug: options.debug, release: options.release});
      let variableReplacements = Object.assign({
        IS_DEBUG: !!options.debug,
        IS_RELEASE: !!options.release
      }, options.replaceEnvVars && process.env, options.variables);
      let {installedTabrisVersion} = new TabrisApp(APP_DIR)
        .runPackageJsonBuildScripts(platform)
        .createCordovaProject(CORDOVA_PROJECT_DIR)
        .validateInstalledTabrisVersion(packageJson.version);
      let configXmlPath = join(CORDOVA_PROJECT_DIR, 'config.xml');
      if (existsSync(configXmlPath)) {
        ConfigXml.readFrom(configXmlPath)
          .adjustContentPath()
          .replaceVariables(variableReplacements)
          .writeTo(configXmlPath);
      }
      new PlatformProvider(CLI_DATA_DIR).getPlatform({platform, version: installedTabrisVersion})
        .then(platformSpec => {
          return copyBuildKeyHash().then(() =>
            executeCordovaCommands({name, platform, platformSpec, cordovaPlatformOpts, options})
          );
        })
        .catch(fail);
    }));
}

function executeCordovaCommands({name, platform, platformSpec, options, cordovaPlatformOpts}) {
  const CordovaCli = require('./CordovaCli');

  let platformAddOptions = [options.verbose && 'verbose'];
  let platformCommandOptions = [
    options.release && 'release' || options.debug && 'debug',
    options.device && 'device',
    options.emulator && 'emulator',
    options.cordovaBuildConfig && `buildConfig=${options.cordovaBuildConfig}`,
    options.verbose && 'verbose'
  ];
  new CordovaCli(CORDOVA_PROJECT_DIR)
    .platformAddSafe(platform, platformSpec, {options: platformAddOptions})
    .platformCommand(name, platform, {options: platformCommandOptions, cordovaPlatformOpts});
}

function validateArguments({debug, release, platform}) {
  const {fail} = require('./errorHandler');

  if (debug && release) {
    fail('Cannot specify both --release and --debug');
  }
  if (!['android', 'ios', 'windows'].includes(platform)) {
    fail('Invalid platform: ' + platform);
  }
}

function copyBuildKeyHash() {
  let buildKeyPath = join(CLI_DATA_DIR, 'build.key');
  let buildKeyHashPath = join(CORDOVA_PROJECT_DIR, 'www', 'build-key.sha256');
  return new Promise((resolve, reject) => {
    if (!existsSync(buildKeyPath)) {
      return resolve();
    }
    let hash = crypto.createHash('sha256');
    hash.on('readable', () => {
      let data = hash.read();
      if (data) {
        writeFile(buildKeyHashPath, data.toString('hex'))
          .then(resolve)
          .catch(reject);
      }
    });
    hash.write(readFileSync(buildKeyPath, 'utf8').trim());
    hash.end();
  });
}

