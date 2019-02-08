const crypto = require('crypto');
const os = require('os');
const {join} = require('path');
const {writeFile, existsSync, readFileSync} = require('fs-extra');
const commander = require('commander');
const {handleErrors, fail} = require('./helpers/errorHandler');
const {parseVariables} = require('./helpers/argumentsParser');

const APP_DIR = '.';
const CORDOVA_PROJECT_DIR = 'build/cordova';
const CLI_DATA_DIR = join(os.homedir(), '.tabris-cli');

const PARAMS_DESCRIPTION = `

  <platform>:\t\t\tandroid, ios or windows
  [cordova-platform-opts...]:\tplatform-specific options passed to Cordova
`;
const BUILD_DESCRIPTION = `Builds a Tabris.js app. ${PARAMS_DESCRIPTION}`;
const RUN_DESCRIPTION = `Builds a Tabris.js app and runs it on a connected device or emulator. ${PARAMS_DESCRIPTION}`;
const VARIABLES_DESCRIPTION = 'comma separated list of variable replacements in config.xml\n\t\t\t\t   ' +
  'e.g. --variables FOO=bar replaces all "$FOO" with "bar".';
const CORDOVA_BUILD_CONFIG_DESCRIPTION =
  'path to a build configuration file passed to Cordova (relative to cordova/ directory)';

registerBuildCommand('build', BUILD_DESCRIPTION);
registerBuildCommand('run', RUN_DESCRIPTION);

function registerBuildCommand(name, description) {
  let buildFn = (...args) => build(name, ...args);
  let program = commander
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
    .action(handleErrors(buildFn));
  if (name === 'build') {
    program.option('--arch <arch>',
      'Architecture to build the app for. Can be one of "x64", "x86" and "arm".\n\t\t\t\t   ' +
      'Supported only for Windows builds.');
  }
  if (name === 'run') {
    program.option('--target <id>', 'the id of the target device to deploy the app to');
    program.option('--list-targets', 'show a list of available targets to use with --target');
  }
}

function build(name, platform, cordovaPlatformOpts, options) {
  const TabrisApp = require('./services/TabrisApp');
  const PlatformProvider = require('./services/PlatformProvider');
  const ConfigXml = require('./services/ConfigXml');
  const packageJson = require('../package.json');
  const {join} = require('path');

  let {
    debug = !('debug' in options) && !('release' in options) ? true : false,
    release,
    replaceEnvVars,
    variables
  } = options;
  validateArguments({command: name, platform, debug, release, options});
  let variableReplacements = Object.assign({
    IS_DEBUG: !!debug,
    IS_RELEASE: !!release
  }, replaceEnvVars && process.env, variables);
  let {installedTabrisVersion} = new TabrisApp(APP_DIR)
    .runPackageJsonBuildScripts(platform)
    .createCordovaProject(CORDOVA_PROJECT_DIR)
    .validateInstalledTabrisVersion(packageJson.version);
  let configXmlPath = join(CORDOVA_PROJECT_DIR, 'config.xml');
  ConfigXml.readFrom(configXmlPath)
    .adjustContentPath()
    .replaceVariables(variableReplacements)
    .writeTo(configXmlPath);
  // new PlatformProvider(CLI_DATA_DIR).getPlatform({name: platform, version: installedTabrisVersion})
  //   .then(platformSpec => {
  //     return copyBuildKeyHash().then(() =>
  //       executeCordovaCommands({name, platform, platformSpec, cordovaPlatformOpts, options})
  //     );
  //   })
  //   .catch(fail);
}

function executeCordovaCommands({name, platform, platformSpec, options, cordovaPlatformOpts}) {
  const CordovaCli = require('./services/CordovaCli');

  let platformAddOptions = [options.verbose && 'verbose'];
  let platformCommandOptions = [
    options.release && 'release' || options.debug && 'debug',
    options.device && 'device',
    options.emulator && 'emulator',
    options.cordovaBuildConfig && `buildConfig=${options.cordovaBuildConfig}`,
    options.verbose && 'verbose',
    options.arch && `archs=${options.arch}`,
    options.target && `target=${options.target}`,
    options.listTargets && 'list'
  ];
  new CordovaCli(CORDOVA_PROJECT_DIR)
    .platformAddSafe(platform, platformSpec, {options: platformAddOptions})
    .platformCommand(name, platform, {options: platformCommandOptions, cordovaPlatformOpts});
}

function validateArguments({command, debug, release, platform, options}) {
  const {fail} = require('./helpers/errorHandler');

  let configXmlPath = join(APP_DIR, 'cordova', 'config.xml');
  if (debug && release) {
    fail('Cannot specify both --release and --debug');
  }
  if (!['android', 'ios', 'windows'].includes(platform)) {
    fail('Invalid platform: ' + platform);
  }
  if (command === 'build') {
    if (options.arch && platform !== 'windows') {
      fail('--arch is only supported for Windows builds');
    }
    if (platform === 'windows') {
      if (!options.arch) {
        fail('--arch must be given for Windows builds');
      }
      if (options.arch && options.arch.includes(' ')) {
        fail('--arch only accepts a single architecture');
      }
      if (options.arch && !['x86', 'x64', 'arm'].includes(options.arch)) {
        fail('--arch can only be one of "x86", "x64" and "arm"');
      }
    }
  }
  if (!existsSync(configXmlPath)) {
    fail(`config.xml does not exist at ${configXmlPath}`);
  }
}

function copyBuildKeyHash() {
  return new Promise((resolve, reject) => {
    let buildKeyPath = join(CLI_DATA_DIR, 'build.key');
    let buildKeyHashPath = join(CORDOVA_PROJECT_DIR, 'www', 'build-key.sha256');
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
