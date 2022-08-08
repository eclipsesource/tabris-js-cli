const os = require('os');
const {promisify} = require('util');
const proc = require('child_process');
const log = require('./log');
const {fail} = require('./errorHandler');
const treeKill = require('tree-kill');

const TERMINATING_EVENT = 'terminating';

const childProcesses = [];

function spawn(cmd, args, opts = {}) {
  return _spawn({cmd, args, opts}, {sync: false});
}

function spawnSync(cmd, args, opts = {}) {
  return _spawn({cmd, args, opts}, {sync: true});
}

function _spawn({cmd, args, opts = {}}, {sync}) {
  const normalizedCmd = normalizeCommand(cmd);
  const normalizedArgs = normalizeArguments(args);
  log.command([normalizedCmd, ...normalizedArgs].join(' '), opts.cwd);
  const child = proc[sync && 'spawnSync' || 'spawn'](normalizedCmd, normalizedArgs, Object.assign({
    stdio: 'inherit',
    shell: isWindows()
  }, opts));
  if (sync && child.status !== 0) {
    throw new Error(childProcessExitedMessage(cmd, child.status || child.signal || child.error));
  }
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
