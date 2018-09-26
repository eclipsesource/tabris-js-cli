const {join, normalize} = require('path');
const {readFileSync} = require('fs-extra');
const GetFilesMiddleware = require('../src/services/GetFilesMiddleware');
const {expect, restore, spy, stub} = require('./test');

const APP_PATH = normalize('/projectdir');

const source = 'Object.assign(exports, {module, require, __filename, __dirname, bar: true});';
const isFile = () => true;

/*globals debugClient: false */
describe('GetFilesMiddleware', () => {

  let middleware, fileService;

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
        _client: {
          load(url) {
            const json = spy();
            const next = spy();
            try {
              middleware.handleRequest({url: url.slice(1)}, {json}, next);
              if (json.notCalled && next.calledOnce) {
                return null;
              } else if (json.calledOnce) {
                return JSON.stringify(json.firstCall.args[0]);
              }
            } catch (ex) {
              console.error(ex.message);
              console.error(ex.stack);
            }
            throw new Error(`Inconsistent handleRequest behavior ${json.callCount}/${next.callCount}`);
          }
        }
      };
      eval(readFileSync(join(__dirname, '..', 'resources', 'debugClient.js'), 'utf8'));
      preLoader = new debugClient.ModulePreLoader();
    });

    afterEach(function() {
      delete global.debugClient;
      delete global.tabris;
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

    describe('with .js and .json files', function() {

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

    describe('with non-js/json files', function() {

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
        expect(middleware.handleRequest.getCall(0).args[1].json).to.have.been.calledOnce; // 'req.json'
        expect(middleware.handleRequest.getCall(1).args[2]).to.have.been.calledOnce; // 'next'
      });

      it('requests non-json entries separately', function() {
        const loader = preLoader.readJSON('./foo/baz');

        expect(loader).to.be.null;
        expect(middleware.handleRequest).to.have.been.calledTwice;
        expect(middleware.handleRequest.getCall(0).args[1].json).to.have.been.calledOnce; // 'req.json'
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

      it('does not send request for same directory twice', function() {
        preLoader.createLoader('./foo/bar');
        preLoader.readJSON('./foo/bar.json');

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
