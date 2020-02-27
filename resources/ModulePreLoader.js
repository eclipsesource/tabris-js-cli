/* global tabris:false debugClient:true */
(function() {

  const modulePrefix = '(function (module, exports, require, __filename, __dirname) { ';
  const modulePostfix = '\n});';

  // regular expressions and their usage based on
  // https://github.com/lydell/source-map-url/blob/f13c43ca675379922f26c87737fdcbbeac07eb09/source-map-url.js
  // https://github.com/lydell/source-map-resolve/blob/858cd9e2ecce25427761b8be616cabf704c69316/lib/source-map-resolve-node.js
  // Copyright 2014 Simon Lydell
  // X11 (“MIT”) Licensed.
  // https://github.com/lydell/source-map-url/blob/f13c43ca675379922f26c87737fdcbbeac07eb09/LICENSE
  // https://github.com/lydell/source-map-resolve/blob/858cd9e2ecce25427761b8be616cabf704c69316/LICENSE
  const innerRegex = /[#@] sourceMappingURL=([^\s'"]*)/.source;
  const sourceMapUrl = new RegExp(
    '(?:/\\*(?:\\s*\r?\n(?://)?)?(?:' + innerRegex + ')\\s*\\*/|//(?:' + innerRegex + '))\\s*'
  );
  const dataUriRegex = /^data:([^,;]*)(;[^,;]*)*(?:,(.*))?$/;
  const jsonMimeTypeRegex = /^(?:application|text)\/json$/;

  // atob based on
  // https://github.com/MaxArt2501/base64-js/blob/39729b0e836f86398d6ebf1fb6d70c9f307bec0b/base64.js
  // Copyright 2014 MaxArt2501
  // MIT Licensed.
  // https://github.com/MaxArt2501/base64-js/blob/39729b0e836f86398d6ebf1fb6d70c9f307bec0b/LICENSE
  const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const b64re = /^(?:[A-Za-z\d+/]{4})*?(?:[A-Za-z\d+/]{2}(?:==)?|[A-Za-z\d+/]{3}=?)?$/;
  function atob(value) {
    let str = value.replace(/[\t\n\f\r ]+/g, '');
    if (!b64re.test(str)) {
      throw new Error('Failed to decode base64 string.');
    }
    str += '=='.slice(2 - (str.length & 3));
    let bitmap, result = '', r1, r2, i = 0;
    for (; i < str.length;) {
      bitmap = b64.indexOf(str.charAt(i++)) << 18 | b64.indexOf(str.charAt(i++)) << 12
        | (r1 = b64.indexOf(str.charAt(i++))) << 6 | (r2 = b64.indexOf(str.charAt(i++)));
      result += r1 === 64 ? String.fromCharCode(bitmap >> 16 & 255)
        : r2 === 64 ?
          String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255)
          : String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255, bitmap & 255);
    }
    return result;
  }

  debugClient.ModulePreLoader = class ModulePreLoader {

    static patchModuleClass() {
      const loader = arguments.length === 1 ? arguments[0] : new ModulePreLoader();
      this.patchMethod(tabris.Module, loader, 'createLoader');
      this.patchMethod(tabris.Module, loader, 'readJSON');
      this.patchMethod(tabris.Module, loader, 'getSourceMap');
    }

    static patchMethod(target, source, name) {
      const org = target[name];
      target[name] = function(url) {
        if (url.indexOf('://') !== -1) {
          return org.call(target, url);
        }
        return source[name](url);
      };
    }

    constructor() {
      this._dirs = {};
      this._sourceMaps = {};
    }

    createLoader(url) {
      const file = this._getFile(url);
      if (!file || !file.content) {
        return null;
      }
      try {
        return tabris.Module.execute(modulePrefix + file.content + modulePostfix, file.path);
      } catch (ex) {
        throw new Error('Could not parse ' + url + ':' + ex);
      }
    }

    getSourceMap(url) {
      if (!(url in this._sourceMaps)) {
        try {
          const src = this._load(url) || '';
          if (sourceMapUrl.test(src)) {
            const match = src.match(sourceMapUrl);
            const mapUri = (match ? match[1] || match[2] || '' : '');
            const dataUriMatch = mapUri.match(dataUriRegex);
            if (dataUriMatch) {
              const mimeType = dataUriMatch[1] || '';
              if (jsonMimeTypeRegex.test(mimeType)) {
                const encodedMap = (dataUriMatch[3] || '').replace(/^\)\]\}'/, '');
                this._sourceMaps[url] = JSON.parse(
                  dataUriMatch[2] === ';base64' ? atob(encodedMap) : decodeURIComponent(encodedMap)
                );
              } else {
                this._sourceMaps[url] = null;
                throw new Error('Unexpected source map mime type: "' + mimeType + '"');
              }
            } else if (mapUri) {
              this._sourceMaps[url] = this.readJSON(url.slice(0, url.lastIndexOf('/')) + '/' + mapUri);
            } else {
              this._sourceMaps[url] = null;
            }
          }
        } catch (ex) {
          console.warn('Error loading source map ' + url);
          this._sourceMaps[url] = null;
        }
      }
      return this._sourceMaps[url] || null;
    }

    readJSON(url) {
      const src = this._load(url);
      if (!src) {
        return null;
      }
      try {
        return JSON.parse(src);
      } catch (ex) {
        throw new Error('Could not parse ' + url);
      }
    }

    _load(url) {
      const file = this._getFile(url);
      return file ? file.content : null;
    }

    _getFile(url) {
      const slash = url.lastIndexOf('/');
      const dir = url.slice(0, slash);
      const file = url.slice(slash + 1);
      const files = this._getFiles(dir);
      if (!files[file]) {
        return null;
      }
      if (!('content' in files[file])) {
        files[file].content = tabris.Module.load(url);
      }
      return files[file];
    }

    _getFiles(dir) {
      if (!this._dirs[dir]) {
        // can not use '.' as a request to client.load:
        const url = (dir === '.' ? './package.json' : dir)
          + '?getfiles='
          + encodeURIComponent('*');
        const response = tabris.Module.load(url);
        if (!response) {
          throw new Error(`Failed to load directory ${dir}`);
        }
        try {
          Object.assign(this._dirs, JSON.parse(response));
        } catch (ex) {
          throw new Error(`Failed to parse response: ${ex}`);
        }
        if (!this._dirs[dir]) {
          throw new Error(`Directory ${dir} missing in response ${response}`);
        }
      }
      return this._dirs[dir];
    }

  };

})();
