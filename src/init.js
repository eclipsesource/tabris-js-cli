const program = require('commander');
const spawn = require('cross-spawn');
const path = require('path');

program.command('init')
  .description('Create a new Tabris.js project in the current directory.')
  .action(() => spawn(path.join(__dirname, '..', 'node_modules', '.bin', 'yo'), ['tabris-js'], {stdio: 'inherit'}));
