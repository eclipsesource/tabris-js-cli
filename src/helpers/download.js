const https = require('https');
const {createWriteStream, removeSync} = require('fs-extra');
const EventEmitter = require('events');

class FileDownloader extends EventEmitter {

  downloadFile(options, destination) {
    https
      .get(options, response => {
        let contentLength = parseInt(response.headers['content-length']);
        let downloadedBytes = 0;
        if (response.statusCode !== 200) {
          let error = new Error('Unexpected status code ' + response.statusCode);
          error.statusCode = response.statusCode;
          return this._handleError(error, destination);
        }
        let writeStream = createWriteStream(destination);
        writeStream.on('error', error => this._handleError(error, destination));
        writeStream.on('finish', () => writeStream.close(() => this._handleSuccess()));
        response.on('error', error => this._handleError(error, destination));
        response.on('data', (chunk) => {
          this.emit('progress', {
            current: downloadedBytes += chunk.length,
            total: contentLength
          });
        });
        response.pipe(writeStream);
      })
      .on('error', error => this._handleError(error, destination));
    return this;
  }

  _handleSuccess() {
    this.emit('done');
  }

  _handleError(e = new Error('Error downloading file'), destination) {
    removeSync(destination);
    this.emit('error', e);
  }

}

module.exports = {FileDownloader};
