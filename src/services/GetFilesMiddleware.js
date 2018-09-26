const {posix, join} = require('path');
const {URL} = require('url');
const EventEmitter = require('events');

const GET_FILES = 'getfiles';
const DUMMY_URI_SCHEME = 'file://';
const LOCAL_FILES = '*';
const PROJECT_DIR_PLACEHOLDER = '/package.json';

module.exports = class GetFilesMiddleware extends EventEmitter {

  constructor(appPath, fs) {
    super();
    this._appPath = appPath;
    this._fs = fs;
  }

  handleRequest(req, res, next) {
    const params = new URL(req.url, DUMMY_URI_SCHEME).searchParams;
    if (params.get(GET_FILES)) {
      const param = decodeURIComponent(params.get(GET_FILES));
      if (param !== LOCAL_FILES) {
        throw new Error(`Invalid parameter ${GET_FILES}=${param}`);
      }
      return res.json(this._generateChunk(this._getLocalPath(req.url)));
    }
    next();
  }

  _getLocalPath(url) {
    const path = url.split('?')[0];
    if (path === PROJECT_DIR_PLACEHOLDER) {
      return '.';
    }
    return '.' + path;
  }

  _generateChunk(localPath) {
    return {[localPath]: this._getDirContent(localPath)};
  }

  _getDirContent(localPath) {
    const result = {};
    const path = join(this._appPath, localPath);
    this._fs.getDir(path).forEach(entry => {
      if (!entry.isFile()) {
        return;
      }
      const name = entry.name;
      result[name] = {};
      if (name.endsWith('.js') || name.endsWith('.json')) {
        result[name].content = this._fs.getFileContent(path, name);
        this.emit('deliver', posix.join(localPath, name));
      }
    });
    return result;
  }

};
