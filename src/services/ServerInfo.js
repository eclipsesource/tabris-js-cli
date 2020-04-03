const {blue} = require('chalk');
const os = require('os');
const {URL} = require('url');

module.exports = class ServerInfo {

  /**
   * @param {import('./Server')} server
   * @param {URL[]} externalURLs
   * @param {boolean} noIntro
   */
  constructor(server, externalURLs, noIntro, qrcodeRenderer) {
    this.server = server;
    this.externalURLs = externalURLs;
    this.noIntro = noIntro;
    this.qrcodeRenderer = qrcodeRenderer || 'utf8';
  }

  async show() {
    const mainUrl = await this.selectUrlForQRCode();
    if (this.noIntro) {
      this.server.terminal.message('CLI running on port ' + this.server.port);
    } else {
      this.generateTextQRCode(this.formatUrl(mainUrl), out => this.server.terminal.output(out));
      this.server.terminal.infoBlock({title: 'Available URLs:', body: this.determineAvailableURLs(mainUrl)});
    }
  }

  /**
   * @param {URL} url
   */
  formatUrl(url) {
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    return `${url.protocol}//${url.hostname}:${port}`;
  }

  /**
   * @param {URL} mainUrl
   */
  determineAvailableURLs(mainUrl) {
    return this.externalURLs.map(url =>
      blue(this.formatUrl(url) + (url.host === mainUrl.host ? ' <= QR code' : ''))
    ).join('\n');
  }

  /**
   * Select the first IPv4 address of an external network interface.
   * If WLAN interfaces exists, the address of the first WLAN interface
   * will be returned.
   */
  async selectUrlForQRCode() {
    const firstUrl = this.externalURLs[0];
    if (this.externalURLs.length > 1 && os.platform() !== 'darwin') {
      try {
        return new URL(`http://${await this.getFirstWifiAddress()}:${this.server.port}`);
      } catch(e) {
        return firstUrl;
      }
    }
    return firstUrl;
  }

  /**
   * Returns the first IPv4 address of the first connected wifi interface.
   */
  async getFirstWifiAddress() {
    try {
      const wifi = require('node-wifi');
      wifi.init();
      const connections = await wifi.getCurrentConnections();
      if(!connections.length) {
        throw new Error('No connected WiFi interface');
      }
      const firstWifiConnection = connections[0];
      const firstWifiInterface = os.networkInterfaces()[firstWifiConnection.iface];
      return firstWifiInterface.filter((address) => address.family === 'IPv4')[0].address;
    } catch(e) {
      return Promise.reject(e.message);
    }
  }

  generateTextQRCode(str, outputCallBack) {
    const qrcode = require('qrcode');
    qrcode.toString(str, {type: this.qrcodeRenderer}, (error, result) => {
      if (error) {
        console.warn(error);
        outputCallBack('');
      } else {
        outputCallBack(result);
      }
    });
  }

  generateDataUrlQRCode(str, outputCallBack) {
    const qrcode = require('qrcode');
    qrcode.toDataURL(str, {margin: 0, scale: 8}, (error, result) => {
      if (error) {
        console.warn(error);
        outputCallBack('');
      } else {
        outputCallBack(result.trim());
      }
    });
  }

};
