const {handleErrors, fail} = require('./helpers/errorHandler');
const program = require('commander');
const {green, yellow, red, blue} = require('chalk');

program
  .command('serve [path]')
  .option('-l, --logging', 'enable request logging')
  .option('-w, --watch', 'execute the "watch" instead of the "build" script of the app before serving')
  .description('Serves a Tabris.js app from a directory or a file. If a ' +
    'build script is present in package.json, it is executed beforehand.')
  .action(handleErrors(serve));

function serve(inputPath, options) {
  const Server = require('./services/Server');

  let server = new Server({watch: options.watch});
  if (options.logging) {
    server.on('request', (req, err) => {
      if (err) {
        console.error(red(`${req.method} ${req.url} ${err.status}: "${err.message || err}"`));
      } else {
        console.info(blue(`${req.method} ${req.url}`));
      }
    });
  }
  server.serve(inputPath || process.cwd()).then(() => {
    const webSocketHost = Server.externalAddresses[0];
    console.info(yellow('Server started.\nPoint your Tabris.js client to:\n'),
      Server.externalAddresses.map(address => green(`  http://${address}:${server.port}`)).join('\n'),
      '\n',
      yellow(`Debug WebSocket: ws://${webSocketHost}:${server.wsPort}`));
  }).catch((err) => {
    fail(err);
  });
}
