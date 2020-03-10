const os = require('os');
const {join} = require('path');
const EventEmitter = require('events');
const {readJsonSync, existsSync, lstat} = require('fs-extra');
const serveStatic = require('serve-static');
const connect = require('connect');
const portscanner = require('portscanner');
const {red, blue} = require('chalk');
const WebSocket = require('ws');
const proc = require('../helpers/proc');
const DebugServer = require('./DebugServer');
const GetFilesMiddleware = require('./GetFilesMiddleware');
const FileService = require('./FileService');
const {getBootJs} = require('./getBootJs');
const ServerInfo = require('./ServerInfo');
const RemoteConsole = require('./RemoteConsole');
const AppReloader = require('./AppReloader');
const IndexHtml = require('./IndexHtml');
const KeyboardShortcutHandler = require('./KeyboardShortcutHandler');
const {URL} = require('url');

const BASE_PORT = 8080;
const MAX_PORT = 65535;

module.exports = class Server extends EventEmitter {

  constructor(options) {
    super();
    if (!options.terminal) {
      throw new Error('Terminal is missing');
    }
    this.terminal = options.terminal;
    if (options.requestLogging) {
      this.on('request', this._logRequest);
    }
    this._watch = !!options.watch;
    this._interactive = !!options.interactive;
    this._autoReload  = !!options.autoReload;
    this._noIntro = options.noIntro;
    this._qrcodeRenderer = options.qrcodeRenderer;

    this._external = options.external;
    this._port = options.port;
    this.serverId = null;
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

  async serve(appPath, main) {
    if (!appPath) {
      throw new Error('path missing');
    }
    this.appPath = appPath;
    this.serverId = join(appPath, (main || 'package.json')) + '#' + Date.now();
    let stats = await this._lstat(appPath);
    if (stats.isDirectory()) {
      this._packageJson = this._readAppPackageJson(main);
      this._tabrisVersion = parseInt(this._readTabrisPackageJson().version.split('.')[0], 10);
      this._checkTabrisVersion();
      this._runProjectScript();
      await this._startServer(main);
    } else {
      throw new Error('Project must be a directory.');
    }
    await this._startServices();
    this._serverInfo = new ServerInfo(this, this._getPublicURLs(), this._noIntro, this._qrcodeRenderer);
    this._html = new IndexHtml(this._serverInfo);
    await this._serverInfo.show();
  }

  _getPublicURLs() {
    if (this._external) {
      return [new URL(this._external)];
    }
    return Server.externalAddresses.map(address => {
      return new URL(`http://${address}:${this.port}`);
    });
  }

  async _lstat(path) {
    try {
      return await lstat(path);
    } catch(e) {
      if (e.code === 'ENOENT') {
        throw new Error('No such file or directory: ' + path);
      }
    }
  }

  _readAppPackageJson(main) {
    let packageJsonPath = join(this.appPath, 'package.json');
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

  _readTabrisPackageJson() {
    let packageJsonPath = join(this.appPath, 'node_modules', 'tabris', 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('No tabris module installed; did you run npm install?');
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
    proc.spawnSync('npm', ['run', '--if-present', 'build'], {cwd: this.appPath});
    if (this._watch) {
      const ps = proc.spawn(
        'npm',
        ['run', '--if-present', 'watch'],
        {cwd: this.appPath, stdio: 'pipe'}
      );
      ps.stdout.on('data', data => this.terminal.log(data.toString().trim()));
      ps.stderr.on('data', data => this.terminal.error(data.toString().trim()));
    }
  }

  async _startServer(main) {
    if (!Server.externalAddresses.length) {
      throw new Error('No remotely accessible network interfaces');
    }
    const app = connect();
    this._createMiddlewares(this.appPath, main).forEach(middleware => app.use(middleware));
    let port = this._port || await this._findAvailablePort();
    return new Promise((resolve, reject) => {
      this._server = app.listen(port, err => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  _startServices() {
    const webSocketServer = new WebSocket.Server({server: this._server});
    this.debugServer = new DebugServer(webSocketServer, this.terminal, this.serverId);
    this.debugServer.start();
    new KeyboardShortcutHandler(this, this._interactive).configureShortcuts();
    if (this._interactive) {
      RemoteConsole.create(this);
    }
    if (this._autoReload) {
      new AppReloader(this).start();
    }
  }

  _createMiddlewares(main) {
    return [
      this._createErrorHandler(),
      this._createRequestEmitter(),
      this._createGetFilesMiddleware(),
      this._createDeliverEmitter(),
      this._createPackageJsonMiddleware(main),
      this._createBootJsMiddleware(),
      this._createDefaultRouteMiddleware(),
      serveStatic(this.appPath),
      this._create404Handler()
    ];
  }

  _logRequest(req, err) {
    if (err) {
      this.terminal.error(red(`${req.method} ${req.url}: "${err.message || err}"`));
    } else {
      this.terminal.info(blue(`${req.method} ${req.url}`));
    }
  }

  _createErrorHandler() {
    // Error handling middlewares have four parameters.
    // The fourth parameter needs to be given although it's currently not used.
    // eslint-disable-next-line no-unused-vars
    return (err, req, res, next) => {
      this.emit('request', req, err);
      res.end();
    };
  }

  _createRequestEmitter() {
    return (req, res, next) => {
      this.emit('request', req);
      next();
    };
  }

  _createGetFilesMiddleware() {
    const fileService = new FileService({
      [join(this.appPath, 'package.json')]: JSON.stringify(this._packageJson)
    });
    const getFiles = new GetFilesMiddleware(this.appPath, fileService);
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
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify(this._packageJson));
      }
      next();
    };
  }

  _createBootJsMiddleware() {
    if (this._tabrisVersion < 3) {
      return (req, res, next) => next();
    }
    return (req, res, next) => {
      if (req.url === '/node_modules/tabris/boot.min.js') {
        res.setHeader('content-type', 'text/plain');
        return res.end(getBootJs(
          this.appPath,
          this.debugServer.getNewSessionId(),
          encodeURIComponent(this.serverId)
        ));
      }
      next();
    };
  }

  _createDefaultRouteMiddleware() {
    return async (req, res, next) => {
      if (req.url === '/') {
        res.setHeader('content-type', 'text/html');
        res.end(await this._html.generate());
      } else {
        next();
      }
    };
  }

  _create404Handler() {
    return (req, res) => {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not found\n');
      this.emit('request', req, '404: Not found');
    };
  }

  _findAvailablePort() {
    return portscanner.findAPortNotInUse(BASE_PORT, MAX_PORT, '127.0.0.1');
  }

};
