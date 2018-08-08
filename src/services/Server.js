const os = require('os');
const {join, relative} = require('path');
const EventEmitter = require('events');
const {readFileSync, readJsonSync, existsSync, lstat} = require('fs-extra');
const ecstatic = require('ecstatic');
const union = require('union');
const portscanner = require('portscanner');
const proc = require('../helpers/proc');
const WebSocket = require('ws');
const DebugServer = require('./DebugServer');

const BASE_PORT = 8080;
const MAX_PORT = 65535;

module.exports = class Server extends EventEmitter {

  constructor({watch = false} = {}) {
    super();
    this._watch = watch;
    this._debugServer = null;
  }

  static get externalAddresses() {
    let interfaces = os.networkInterfaces();
    return Object.keys(interfaces)
      .map(key => interfaces[key].find(details => details.family === 'IPv4' && details.internal === false))
      .filter(val => !!val)
      .map(iface => iface.address);
  }

  get port() {
    return this._server ? this._server.address().port : null;
  }

  serve(basePath) {
    return lstat(basePath).then((stats) => {
      if (stats.isDirectory()) {
        let packageJsonPath = join(basePath, 'package.json');
        if (!existsSync(packageJsonPath)) {
          throw new Error('Directory must contain package.json');
        }
        if (!readJsonSync(packageJsonPath).main) {
          throw new Error('package.json must contain a "main" field');
        }
        if (this._watch) {
          proc.exec('npm', ['run', '--if-present', 'watch'], {cwd: basePath});
        } else {
          proc.execSync('npm', ['run', '--if-present', 'build'], {cwd: basePath});
        }
        return this._startServer(basePath);
      } else if (stats.isFile()) {
        return this._serveFile(basePath);
      } else {
        throw new Error('Path must be a directory or a file.');
      }
    }).catch((err) => {
      if (!basePath) {
        throw new Error('path missing');
      }
      if (err.code === 'ENOENT') {
        throw new Error('No such file or directory: ' + basePath);
      }
      throw err;
    });
  }

  _serveFile(appPath) {
    let servePackageJson = (req, res, next) => {
      if (req.url === '/package.json') {
        return res.json({main: this._getMainPath(appPath)});
      }
      next();
    };
    return this._startServer(process.cwd(), [servePackageJson]);
  }

  _getMainPath(appPath) {
    if (os.platform() === 'win32') { // TODO: workaround for https://github.com/nodejs/node/issues/13683
      return relative(process.cwd(), appPath).replace(/\\/g, '/');
    }
    return relative(process.cwd(), appPath);
  }

  _startServer(appPath, middlewares = []) {
    return new Promise((resolve) => {
      if (!Server.externalAddresses.length) {
        throw new Error('No remotely accessible network interfaces');
      }

      let requestLogger = (req, res, next) => {
        this.emit('request', req);
        next();
      };

      let serveBootJs = (req, res, next) => {
        if (req.url === '/node_modules/tabris/boot.min.js') {
          return res.text(this._getBootJsWithDebug(appPath));
        }
        next();
      };

      this._server = union.createServer({
        before: [requestLogger, ...middlewares, serveBootJs, ecstatic({root: appPath, showDir: false})],
        onError: (err, req, res) => {
          this.emit('request', req, err);
          res.end();
        }
      });

      this._findAvailablePort().then(port => {
        this._server.listen(port, (err) => {
          if (err) {
            throw err;
          }
          const _webSocketServer = new WebSocket.Server({server: this._server});
          this._debugServer = new DebugServer(_webSocketServer);
          this._debugServer.start();
          resolve();
        });
      });
    });
  }

  _getBootJsWithDebug(appPath) {
    let localBootMinJs = readFileSync(join(appPath, 'node_modules', 'tabris', 'boot.min.js'), 'utf8');
    let debugClient = readFileSync(join(__dirname, '..', '..', 'resources', 'debugClient.js'), 'utf8');
    debugClient = debugClient.replace(new RegExp('{{SessionId}}', 'g'), this._debugServer.getNewSessionId());
    return localBootMinJs + '\n' + debugClient;
  }

  _findAvailablePort() {
    return portscanner.findAPortNotInUse(BASE_PORT, MAX_PORT, '127.0.0.1');
  }

};
