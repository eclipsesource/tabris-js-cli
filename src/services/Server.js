const os = require('os');
const {join} = require('path');
const EventEmitter = require('events');
const {readJsonSync, existsSync, lstat} = require('fs-extra');
const ecstatic = require('ecstatic');
const union = require('union');
const portscanner = require('portscanner');
const proc = require('../helpers/proc');
const WebSocket = require('ws');
const DebugServer = require('./DebugServer');
const GetFilesMiddleware = require('./GetFilesMiddleware');
const FileService = require('./FileService');
const {getBootJs} = require('./getBootJs');

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

  serve(appPath, main) {
    return lstat(appPath).then((stats) => {
      if (stats.isDirectory()) {
        this._packageJson = this._readPackageJson(appPath, main);
        if (this._watch) {
          const ps = proc.exec('npm', ['run', '--if-present', 'watch'], {cwd: appPath, stdio: [null, 'pipe', null]});
          ps.stdout.on('data', data => {
            const line = data.toString().trim();
            if (line !== '') {
              console.info(line);
            }
          });
        } else {
          proc.execSync('npm', ['run', '--if-present', 'build'], {cwd: appPath});
        }
        return this._startServer(appPath, main);
      } else {
        throw new Error('Project must be a directory.');
      }
    }).catch((err) => {
      if (!appPath) {
        throw new Error('path missing');
      }
      if (err.code === 'ENOENT') {
        throw new Error('No such file or directory: ' + appPath);
      }
      throw err;
    });
  }

  _readPackageJson(appPath, main) {
    let packageJsonPath = join(appPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('Directory must contain package.json');
    }
    const content = readJsonSync(packageJsonPath);
    if (!content.main && !main) {
      throw new Error('package.json must contain a "main" field');
    }
    if (main) {
      content.main = main;
    }
    return content;

  }

  _startServer(appPath, main) {
    if (!Server.externalAddresses.length) {
      throw new Error('No remotely accessible network interfaces');
    }
    this._server = union.createServer({
      before: this._createMiddlewares(appPath, main),
      onError: (err, req, res) => {
        this.emit('request', req, err);
        res.end();
      }
    });
    return this._findAvailablePort()
      .then(port => new Promise(resolve => {
        this._server.listen(port, err => {
          if (err) {
            throw err;
          }
          resolve();
        });
      })).then(() => {
        const webSocketServer = new WebSocket.Server({server: this._server});
        this._debugServer = new DebugServer(webSocketServer);
        this._debugServer.start();
      });
  }

  _createMiddlewares(appPath, main) {
    return [
      this._createRequestEmitter(),
      this._createGetFilesMiddleware(appPath),
      this._createDeliverEmitter(),
      this._createPackageJsonMiddleware(main),
      this._createBootJsMiddleware(appPath),
      ecstatic({root: appPath, showDir: false})
    ];
  }

  _createRequestEmitter() {
    return (req, res, next) => {
      this.emit('request', req);
      next();
    };
  }

  _createGetFilesMiddleware(appPath) {
    const fileService = new FileService({
      [join(appPath, 'package.json')]: JSON.stringify(this._packageJson)
    });
    const getFiles = new GetFilesMiddleware(appPath, fileService);
    getFiles.on('deliver', url => this.emit('deliver', url));
    return getFiles.handleRequest.bind(getFiles);
  }

  _createDeliverEmitter() {
    return (req, res, next) => {
      this.emit('deliver', req.url.slice(1));
      next();
    };
  }

  _createPackageJsonMiddleware(main) {
    if (!main) {
      return (req, res, next) => next();
    }
    return (req, res, next) => {
      if (req.url === '/package.json') {
        return res.json(this._packageJson);
      }
      next();
    };
  }

  _createBootJsMiddleware(appPath) {
    return (req, res, next) => {
      if (req.url === '/node_modules/tabris/boot.min.js') {
        return res.text(getBootJs(appPath, this._debugServer.getNewSessionId()));
      }
      next();
    };
  }

  _findAvailablePort() {
    return portscanner.findAPortNotInUse(BASE_PORT, MAX_PORT, '127.0.0.1');
  }

};
