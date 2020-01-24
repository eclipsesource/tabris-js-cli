const os = require('os');
const proc = require('child_process');
const log = require('./log');
const {fail} = require('./errorHandler');

function exec(cmd, args, opts = {}) {
  return execute({cmd, args, opts}, {sync: false});
}

function execSync(cmd, args, opts = {}) {
  return execute({cmd, args, opts}, {sync: true});
}

function execute({cmd, args, opts = {}}, {sync}) {
  let normalizedCmd = normalizeCommand(cmd);
  let normalizedArgs = normalizeArguments(args);
  log.command([normalizedCmd, ...normalizedArgs].join(' '), opts.cwd);
  const ps = proc[sync && 'spawnSync' || 'spawn'](normalizedCmd, normalizedArgs, Object.assign({
    stdio: 'inherit',
    shell: isWindows()
  }, opts));
  if (sync && ps.status !== 0) {
    throw new Error(childProcessExitedMessage(cmd, ps.status));
  }
  if (!sync) {
    process.on('exit', () => ps.kill());
    ps.on('exit', code => {
      if (code !== 0) {
        fail(childProcessExitedMessage(cmd, code));
      }
    });
  }
  return ps;
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

module.exports = {execSync, exec};
