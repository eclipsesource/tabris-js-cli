const program = require('commander');
const fs = require('fs');
const ecstatic = require('ecstatic');
const union = require('union');
const colors = require('colors/safe');
const os = require('os');
const portscanner = require('portscanner');

const BASE_PORT = 8080;
const MAX_PORT = 65535;

program
  .command('serve [path]')
  .description('Serves a Tabris.js app from a directory.')
  .action(inputPath => serve(inputPath));

function serve(inputPath) {
  let appPath = inputPath || process.cwd();
  let addresses = getExternalAddresses();
  if (!addresses.length) {
    fail('No remotely accessible network interfaces.');
  }
  fs.lstat(appPath, (err, stats) => {
    if (stats.isDirectory()) {
      let server = union.createServer({before: [ecstatic({root: appPath})]});
      findAvailablePort().then(port => server.listen(port, () => onListening(server, addresses)));
    } else {
      throw new Error('Path must be a directory');
    }
  });
}

function onListening(server, addresses) {
  let port = server.address().port;
  console.log(
    colors.yellow(`Server started.\nPoint your Tabris.js client to:`),
    '\n',
    addresses.map(iface => colors.green('  http://' + iface.address + ':' + port.toString())).join('\n')
  );
}

function fail(message) {
  console.error(colors.red(message));
  process.exit(1);
}

function getExternalAddresses() {
  let interfaces = os.networkInterfaces();
  return Object.keys(interfaces)
    .map(key => interfaces[key].find(details => details.family === 'IPv4' && details.internal === false))
    .filter(val => !!val);
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    portscanner.findAPortNotInUse(BASE_PORT, MAX_PORT, '127.0.0.1', function(error, port) {
      if (error) {
        reject(error);
      } else {
        resolve(port);
      }
    });
  });
}
