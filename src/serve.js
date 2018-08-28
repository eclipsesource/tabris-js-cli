const {handleErrors, fail} = require('./helpers/errorHandler');
const program = require('commander');
const {red, blue} = require('chalk');
const ServerInfo = require('./services/ServerInfo');
const RemoteConsoleUI = require('./services/RemoteConsoleUI');
const Watcher = require('./services/Watcher');

program
  .command('serve')
  .option('-p, --project [path]', 'path to the project root')
  .option('-m, --main [module]', 'main module of the project, overrides the "main" field of package.json if present')
  .option('-a, --auto-reload', 'auto reload the application when a source file is modified')
  .option('-i, --interactive', 'enable interactive console for JavaScript input')
  .option('-l, --logging', 'enable request logging')
  .option('-w, --watch', 'execute the "watch" instead of the "build" script of the app before serving')
  .description('Serves a Tabris.js app from the current or a given project directory. If a ' +
    'build script is present in package.json, it is executed beforehand.')
  .action(handleErrors(serve));

function serve(options) {
  const Server = require('./services/Server');
  const externalAddresses = Server.externalAddresses;

  let server = new Server({watch: options.watch});
  if (options.logging) {
    server.on('request', logRequest);
  }
  server.serve(options.project || process.cwd(), options.main)
      .then(() => {
        if (options.interactive) {
          new RemoteConsoleUI(server._debugServer);
        }
        if (options.autoReload) {
          new Watcher(server).start();
        }
        new ServerInfo(server, externalAddresses).show();
      })
      .catch(fail);
}

function logRequest(req, err) {
  if (err) {
    console.error(red(`${req.method} ${req.url} ${err.status}: "${err.message || err}"`));
  } else {
    console.info(blue(`${req.method} ${req.url}`));
  }
}
