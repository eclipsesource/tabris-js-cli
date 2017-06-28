const yazl = require('yazl');
const {realpathSync, writeFileSync, createWriteStream, readFileSync, outputFileSync} = require('fs-extra');
const {join} = require('path');
const {expect} = require('./test');
const {unzip} = require('../src/zip');
const {createTmpDir} = require('./tmp');

describe('zip', function() {

  describe('unzip', function() {

    let cwd;

    beforeEach(function() {
      return createTmpDir('test').then(dir => {
        cwd = realpathSync(dir);
      });
    });

    it('rejects when zip is an invalid file', function() {
      let path = join(cwd, 'invalidZip.zip');
      writeFileSync(path, 'foo');
      return unzip(path).then(() => {
        throw 'Expected rejection';
      }).catch(e => {
        expect(e.message).to.equal('Error unzipping file');
      });
    });

    it('unzips archive', function() {
      let extractedPath = join(cwd, 'destination');
      let zipPath = join(cwd, 'fakeZip.zip');
      outputFileSync(join(cwd, 'foo.file'), 'foo');
      outputFileSync(join(cwd, 'bar.file'), 'bar');
      return createZipWithFiles(zipPath, [
        {path: join(cwd, 'foo.file'), zipPath: 'foo.file'},
        {path: join(cwd, 'bar.file'), zipPath: 'a/long/path/bar.file'}
      ]).then(() => unzip(zipPath, extractedPath))
        .then(() => {
          expect(readFileSync(join(extractedPath, 'foo.file'), 'utf8')).to.equal('foo');
          expect(readFileSync(join(extractedPath, 'a','long', 'path', 'bar.file'), 'utf8')).to.equal('bar');
        });
    });

  });

});

function createZipWithFiles(destination, files) {
  return new Promise((resolve, reject) => {
    let zipFile = new yazl.ZipFile();
    files.forEach(({path, zipPath}) => {
      zipFile.addFile(path, zipPath);
    });
    zipFile.outputStream.pipe(createWriteStream(destination))
      .on('close', () => resolve(destination))
      .on('error', reject);
    zipFile.end();
  });
}
