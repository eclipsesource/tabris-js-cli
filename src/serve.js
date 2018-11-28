const {handleErrors, fail} = require('./helpers/errorHandler');
const program = require('commander');
const Terminal = require('./services/Terminal');
const Server = require('./services/Server');

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
  const terminal = Terminal.create();
  let server = new Server({
    terminal,
    watch: options.watch,
    requestLogging: options.logging,
    interactive: options.interactive,
    autoReload: options.autoReload
  });
  server.serve(options.project || process.cwd(), options.main).catch(fail);
}
