const os = require('os');
const {basename, join} = require('path');
const EventEmitter = require('events');
const {readJsonSync, existsSync, lstat} = require('fs-extra');
const ecstatic = require('ecstatic');
const union = require('union');
const portscanner = require('portscanner');
const proc = require('../helpers/proc');

const BASE_PORT = 8080;
const MAX_PORT = 65535;

module.exports = class Server extends EventEmitter {

  constructor({watch = false} = {}) {
    super();
    this._watch = watch;
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
        return res.json({main: basename(appPath)});
      }
      next();
    };
    return this._startServer(join(appPath, '..'), [servePackageJson]);
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
      this._server = union.createServer({
        before: [requestLogger, ...middlewares, ecstatic({root: appPath, showDir: false})],
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
          resolve();
        });
      });
    });
  }

  _findAvailablePort() {
    return portscanner.findAPortNotInUse(BASE_PORT, MAX_PORT, '127.0.0.1');
  }

};
