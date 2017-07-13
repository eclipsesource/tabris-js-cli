const {join} = require('path');
const {existsSync} = require('fs-extra');
const program = require('commander');
const {fail, handleErrors} = require('./errorHandler');
const TabrisApp = require('./TabrisApp');
const CordovaCli = require('./CordovaCli');
const BuildKeyProvider = require('./BuildKeyProvider');
const PlatformDownloader = require('./PlatformDownloader');
const ConfigXml = require('./ConfigXml');
const {parseVariables} = require('./argumentsParser');
const {homedir} = require('os');
const packageJson = require('../package.json');

const APP_DIR = '.';
const CORDOVA_PROJECT_DIR = 'build/cordova';
const CLI_DATA_DIR = join(homedir(), '.tabris-cli');
const PLATFORMS_DIR = join(CLI_DATA_DIR, 'platforms');

const PARAMS_DESCRIPTION = `

  <platform>:\t\tandroid, ios or windows
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
    .command(`${name} <platform>`)
    .option('--variables <replacements>', VARIABLES_DESCRIPTION, parseVariables)
    .option('--cordova-build-config <path>', CORDOVA_BUILD_CONFIG_DESCRIPTION)
    .option('--debug', 'perform a debug build')
    .option('--device', 'build the app for a device')
    .option('--emulator', 'build the app for an emulator')
    .option('--release', 'perform a release build')
    .option('--no-replace-env-vars', 'do not replace environment variables in config.xml')
    .option('--verbose', 'print more verbose output')
    .description(description)
    .action(handleErrors((platform, options) => {
      let variableReplacements = Object.assign({
        IS_DEBUG: !!options.debug,
        IS_RELEASE: !!options.release
      }, options.replaceEnvVars && process.env, options.variables);
      let platformEnvVar = `TABRIS_${platform.toUpperCase()}_PLATFORM`;
      let platformSpec = process.env[platformEnvVar];
      validateArguments({platform, debug: options.debug, release: options.release});
      let {installedTabrisVersion} = new TabrisApp(APP_DIR)
        .runPackageJsonBuildScripts(platform)
        .createCordovaProject(CORDOVA_PROJECT_DIR)
        .validateInstalledTabrisVersion(`~${packageJson.version}`);
      let configXmlPath = join(CORDOVA_PROJECT_DIR, 'config.xml');
      if (existsSync(configXmlPath)) {
        ConfigXml.readFrom(configXmlPath)
          .adjustContentPath()
          .replaceVariables(variableReplacements)
          .writeTo(configXmlPath);
      }
      if (platformSpec) {
        executeCordovaCommands({name, platform, platformSpec, options});
      } else {
        new BuildKeyProvider(CLI_DATA_DIR).getBuildKey()
          .then(buildKey => new PlatformDownloader({platform, buildKey, version: installedTabrisVersion})
              .download(PLATFORMS_DIR))
          .then(platformSpec => executeCordovaCommands({name, platform, platformSpec, options}))
          .catch(fail);
      }
    }));
}

function executeCordovaCommands({name, platform, platformSpec, options}) {
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
    .platformCommand(name, platform, {options: platformCommandOptions});
}

function validateArguments({debug, release, platform}) {
  if (debug && release) {
    fail('Cannot specify both --release and --debug');
  }
  if (!['android', 'ios', 'windows'].includes(platform)) {
    fail('Invalid platform: ' + platform);
  }
}
