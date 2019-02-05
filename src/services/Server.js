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
const ServerInfo = require('./ServerInfo');
const RemoteConsole = require('./RemoteConsole');
const AppReloader = require('./AppReloader');
const {red, blue} = require('chalk');

const BASE_PORT = 8080;
const MAX_PORT = 65535;

module.exports = class Server extends EventEmitter {

  constructor({watch, requestLogging, interactive, autoReload, terminal}) {
    super();
    if (!terminal) {
      throw new Error('Terminal is missing');
    }
    this.terminal = terminal;
    if (requestLogging) {
      this.on('request', this._logRequest);
    }
    this._watch = !!watch;
    this._interactive = !!interactive;
    this._autoReload  = !!autoReload;
    this.debugServer = null;
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
    this._appPath = appPath;
    return lstat(appPath).then((stats) => {
      if (stats.isDirectory()) {
        this._packageJson = this._readAppPackageJson(appPath, main);
        this._tabrisVersion = parseInt(this._readTabrisPackageJson(appPath).version.split('.')[0], 10);
        this._checkTabrisVersion();
        this._runProjectScript();
        return this._startServer(appPath, main);
      } else {
        throw new Error('Project must be a directory.');
      }
    }).then(() => {
      return this._startServices();
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

  _readAppPackageJson(appPath, main) {
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

  _readTabrisPackageJson(appPath) {
    let packageJsonPath = join(appPath, 'node_modules', 'tabris', 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('No tabris module installed');
    }
    return readJsonSync(packageJsonPath);
  }

  _checkTabrisVersion() {
    if (this._interactive && this._tabrisVersion < 3) {
      throw new Error('Interactive console (-i, --interactive) feature requires a Tabris.js 3.x project');
    }
    if (this._autoReload && this._tabrisVersion < 3) {
      throw new Error('Auto reload (-a, --auto-reload) feature requires a Tabris.js 3.x project');
    }
  }

  _runProjectScript() {
    if (this._watch) {
      if (process.stdin.isTTY && !this._interactive) {
        process.stdin.setRawMode(false);
      }
      const ps = proc.exec(
        'npm',
        ['run', '--if-present', 'watch'],
        {cwd: this._appPath, stdio: [null, 'pipe', null]}
      );
      ps.stdout.on('data', data => {
        const line = data.toString().trim();
        if (line !== '') {
          this.terminal.info(line);
        }
      });
    } else {
      proc.execSync('npm', ['run', '--if-present', 'build'], {cwd: this._appPath});
    }
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
      }));
  }

  _startServices() {
    const webSocketServer = new WebSocket.Server({server: this._server});
    this.debugServer = new DebugServer(webSocketServer, this.terminal);
    this.debugServer.start();
    if (this._interactive) {
      RemoteConsole.create(this);
    }
    if (this._autoReload) {
      new AppReloader(this).start();
    }
    return new ServerInfo(this, Server.externalAddresses).show();
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

  _logRequest(req, err) {
    if (err) {
      this.terminal.error(red(`${req.method} ${req.url} ${err.status}: "${err.message || err}"`));
    } else {
      this.terminal.info(blue(`${req.method} ${req.url}`));
    }
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
    if (this._tabrisVersion < 3) {
      return (req, res, next) => next();
    }
    return (req, res, next) => {
      if (req.url === '/node_modules/tabris/boot.min.js') {
        return res.text(getBootJs(appPath, this.debugServer.getNewSessionId()));
      }
      next();
    };
  }

  _findAvailablePort() {
    return portscanner.findAPortNotInUse(BASE_PORT, MAX_PORT, '127.0.0.1');
  }

};
