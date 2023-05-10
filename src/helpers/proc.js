const os = require('os');
const {promisify} = require('util');
const proc = require('child_process');
const log = require('./log');
const {fail} = require('./errorHandler');
const treeKill = require('tree-kill');

const TERMINATING_EVENT = 'terminating';

const childProcesses = [];

function spawn(cmd, args, opts = {}) {
  console.log('>>> spawn <<<');
  console.log(`>>> cmd: ${cmd} args: ${JSON.stringify(args)} opts: ${JSON.stringify(opts)}`);
  return _spawn({cmd, args, opts}, {sync: false});
}

function spawnSync(cmd, args, opts = {}) {
  console.log('*** spawnSync ***');
  console.log(`*** cmd: ${cmd} args: ${JSON.stringify(args)} opts: ${JSON.stringify(opts)}`);
  return _spawn({cmd, args, opts}, {sync: true});
}

function _spawn({cmd, args, opts = {}}, {sync}) {
  console.log('+++ _spawn +++');
  console.log(`+++ cmd: ${cmd} args: ${JSON.stringify(args)} opts: ${JSON.stringify(opts)}`);
  const normalizedCmd = normalizeCommand(cmd);
  const normalizedArgs = normalizeArguments(args);
  console.log(`+++ normalizedCmd: ${normalizedCmd} normalizedArgs: ${normalizedArgs}`);
  log.command([normalizedCmd, ...normalizedArgs].join(' '), opts.cwd);
  const child = proc[sync && 'spawnSync' || 'spawn'](normalizedCmd, normalizedArgs, Object.assign({
    stdio: 'inherit',
    shell: isWindows()
  }, opts));
  console.log('+++ Before Error Check +++');
  if (sync && child.status !== 0) {
    console.log('--- Error ---');
    console.log(`--- child.status: ${child.status}`);
    console.log(`--- child.signal: ${child.signal}`);
    console.log(`--- child.error: ${child.error}`);
    console.log(`--- child: ${JSON.stringify(child)}`);
    throw new Error(childProcessExitedMessage(cmd, child.status || child.signal || child.error));
  }
  console.log('=== NO Error ===');
  console.log(`=== child: ${JSON.stringify(child)}`);
  if (!sync) {
    childProcesses.push(child);
    handleTermination(cmd, child);
  }
  return child;
}

function handleTermination(cmd, child) {
  let terminatingChildren = false;
  process.on(TERMINATING_EVENT, () => terminatingChildren = true);
  child.on('exit', code => {
    if (code !== 0 && !terminatingChildren) {
      fail(childProcessExitedMessage(cmd, code));
    }
  });
}

async function terminate(status = 0) {
  process.emit(TERMINATING_EVENT);
  await Promise.all(childProcesses.map(child => promisify(treeKill)(child.pid).catch(e => {
    console.log('Could not terminate child process: ' + e);
  })));
  process.exit(status);
}

function childProcessExitedMessage(cmd, status) {
  return `The command ${cmd} exited with ${status}`;
}

function normalizeArguments(args) {
  if (isWindows()) {
    return args.map(arg => arg.indexOf(' ') >= 0 ? `"${arg}"` : arg);
  }
  return args;
}

function normalizeCommand(cmd) {
  if (isWindows()) {
    return cmd.indexOf(' ') >= 0 ? `"${cmd}"` : cmd;
  }
  return cmd;
}

function isWindows() {
  return os.platform() === 'win32';
}

module.exports = {spawnSync, spawn, terminate};
