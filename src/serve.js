const program = require('commander');
const {readFileSync, existsSync, lstat} = require('fs-extra');
const ecstatic = require('ecstatic');
const union = require('union');
const {green, yellow, red, blue} = require('chalk');
const os = require('os');
const portscanner = require('portscanner');
const {basename, join} = require('path');
const {fail, handleErrors} = require('./errorHandler');

const BASE_PORT = 8080;
const MAX_PORT = 65535;

let logging = false;

program
  .command('serve [path]')
  .option('-l, --logging', 'enable request logging')
  .description('Serves a Tabris.js app from a directory or a file.')
  .action(handleErrors((inputPath, options) => {
    logging = !!options.logging;
    serve(inputPath);
  }));

function serve(inputPath) {
  let appPath = inputPath || process.cwd();
  let addresses = getExternalAddresses();
  if (!addresses.length) {
    fail('No remotely accessible network interfaces.');
  }
  lstat(appPath, (err, stats) => {
    if (err || !stats || !stats.isDirectory() && !stats.isFile()) {
      fail('Path must be a directory or a file.');
    }
    if (stats.isDirectory()) {
      let packageJsonPath = join(appPath, 'package.json');
      if (!existsSync(packageJsonPath)) {
        fail('Directory must contain package.json');
      }
      if (!JSON.parse(readFileSync(packageJsonPath)).main) {
        fail('package.json must contain a "main" field');
      }
      startServer(appPath, addresses);
    } else if (stats.isFile()) {
      serveFile(appPath, addresses);
    }
  });
}

function serveFile(appPath, addresses) {
  let servePackageJson = (req, res, next) => {
    if (req.url === '/package.json') {
      return res.json({main: basename(appPath)});
    }
    next();
  };
  startServer(join(appPath, '..'), addresses, [servePackageJson]);
}

function startServer(appPath, addresses, middlewares = []) {
  let server = union.createServer({
    before: [requestLogger, ...middlewares, ecstatic({root: appPath})],
    onError: (err, req, res) => {
      log(req, err);
      res.end();
    }
  });
  findAvailablePort().then(port => server.listen(port, () => onListening(server, addresses)));
}

function onListening(server, addresses) {
  let port = server.address().port;
  console.log(
    yellow('Server started.\nPoint your Tabris.js client to:\n'),
    addresses.map(iface => green('  http://' + iface.address + ':' + port.toString())).join('\n')
  );
}

function requestLogger(req, res, next) {
  log(req);
  next();
}

function log(req, err) {
  if (!logging) {
    return;
  }
  if (err) {
    console.error(
      red(`${req.method} ${req.url} ${err.status}: "${err.message || err}"`)
    );
  } else {
    console.info(
      blue(`${req.method} ${req.url}`)
    );
  }
}

function getExternalAddresses() {
  let interfaces = os.networkInterfaces();
  return Object.keys(interfaces)
    .map(key => interfaces[key].find(details => details.family === 'IPv4' && details.internal === false))
    .filter(val => !!val);
}

function findAvailablePort() {
  return portscanner.findAPortNotInUse(BASE_PORT, MAX_PORT, '127.0.0.1');
}
