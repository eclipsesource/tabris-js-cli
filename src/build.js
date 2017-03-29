const program = require('commander');
const {existsSync} = require('fs-extra');
const {fail} = require('./errorHandler');
const TabrisProject = require('./TabrisProject');
const CordovaCli = require('./CordovaCli');
const ConfigXml = require('./ConfigXml');
const {join} = require('path');
const {parseVariables} = require('./argumentsParser');

const PROJECT_PATH = '.';
const CORDOVA_PROJECT_PATH = 'build/cordova';
const DESCRIPTION = `Builds a Tabris.js app.

  <platform>:\t\tandroid, ios or windows
  [platformOpts...]:\tplatform-specific options passed to cordova build`;
const VARIABLES_DESCRIPTION = `comma separated list of variable replacements in config.xml
\t\t\t\te.g. --variables FOO=bar replaces all "$FOO" with "bar".`;

program
  .command('build <platform> [platformOpts...]')
  .option('--variables <replacements>', VARIABLES_DESCRIPTION, parseVariables)
  .option('--debug', 'perform a debug build')
  .option('--release', 'perform a release build')
  .description(DESCRIPTION)
  .action((platform, platformOpts, {debug, release, variables} = {}) => {
    if (debug && release) {
      fail('Cannot specify both --release and --debug');
    }
    let buildType = release && 'release' || debug && 'debug';
    build({platform, buildType, platformOpts, variables});
  });

function build({platform, buildType, platformOpts, variables}) {
  if (!['android', 'ios', 'windows'].includes(platform)) {
    fail('Invalid platform: ' + platform);
  }
  let envVar = `TABRIS_${platform.toUpperCase()}_PLATFORM`;
  let platformSpec = process.env[envVar];
  if (!platformSpec) {
    fail('Missing cordova platform spec, expected in $' + envVar);
  }
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
    .platformCommand('build', {options: [buildType], platformOpts});
}
