const yauzl = require('yauzl');
const fs = require('fs-extra');
const {join, dirname} = require('path');

const ERROR_UNZIPPING_FILE = new Error('Error unzipping file');

function unzip(source, destination) {
  return new Promise((resolve, reject) => {
    yauzl.open(source, {lazyEntries: true}, (err, zipfile) => {
      if (err) {
        return reject(ERROR_UNZIPPING_FILE);
      }
      zipfile.readEntry();
      zipfile.on('error', () => reject(ERROR_UNZIPPING_FILE));
      zipfile.on('close', () => resolve());
      zipfile.on('entry', (entry) => {
        let entryDestination = join(destination, entry.fileName);
        if (/\/$/.test(entry.fileName)) { // directory
          fs.mkdirsSync(entryDestination);
          zipfile.readEntry();
        } else { // file
          fs.mkdirsSync(dirname(entryDestination));
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              return reject(ERROR_UNZIPPING_FILE);
            }
            let writeStream = fs.createWriteStream(entryDestination);
            writeStream.on('error', () => reject(ERROR_UNZIPPING_FILE));
            readStream.on('error', () => reject(ERROR_UNZIPPING_FILE));
            readStream.pipe(writeStream);
            zipfile.readEntry();
          });
        }
      });
    });
  });
}

module.exports = {unzip};
