const program = require('commander');
const {fail} = require('./errorHandler');
const TabrisProject = require('./TabrisProject');
const CordovaCli = require('./CordovaCli');

const PROJECT_PATH = '.';
const CORDOVA_PROJECT_PATH = 'build/cordova';
const DESCRIPTION = `Builds a Tabris.js app and runs it on a connected device or emulator.

  <platform>:\t\tandroid, ios or windows
  [platformOpts...]:\tplatform-specific options passed to cordova run`;

program
  .command('run <platform> [platformOpts...]')
  .option('--debug', 'perform a debug build')
  .option('--release', 'perform a release build')
  .description(DESCRIPTION)
  .action((platform, platformOpts, {debug, release} = {}) => {
    if (debug && release) {
      fail('Cannot specify both --release and --debug');
    }
    let buildType = release && 'release' || debug && 'debug';
    run(platform, buildType, platformOpts);
  });

function run(platform, buildType, platformOpts) {
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
  new CordovaCli(CORDOVA_PROJECT_PATH)
    .platformAddSafe(platform, platformSpec)
    .platformCommand('run', {options: [buildType], platformOpts});
}
