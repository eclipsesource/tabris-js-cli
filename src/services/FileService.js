const {readFileSync, existsSync, lstatSync, readdirSync} = require('fs-extra');
const {join} = require('path');

module.exports = class FileService {

  constructor(overlay) {
    this._overlay = overlay;
  }

  getDir(path) {
    if (existsSync(path) && lstatSync(path).isDirectory()) {
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

};
