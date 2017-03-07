const {statSync, readFileSync} = require('fs');
const {copySync, emptyDirSync, mkdirsSync} = require('fs-extra');
const {spawnSync} = require('child_process');
const program = require('commander');
const colors = require('colors/safe');
const ignore = require('ignore');

program
  .command('build [platform]')
  .description('Builds a Tabris.js app.')
  .action(platform => build(platform));

function build(platform) {
  if (!platform) {
    fail('Missing platform');
  }
  if (!['android', 'ios'].includes(platform)) {
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
  runCordovaPlatformAdd(platformSpec);
  runCordovaBuild();
}

function createBuildFolder() {
  console.log('create build folder build/cordova');
  mkdirsSync('build');
  emptyDirSync('build/cordova');
  mkdirsSync('build/cordova/www');
}

function runBuildScripts(platform) {
  exec('npm', ['run', '--if-present', `build:${platform}`]);
  exec('npm', ['run', '--if-present', 'build']);
}

function runInstall() {
  exec('npm', ['install', '--production'], {cwd: 'build/cordova/www'});
}

function runCordovaPlatformAdd(cordovaPlatform) {
  exec('cordova', ['platform', 'add', cordovaPlatform], {cwd: 'build/cordova'});
}

function runCordovaBuild() {
  exec('cordova', ['build'], {cwd: 'build/cordova'});
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
  console.log('exec', `[${opts.cwd || './'}]`, cmd, args.join(' '));
  const ps = spawnSync(cmd, args, Object.assign({stdio: 'inherit'}, opts));
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
