const os = require('os');
const {spawnSync} = require('child_process');
const log = require('./log');

function exec(cmd, args, opts = {}) {
  let cmdName = os.platform() === 'win32' ? cmd + '.cmd' : cmd;
  log.command([cmdName, ...args].join(' '), opts.cwd);
  const ps = spawnSync(cmdName, args, Object.assign({stdio: 'inherit'}, opts));
  if (ps.status !== 0) {
    throw new Error(`The command ${cmd} exited with ${ps.status}`);
  }
  return ps;
}

module.exports = {exec};
