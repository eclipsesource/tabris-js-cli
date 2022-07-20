const {XMLBuilder} = require('fast-xml-parser');

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
    const mainUrl = await this.info.selectUrlForQRCode();
    const qrCode = await new Promise(resolve =>
      this.info.generateDataUrlQRCode(this.info.formatUrl(mainUrl), resolve)
    );
    const multiAddress = this.info.externalURLs.length > 1;
    const data = {
      html: {
        '@_lang': 'en',
        head: {
          meta: {'@_charset': 'utf-8'},
          title: 'Tabris.js CLI',
          style: {'@_type': 'text/css', '#text': style},
        },
        body: {
          h1: 'Tabris.js CLI is running',
          p: {
            span: 'Scan the QR Code below using the ',
            a: {
              '@_href': 'https://docs.tabris.com/latest/developer-app.html',
              '@_target': '_blank',
              '@_rel': 'noreferrer',
              '#text': 'Tabris.js Developer App'
            }
          },
          img: {'@_src': qrCode},
          h3: multiAddress ? 'Available URLs:' : 'URL:',
          ul: {
            li: this.info.externalURLs.map(url => ({
              code: {
                '@_style': 'font-weight: bold',
                '#text': this.info.formatUrl(url)
              },
              span: {
                '@_style': 'font-style: italic',
                '#text': ((url.host === mainUrl.host) && multiAddress) ? '(QR Code)' : ''
              }
            }))
          }
        }
      }
    };
    const builder = new XMLBuilder({ignoreAttributes: false, suppressEmptyNode: true});
    const result = builder.build(data);
    return '<!doctype html>\n' + result + '\n';
  }

};
