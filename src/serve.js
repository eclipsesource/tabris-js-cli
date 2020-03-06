const {handleErrors, fail} = require('./helpers/errorHandler');
const program = require('commander');
const Terminal = require('./services/Terminal');
const Server = require('./services/Server');

program
  .command('serve')
  .option('-p, --project [path]', 'path to the project root')
  .option('-m, --main [module]', 'main module of the project, overrides the "main" field of package.json if present')
  .option('-a, --auto-reload', 'auto reload the application when a source file is modified')
  .option('-i, --interactive', 'enable interactive console for JavaScript input (experimental)')
  .option('-l, --logging', 'Logs requests to the internal HTTP server of the CLI.' +
    ' Useful for debugging connection issues during app sideloading.'
  )
  .option('-w, --watch', 'execute the "watch" instead of the "build" script of the app before serving')
  .option('--no-intro', 'do not print the available external URLs or QR code.')
  .option('--qrcode-renderer <renderer>',
    '"utf8" (default) based on UTF-8 characters and "terminal" based on background color customization of ' +
    'the cursor color. Use "terminal" if the QR code presentation breaks due to the font used in the terminal.',
    value => checkOption('qrcode-renderer', ['utf8', 'terminal'], value))
  .option('--external [url]', 'use this url as the advertised public URL')
  .option('--port [url]', 'use this port for the HTTP server')
  .description('Serves a Tabris.js app from the current or a given project directory. If a ' +
    'build script is present in package.json, it is executed beforehand.')
  .action(handleErrors(serve));

function serve(options) {
  const terminal = Terminal.create(options);
  let server = new Server({
    terminal,
    watch: options.watch,
    requestLogging: options.logging,
    interactive: options.interactive,
    autoReload: options.autoReload,
    qrcodeRenderer: options.qrcodeRenderer,
    noIntro: !options.intro,
    external: options.external,
    port: options.port
  });
  server.serve(options.project || process.cwd(), options.main).catch(fail);
}

function checkOption(property, validOptions, option) {
  const validOptionsString = validOptions.map(value => `"${value}"`).join(', ') ;
  if (!validOptions.includes(option)) {
    fail(`Unsupported value for ${property} "${option}". Use one of ${validOptionsString}`);
  }
  return option;
}
