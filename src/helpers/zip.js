const yauzl = require('yauzl');
const fs = require('fs-extra');
const {join, dirname} = require('path');
const {spawnSync} = require('./proc');
const os = require('os');

const ERROR_UNZIPPING_FILE = new Error('Error unzipping file');

function unzip(source, destination) {
  if (os.platform() === 'darwin') {
    return nativeUnzip(source, destination);
  }
  return yauzlUnzip(source, destination);
}


function yauzlUnzip(source, destination) {
  return new Promise((resolve, reject) => {
    yauzl.open(source, {lazyEntries: true}, (err, zipfile) => {
      if (err) {
        return reject(ERROR_UNZIPPING_FILE);
      }
      zipfile.readEntry();
      zipfile.on('error', () => reject(ERROR_UNZIPPING_FILE));
      zipfile.on('close', () => setTimeout(resolve, 100)); // on windows close may take a few ms after returning
      zipfile.on('entry', (entry) => {
        const entryDestination = join(destination, entry.fileName);
        if (/\/$/.test(entry.fileName)) { // directory
          fs.mkdirsSync(entryDestination);
          zipfile.readEntry();
        } else { // file
          fs.mkdirsSync(dirname(entryDestination));
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              return reject(ERROR_UNZIPPING_FILE);
            }
            const writeStream = fs.createWriteStream(entryDestination);
            writeStream.on('error', () => reject(ERROR_UNZIPPING_FILE));
            readStream.on('error', () => reject(ERROR_UNZIPPING_FILE));
            readStream.on('end', () => zipfile.readEntry());
            readStream.pipe(writeStream);
          });
        }
      });
    });
  });
}

function nativeUnzip(source, destination) {
  try {
    spawnSync('unzip', [source, '-d', destination]);
    return Promise.resolve();
  } catch (ex) {
    return Promise.reject(new Error('Error unzipping file'));
  }
}

module.exports = {unzip};
