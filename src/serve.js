const program = require('commander');
const fs = require('fs');
const ecstatic = require('ecstatic');
const union = require('union');
const colors = require('colors/safe');
const os = require('os');

// TODO: resolve port using 'portscanner'
const PORT = 8080;

program
  .command('serve [path]')
  .description('Serves a Tabris.js app from a directory.')
  .action(inputPath => serve(inputPath));

function serve(inputPath) {
  let appPath = inputPath || process.cwd();
  let externalAddresses = getExternalAddresses();
  if (!externalAddresses.length) {
    fail('No remotely accessible network interfaces.');
  }
  fs.lstat(appPath, (err, stats) => {
    if (stats.isDirectory()) {
      let server = union.createServer({
        before: [ecstatic({root: appPath})]
      });
      server.listen(PORT, () => {
        let port = server.address().port;
        console.log(
          colors.yellow(`Server started.\nPoint your Tabris.js client to:`)
        );
        externalAddresses.forEach(
          iface => console.log(colors.green('  http://' + iface.address + ':' + port.toString()))
        );
      });
    } else {
      throw new Error('Path must be a directory');
    }
  });
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
