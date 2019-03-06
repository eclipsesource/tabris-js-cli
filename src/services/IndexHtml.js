const xml2js = require('xml2js');

const style = `
  body {
    font:13px/1.65em "HelveticaNeue","Helvetica Neue",Helvetica,Arial,sans-serif;
    color:#444;
  }
`;

module.exports = class IndexHtml {

  /**
   * @param {import('./ServerInfo')} info
   */
  constructor(info) {
    this.info = info;
  }

  /**
   * @param {Object} options
   * @param {string[]} options.urls
   * @param {number} options.mainUrl
   */
  async generate() {
    const main = await this.info.selectAddressForQRCode();
    const qrCode = await new Promise(resolve =>
      this.info.generateDataUrlQRCode(this.info.createURL(main, this.info.server.port), resolve)
    );
    const builder = new xml2js.Builder({headless: true, preserveChildrenOrder: true});
    const data = {
      html: {
        $: {lang: 'en'},
        head: {
          meta: {$: {charset: 'utf-8'}},
          title: {_: 'Tabris.js CLI'},
          style: {$: {type: 'text/css'}, _: style}
        },
        body: {
          h1: {_: 'Tabris.js CLI is running'},
          img: {$:{src: qrCode}},
          h3: {_: 'Available URLs:'},
          ul: {
            li: this.info.externalAddresses.map(address => ({
              code: {
                $: {style: 'font-weight: bold'},
                _: this.info.createURL(address, this.info.server.port)
              },
              span: {
                $: {style: 'font-style: italic'},
                _: address === main ? '(QR Code)' : ''
              }
            }))
          }
        }
      }
    };
    return '<!doctype html>\n' + builder.buildObject(data) + '\n';
  }

};
