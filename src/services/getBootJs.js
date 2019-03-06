const {join} = require('path');
const {readFileSync} = require('fs-extra');

function getBootJs(appPath, sessionId, serverId) {
  const bootJs = readFileSync(join(appPath, 'node_modules', 'tabris', 'boot.min.js'), 'utf8');
  return bootJs + '\n' + getDebugClient(sessionId, serverId);
}

function getDebugClient(sessionId, serverId) {
  const resources = join(__dirname, '..', '..', 'resources');
  let debugClient = readFileSync(join(resources, 'debugClient.js'), 'utf8');
  debugClient += readFileSync(join(resources, 'RemoteConsole.js'), 'utf8');
  debugClient += readFileSync(join(resources, 'ModulePreLoader.js'), 'utf8');
  return debugClient
    .replace(new RegExp('{{SessionId}}', 'g'), sessionId)
    .replace(new RegExp('{{ServerId}}', 'g'), serverId);
}

// getDebugClient needed for unit tests
module.exports = {getBootJs, getDebugClient};
