const os = require('os');
const {statSync, readFileSync} = require('fs');
const {copySync, existsSync, ensureDirSync} = require('fs-extra');
const {spawnSync} = require('child_process');
const program = require('commander');
const colors = require('colors/safe');
const ignore = require('ignore');

const DESCRIPTION = `Builds a Tabris.js app.

  <platform>:\t\tandroid, ios or windows
  [platformOpts...]:\tplatform-specific options passed to cordova build`;

let debug;
let release;
let platformOpts;

program
  .command('build <platform> [platformOpts...]')
  .option('--debug', 'perform a debug build')
  .option('--release', 'perform a release build')
  .description(DESCRIPTION)
  .action((platform, platformOptions, options) => {
    platformOpts = platformOptions;
    debug = !!options.debug;
    release = !!options.release;
    build(platform);
  });

function build(platform) {
  if (!['android', 'ios', 'windows'].includes(platform)) {
    fail('Invalid platform: ' + platform);
  }
  let envVar = `TABRIS_${platform.toUpperCase()}_PLATFORM`;
  let platformSpec = process.env[envVar];
  if (!platformSpec) {
    fail('Missing cordova platform spec, expected in $' + envVar);
  }
  if (!statSafe('package.json')) {
    fail('Could not find package.json');
  }
  if (!statSafe('cordova')) {
    fail('Could not find cordova directory');
  }
  runBuildScripts(platform);
  createBuildFolder();
  copyCordova();
  copyProject();
  runInstall();
  runCordovaPlatformAdd(platform, platformSpec);
  runCordovaBuild();
}

function createBuildFolder() {
  console.log('create build folder build/cordova');
  ensureDirSync('build/cordova/www');
}

function runBuildScripts(platform) {
  exec('npm', ['run', '--if-present', `build:${platform}`]);
  exec('npm', ['run', '--if-present', 'build']);
}

function runInstall() {
  exec('npm', ['install', '--production'], {cwd: 'build/cordova/www'});
}

function runCordovaPlatformAdd(platform, platformSpec) {
  let platformsJsonPath = './build/cordova/platforms/platforms.json';
  if (!existsSync(platformsJsonPath)) {
    return execCordovaPlatformAdd(platformSpec);
  }
  let platforms = JSON.parse(readFileSync(platformsJsonPath, 'utf8'));
  if (!platforms[platform]) {
    execCordovaPlatformAdd(platformSpec);
  }
}

function execCordovaPlatformAdd(platformSpec) {
  exec('cordova', ['platform', 'add', platformSpec], {cwd: 'build/cordova'});
}

function runCordovaBuild() {
  let type = release && '--release' || debug && '--debug';
  let parameters = platformOpts.length && ['--', ...platformOpts] || [];
  exec('cordova', ['build', type, ...parameters].filter(truthy), {cwd: 'build/cordova'});
}

function copyCordova() {
  copySync('cordova/', 'build/cordova/');
}

function copyProject() {
  let ig = ignore().add(['.git/', 'node_modules/', 'cordova/', 'build/', '.tabrisignore']);
  if (statSafe('.tabrisignore')) {
    ig.add(readFileSync('.tabrisignore').toString());
  }
  copySync('./', 'build/cordova/www/', {filter: (path) => {
    let stats = statSafe(path);
    let dirPath = stats && stats.isDirectory() && !path.endsWith('/') ? path + '/' : path;
    return !ig.ignores(dirPath);
  }});
}

function exec(cmd, args, opts = {}) {
  let cmdName = os.platform() === 'win32' ? cmd + '.cmd' : cmd;
  console.log('exec', `[${opts.cwd || './'}]`, cmdName, args.join(' '));
  const ps = spawnSync(cmdName, args, Object.assign({stdio: 'inherit'}, opts));
  if (ps.status !== 0) {
    throw new Error(`The command ${cmd} exited with ${ps.status}`);
  }
}

function statSafe(file) {
  try {
    return statSync(file);
  } catch (e) {
    return null;
  }
}

function fail(message) {
  console.error(colors.red(message));
  process.exit(1);
}

function truthy(value) {
  return !!value;
}
