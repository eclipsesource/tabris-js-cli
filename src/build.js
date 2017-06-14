const {join} = require('path');
const {existsSync} = require('fs-extra');
const program = require('commander');
const {fail, handleErrors} = require('./errorHandler');
const TabrisProject = require('./TabrisProject');
const CordovaCli = require('./CordovaCli');
const ConfigXml = require('./ConfigXml');
const {parseVariables} = require('./argumentsParser');
const PROJECT_PATH = '.';
const CORDOVA_PROJECT_PATH = 'build/cordova';

const PARAMS_DESCRIPTION = `

  <platform>:\t\tandroid, ios or windows
  [platformOpts...]:\tplatform-specific options passed to cordova
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
    .command(`${name} <platform> [platformOpts...]`)
    .option('--variables <replacements>', VARIABLES_DESCRIPTION, parseVariables)
    .option('--cordova-build-config <path>', CORDOVA_BUILD_CONFIG_DESCRIPTION)
    .option('--debug', 'perform a debug build')
    .option('--device', 'build the app for a device')
    .option('--emulator', 'build the app for an emulator')
    .option('--release', 'perform a release build')
    .option('--no-replace-env-vars', 'do not replace environment variables in config.xml')
    .option('--verbose', 'print more verbose output')
    .description(description)
    .action(handleErrors((platform, platformOpts, {
      debug, release, variables, replaceEnvVars, cordovaBuildConfig, device, emulator, verbose
    } = {}) => {
      let variableReplacements = Object.assign({
        IS_DEBUG: !!debug,
        IS_RELEASE: !!release
      }, replaceEnvVars && process.env, variables);
      let envVar = `TABRIS_${platform.toUpperCase()}_PLATFORM`;
      let platformSpec = process.env[envVar];
      validateArguments({debug, release, platform, platformSpec, envVar});
      new TabrisProject(PROJECT_PATH)
        .runPackageJsonBuildScripts(platform)
        .createCordovaProject(CORDOVA_PROJECT_PATH);
      let configXmlPath = join(CORDOVA_PROJECT_PATH, 'config.xml');
      if (existsSync(configXmlPath)) {
        ConfigXml.readFrom(configXmlPath)
          .adjustContentPath()
          .replaceVariables(variableReplacements)
          .writeTo(configXmlPath);
      }
      let platformAddOptions = [
        verbose && 'verbose'
      ];
      let platformCommandOptions = [
        release && 'release' || debug && 'debug',
        device && 'device',
        emulator && 'emulator',
        cordovaBuildConfig && `buildConfig=${cordovaBuildConfig}`,
        verbose && 'verbose'
      ];
      new CordovaCli(CORDOVA_PROJECT_PATH)
        .platformAddSafe(platform, platformSpec, {options: platformAddOptions})
        .platformCommand(name, platform, {options: platformCommandOptions, platformOpts});
    }));
}

function validateArguments({debug, release, platform, platformSpec, envVar}) {
  if (debug && release) {
    fail('Cannot specify both --release and --debug');
  }
  if (!['android', 'ios', 'windows'].includes(platform)) {
    fail('Invalid platform: ' + platform);
  }
  if (!platformSpec) {
    fail('Missing cordova platform spec, expected in $' + envVar);
  }
}
