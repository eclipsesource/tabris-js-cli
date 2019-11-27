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
    const mainUrl = await this.info.selectUrlForQRCode();
    const qrCode = await new Promise(resolve =>
      this.info.generateDataUrlQRCode(this.info.formatUrl(mainUrl), resolve)
    );
    const builder = new xml2js.Builder({headless: true, preserveChildrenOrder: true});
    const multiAddress = this.info.externalURLs.length > 1;
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
          p: {
            span: {
              _: 'Scan the QR Code below using the',
            },
            a: {
              _: 'Tabris.js Developer App',
              $: {
                href: 'https://docs.tabris.com/latest/developer-app.html',
                target: '_blank',
                rel: 'noreferrer'
              }
            }
          },
          img: {$:{src: qrCode}},
          h3: {_: multiAddress ? 'Available URLs:' : 'URL:'},
          ul: {
            li: this.info.externalURLs.map(url => ({
              code: {
                $: {style: 'font-weight: bold'},
                _: this.info.formatUrl(url)
              },
              span: {
                $: {style: 'font-style: italic'},
                _: ((url.host === mainUrl.host) && multiAddress) ? '(QR Code)' : ''
              }
            }))
          }
        }
      }
    };
    return '<!doctype html>\n' + builder.buildObject(data) + '\n';
  }

};
