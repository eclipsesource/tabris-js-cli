const {existsSync} = require('fs-extra');
const {fail} = require('./errorHandler');
const TabrisProject = require('./TabrisProject');
const CordovaCli = require('./CordovaCli');
const ConfigXml = require('./ConfigXml');
const {join} = require('path');
const {parseVariables} = require('./argumentsParser');
const program = require('commander');

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

registerBuildCommand('build', BUILD_DESCRIPTION);
registerBuildCommand('run', RUN_DESCRIPTION);

function registerBuildCommand(name, description) {
  program
    .command(`${name} <platform> [platformOpts...]`)
    .option('--variables <replacements>', VARIABLES_DESCRIPTION, parseVariables)
    .option('--debug', 'perform a debug build')
    .option('--release', 'perform a release build')
    .description(description)
    .action((platform, platformOpts, {debug, release, variables} = {}) => {
      let buildType = release && 'release' || debug && 'debug';
      let envVar = `TABRIS_${platform.toUpperCase()}_PLATFORM`;
      let platformSpec = process.env[envVar];
      validateArguments({debug, release, platform, platformSpec, envVar});
      new TabrisProject(PROJECT_PATH)
        .runPackageJsonBuildScripts(platform)
        .createCordovaProject(CORDOVA_PROJECT_PATH);
      let configXmlPath = join(CORDOVA_PROJECT_PATH, 'config.xml');
      if (existsSync(configXmlPath)) {
        ConfigXml.readFrom(configXmlPath)
          .replaceVariables(variables)
          .writeTo(configXmlPath);
      }
      new CordovaCli(CORDOVA_PROJECT_PATH)
        .platformAddSafe(platform, platformSpec)
        .platformCommand(name, platform, {options: [buildType], platformOpts});
    });
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
