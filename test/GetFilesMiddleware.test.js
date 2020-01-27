const {join, normalize, posix} = require('path');
const GetFilesMiddleware = require('../src/services/GetFilesMiddleware');
const {expect, restore, spy, stub} = require('./test');
const {getDebugClient} = require('../src/services/getBootJs');

const APP_PATH = normalize('/projectdir');

const source = 'Object.assign(exports, {module, require, __filename, __dirname, bar: true});';
const isFile = () => true;

/*globals debugClient: false */
describe('GetFilesMiddleware', () => {

  /** @type {GetFilesMiddleware} */
  let middleware;

  /** @type {import('../src/services/FileService')} */
  let fileService;

  beforeEach(function() {
    fileService = {
      getDir: stub().returns([]),
      getFileContent: stub().throws('No file content to get')
    };
    middleware = new GetFilesMiddleware(APP_PATH, fileService);
    spy(middleware, 'handleRequest');
  });

  afterEach(() => {
    restore();
  });

  describe('via preLoader', function() {

    let preLoader;

    beforeEach(function() {
      global.tabris = {
        Module: {
          execute(code) {
            return eval(code);
          },
          load(url) {
            const end = stub();
            const setHeader = stub();
            const next = stub();
            try {
              middleware.handleRequest({url: url.slice(1)}, {end, setHeader}, next);
              if (end.notCalled && next.calledOnce) {
                return null;
              } else if (end.calledOnce) {
                return end.firstCall.args[0];
              }
            } catch (ex) {
              console.error(ex.message);
              console.error(ex.stack);
            }
            throw new Error(`Inconsistent handleRequest behavior ${end.callCount}/${next.callCount}`);
          },
          createLoader: stub().returns('orgCreateLoader'),
          readJSON: stub().returns('orgReadJSON'),
          getSourceMap: stub().returns('orgGetSourceMap')
        }
      };
      eval(getDebugClient(''));
      preLoader = new debugClient.ModulePreLoader();
    });

    afterEach(function() {
      delete global.debugClient;
      delete global.tabris;
    });

    describe('patchModuleClass', function() {

      let orgCreateLoader, orgReadJSON, orgGetSourceMap;

      beforeEach(function() {
        orgCreateLoader = global.tabris.Module.createLoader;
        orgReadJSON = global.tabris.Module.readJSON;
        orgGetSourceMap = global.tabris.Module.getSourceMap;
        stub(preLoader, 'createLoader').returns('preLoaderCreateLoader');
        stub(preLoader, 'readJSON').returns('preLoaderReadJSON');
        stub(preLoader, 'getSourceMap').returns('preLoaderGetSourceMap');
        debugClient.ModulePreLoader.patchModuleClass(preLoader);
      });

      it('delegates createLoader to pre-loader', function() {
        expect(global.tabris.Module.createLoader('./foo/bar')).to.equal('preLoaderCreateLoader');
        expect(preLoader.createLoader).to.have.been.calledWith('./foo/bar');
        expect(orgCreateLoader).not.to.have.been.called;
      });

      it('delegates readJSON to pre-loader', function() {
        expect(global.tabris.Module.readJSON('./foo/bar')).to.equal('preLoaderReadJSON');
        expect(preLoader.readJSON).to.have.been.calledWith('./foo/bar');
        expect(orgReadJSON).not.to.have.been.called;
      });

      it('delegates getSourceMap to pre-loader', function() {
        expect(global.tabris.Module.getSourceMap('./foo/bar')).to.equal('preLoaderGetSourceMap');
        expect(preLoader.getSourceMap).to.have.been.calledWith('./foo/bar');
        expect(orgGetSourceMap).not.to.have.been.called;
      });

      it('does not delegate createLoader with absolute URL', function() {
        expect(global.tabris.Module.createLoader('file://foo/bar')).to.equal('orgCreateLoader');
        expect(preLoader.createLoader).not.to.have.been.called;
        expect(orgCreateLoader).to.have.been.calledWith('file://foo/bar');
      });

      it('does not delegate readJSON with absolute URL', function() {
        expect(global.tabris.Module.readJSON('file://foo/bar')).to.equal('orgReadJSON');
        expect(preLoader.readJSON).not.to.have.been.called;
        expect(orgReadJSON).to.have.been.calledWith('file://foo/bar');
      });

      it('does not delegate getSourceMap with absolute URL', function() {
        expect(global.tabris.Module.getSourceMap('file://foo/bar')).to.equal('orgGetSourceMap');
        expect(preLoader.getSourceMap).not.to.have.been.called;
        expect(orgGetSourceMap).to.have.been.calledWith('file://foo/bar');
      });

    });

    describe('with no files found', function() {

      it('createLoader returns null', function() {
        expect(preLoader.createLoader('./foo/bar')).to.be.null;
      });

      it('readJSON returns null', function() {
        expect(preLoader.readJSON('./foo/bar.json')).to.be.null;
      });

      it('does not send request for same directory twice', function() {
        preLoader.createLoader('./foo/bar');
        preLoader.readJSON('./foo/bar.json');

        expect(middleware.handleRequest).to.have.been.calledOnce;
      });

      it('sends two requests for two different directories', function() {
        preLoader.createLoader('./foo/bar');
        preLoader.readJSON('./baz/bar.json');

        expect(middleware.handleRequest).to.have.been.calledTwice;
      });

    });

    describe('with .js, and .json files', function() {

      beforeEach(function() {
        fileService.getDir.withArgs(join(APP_PATH, 'foo')).returns([
          {isFile, name: 'bar.js'},
          {isFile, name: 'baz.json'}
        ]);
        fileService.getDir.withArgs(join(APP_PATH, 'baz')).returns([{isFile, name: 'file.json'}]);
        fileService.getFileContent.withArgs(join(APP_PATH, 'foo'), 'bar.js').returns(source);
        fileService.getFileContent.withArgs(join(APP_PATH, 'foo'), 'baz.json').returns('{"baz": true}');
        fileService.getFileContent.withArgs(join(APP_PATH, 'baz'), 'file.json').returns('{}');
      });

      it('createLoader returns loader function', function() {
        const loader = preLoader.createLoader('./foo/bar.js');

        expect(loader).to.be.instanceOf(Function);
      });

      it('emits deliver event', function() {
        const listener = spy();
        middleware.on('deliver', listener);

        preLoader.createLoader('./foo/bar.js');

        expect(listener).to.have.been.calledWith(posix.join(posix.normalize(APP_PATH), 'foo', 'bar.js'));
        expect(listener).to.have.been.calledWith(posix.join(APP_PATH, 'foo', 'baz.json'));
      });

      it('createLoader names parameters', function() {
        const barModule = {exports: {}, require: function() {}};

        const loader = preLoader.createLoader('./foo/bar.js');
        loader(barModule, barModule.exports, barModule.require, 'bar.js', './foo');

        expect(barModule.exports.module).to.equal(barModule);
        expect(barModule.exports.require).to.equal(barModule.require);
        expect(barModule.exports.__filename).to.equal('bar.js');
        expect(barModule.exports.__dirname).to.equal('./foo');
      });

      it('readJSON returns parsed json content', function() {
        expect(preLoader.readJSON('./foo/baz.json').baz).to.be.true;
      });

      it('does not send request for same directory twice', function() {
        expect(preLoader.createLoader('./foo/bar.js')).to.be.instanceof(Function);
        expect(preLoader.readJSON('./foo/baz.json')).to.be.instanceOf(Object);
        expect(middleware.handleRequest).to.have.been.calledOnce;
      });

      it('sends two requests for two different directories', function() {
        expect(preLoader.readJSON('./foo/baz.json')).to.be.instanceOf(Object);
        expect(preLoader.readJSON('./baz/file.json')).to.be.instanceOf(Object);
        expect(middleware.handleRequest).to.have.been.calledTwice;
      });

    });

    describe('with source maps', function() {

      /* eslint-disable max-len */

      const bar_js = '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nconst tabris_1 = require("tabris");\nnew tabris_1.TextView({ text: \'foo\' }).appendTo(tabris_1.contentView);';

      const bar_source_map = '{"version":3,"file":"bar.js","sourceRoot":"","sources":["../bar.ts"],"names":[],"mappings":";;AAAA,mCAA6C;AAC7C,IAAI,iBAAQ,CAAC,EAAC,IAAI,EAAE,KAAK,EAAC,CAAC,CAAC,QAAQ,CAAC,oBAAW,CAAC,CAAC"}';

      const bar_source_map_url = '\n//# sourceMappingURL=bar.js.map';

      const bar_source_map_b64 = '\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vYmFyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsbUNBQTZDO0FBQzdDLElBQUksaUJBQVEsQ0FBQyxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxvQkFBVyxDQUFDLENBQUMifQ==';

      const bar_source_map_data = '\n//# sourceMappingURL=data:application/json,%7B%22version%22%3A3%2C%22file%22%3A%22bar.js%22%2C%22sourceRoot%22%3A%22%22%2C%22sources%22%3A%5B%22..%2Fbar.ts%22%5D%2C%22names%22%3A%5B%5D%2C%22mappings%22%3A%22%3B%3BAAAA%2CmCAA6C%3BAAC7C%2CIAAI%2CiBAAQ%2CCAAC%2CEAAC%2CIAAI%2CEAAE%2CKAAK%2CEAAC%2CCAAC%2CCAAC%2CQAAQ%2CCAAC%2CoBAAW%2CCAAC%2CCAAC%22%7D';

      /* eslint-enable max-len */

      beforeEach(function() {
        fileService.getDir.withArgs(join(APP_PATH, 'foo')).returns([
          {isFile, name: 'bar.js'},
          {isFile, name: 'bar-inline.js'},
          {isFile, name: 'bar-inline-b64.js'},
          {isFile, name: 'bar.js.map'},
          {isFile, name: 'baz.js'},
          {isFile, name: 'baz2.js'}
        ]);
        fileService.getFileContent.withArgs(join(APP_PATH, 'foo'), 'bar.js').returns(bar_js + bar_source_map_url);
        fileService.getFileContent.withArgs(join(APP_PATH, 'foo'), 'bar-inline.js')
          .returns(bar_js + bar_source_map_data);
        fileService.getFileContent.withArgs(join(APP_PATH, 'foo'), 'bar-inline-b64.js')
          .returns(bar_js + bar_source_map_b64);
        fileService.getFileContent.withArgs(join(APP_PATH, 'foo'), 'bar.js.map').returns(bar_source_map);
        fileService.getFileContent.withArgs(join(APP_PATH, 'foo'), 'baz.js').returns(source);
        fileService.getFileContent.withArgs(join(APP_PATH, 'foo'), 'baz2.js')
          .returns(source + '\n//# sourceMappingURL=baz2.js.map');
      });

      it('getSourceMap with no source found returns null', function() {
        const sourceMap = preLoader.getSourceMap('./foo/does-not-exist.js');

        expect(sourceMap).to.be.be.null;
      });

      it('getSourceMap with no source map url found returns null', function() {
        const sourceMap = preLoader.getSourceMap('./foo/baz.js');

        expect(sourceMap).to.be.be.null;
      });

      it('getSourceMap with no source map file found returns null', function() {
        const sourceMap = preLoader.getSourceMap('./foo/baz2.js');

        expect(sourceMap).to.be.be.null;
      });

      it('getSourceMap with inline source map returns source map', function() {
        const sourceMap = preLoader.getSourceMap('./foo/bar-inline.js');

        expect(sourceMap).to.deep.equal(JSON.parse(bar_source_map));
      });

      it('getSourceMap with inline base64 source map returns source map', function() {
        const sourceMap = preLoader.getSourceMap('./foo/bar-inline-b64.js');

        expect(sourceMap).to.deep.equal(JSON.parse(bar_source_map));
      });

      it('getSourceMap with external source map returns source map', function() {
        const sourceMap = preLoader.getSourceMap('./foo/bar.js');

        expect(sourceMap).to.deep.equal(JSON.parse(bar_source_map));
      });

      it('does not send request for same directory twice', function() {
        preLoader.getSourceMap('./foo/bar-inline.js');
        preLoader.getSourceMap('./foo/bar-inline.js');
        preLoader.getSourceMap('./foo/bar.js');
        preLoader.getSourceMap('./foo/bar.js');

        expect(middleware.handleRequest).to.have.been.calledOnce;
      });

      it('returns same source map instance', function() {
        const map1a = preLoader.getSourceMap('./foo/bar-inline.js');
        const map1b = preLoader.getSourceMap('./foo/bar-inline.js');
        const map2a = preLoader.getSourceMap('./foo/bar.js');
        const map2b = preLoader.getSourceMap('./foo/bar.js');

        expect(map1a === map1b).to.be.true;
        expect(map2a === map2b).to.be.true;
      });

    });

    describe('with non-js/json/map files', function() {

      beforeEach(function() {
        fileService.getDir.withArgs(join(APP_PATH, 'foo')).returns([
          {isFile, name: 'bar'},
          {isFile, name: 'baz'}
        ]);
      });

      it('requests non-js entries separately', function() {
        const loader = preLoader.createLoader('./foo/baz');

        expect(loader).to.be.null;
        expect(middleware.handleRequest).to.have.been.calledTwice;
        expect(middleware.handleRequest.getCall(0).args[1].end).to.have.been.calledOnce; // 'req.end'
        expect(middleware.handleRequest.getCall(1).args[2]).to.have.been.calledOnce; // 'next'
      });

      it('requests non-json entries separately', function() {
        const loader = preLoader.readJSON('./foo/baz');

        expect(loader).to.be.null;
        expect(middleware.handleRequest).to.have.been.calledTwice;
        expect(middleware.handleRequest.getCall(0).args[1].end).to.have.been.calledOnce; // 'req.end'
        expect(middleware.handleRequest.getCall(1).args[2]).to.have.been.calledOnce; // 'next'
      });

    });

    describe('with non-files entries found', function() {

      beforeEach(function() {
        fileService.getDir.withArgs(join(APP_PATH, 'foo')).returns([
          {isFile: () => false, name: 'bar.js'},
          {isFile: () => false, name: 'baz.json'}
        ]);
      });

      it('createLoader returns null', function() {
        expect(preLoader.createLoader('./foo/bar')).to.be.null;
      });

      it('readJSON returns null', function() {
        expect(preLoader.readJSON('./foo/bar.json')).to.be.null;
      });

      it('getSourceMap returns null', function() {
        expect(preLoader.getSourceMap('./foo/bar')).to.be.null;
      });

      it('does not send request for same directory twice', function() {
        preLoader.createLoader('./foo/bar');
        preLoader.readJSON('./foo/bar.json');
        preLoader.getSourceMap('./foo/bar');

        expect(middleware.handleRequest).to.have.been.calledOnce;
      });

    });

    describe('with files in root directory', function() {

      beforeEach(function() {
        fileService.getDir.withArgs(APP_PATH).returns([
          {isFile, name: 'bar.js'},
          {isFile, name: 'baz.json'}
        ]);
        fileService.getFileContent.withArgs(APP_PATH, 'bar.js').returns(source);
        fileService.getFileContent.withArgs(APP_PATH, 'baz.json').returns('{"baz": true}');
      });

      it('createLoader returns loader function', function() {
        const loader = preLoader.createLoader('./bar.js');
        expect(loader).to.be.instanceOf(Function);
      });

      it('readJSON returns parsed json content', function() {
        expect(preLoader.readJSON('./baz.json').baz).to.be.true;
      });

    });

  });

});
