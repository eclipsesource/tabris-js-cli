const {readFileSync, existsSync, lstatSync, readdirSync, readlinkSync} = require('fs-extra');
const {join} = require('path');

module.exports = class FileService {

  constructor(overlay) {
    this._overlay = overlay;
  }

  /** @param {string} path */
  getDir(path) {
    if (this._isDir(path)) {
      let list = readdirSync(path, {withFileTypes: true});
      return list.map(this._toFileEntry(path));
    }
    return [];
  }

  getFileContent(dir, name) {
    const path = join(dir, name);
    return this._overlay[path] || readFileSync(path, 'utf-8');
  }

  _toFileEntry(path) {
    // Older versions of node do not support "withFileTypes" option
    return function(entry) {
      if (entry instanceof Object) {
        return entry;
      }
      return {name: entry, isFile: () => lstatSync(join(path, entry)).isFile()};
    };
  }

  /** @param {string} path */
  _isDir(path) {
    if (!existsSync(path)) {
      return false;
    }
    const stat = lstatSync(path);
    if (stat.isDirectory(path)) {
      return true;
    }
    if (stat.isSymbolicLink()) {
      return this._isDir(readlinkSync(path));
    }
    return false;
  }

};
