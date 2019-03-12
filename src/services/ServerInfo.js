const {green, yellow} = require('chalk');
const os = require('os');

module.exports = class ServerInfo {

  constructor(server, externalAddresses) {
    this.server = server;
    this.externalAddresses = externalAddresses;
  }

  async show() {
    let address = await this.selectAddressForQRCode();
    this.generateQRCode(this.createURL(address, this.server.port), out => this.server.terminal.log(out));
    this.server.terminal.log(yellow(
      `Available URLs:\n${this.determineAvailableURLs(this.externalAddresses, this.server.port, address)}`
    ));
  }

  createURL(address, port) {
    return `http://${address}:${port}`;
  }

  determineAvailableURLs(addresses, port, selectedAddress) {
    return addresses.map(address => {
      return '  ' + green(this.createURL(address, port) + (address === selectedAddress ? ' <= QR code' : ''));
    }).join('\n');
  }

  /**
   * Select the first IPv4 address of an external network interface.
   * If WLAN interfaces exists, the address of the first WLAN interface
   * will be returned.
   */
  async selectAddressForQRCode() {
    const firstAddress = this.externalAddresses[0];
    if (this.externalAddresses.length > 1 && os.platform() !== 'darwin') {
      try {
        return await this.getFirstWifiInterface();
      } catch(e) {
        return firstAddress;
      }
    }
    return firstAddress;
  }

  /**
   * Returns the first IPv4 address of the first connected wifi interface.
   */
  async getFirstWifiInterface() {
    try {
      const wifi = require('node-wifi');
      wifi.init();
      let connections = await wifi.getCurrentConnections();
      if(!connections.length) {
        throw new Error('No connected WiFi interface');
      }
      let firstWifiConnection = connections[0];
      let firstWifiInterface = os.networkInterfaces()[firstWifiConnection.iface];
      return firstWifiInterface.filter((address) => address.family === 'IPv4')[0].address;
    } catch(e) {
      return Promise.reject(e.message);
    }
  }

  generateQRCode(str, outputCallBack) {
    const qrcode = require('qrcode-terminal');
    return qrcode.generate(str, {small: true}, outputCallBack);
  }

};
