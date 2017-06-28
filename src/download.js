const https = require('https');
const fs = require('fs-extra');

const ERROR_DOWNLOADING_FILE = new Error('Error downloading file');

function downloadFile(options, destination) {
  return new Promise((resolve, reject) => {
    let writeStream = fs.createWriteStream(destination);
    writeStream.on('error', reject);
    writeStream.on('finish', () => writeStream.close(() => resolve()));
    https
      .get(options, response => {
        if (response.statusCode !== 200) {
          let error = new Error('Unexpected status code ' + response.statusCode);
          error.statusCode = response.statusCode;
          reject(error);
        }
        response.on('error', () => reject(ERROR_DOWNLOADING_FILE));
        response.pipe(writeStream);
      })
      .on('error', () => reject(ERROR_DOWNLOADING_FILE));
  });
}

module.exports = {downloadFile};
