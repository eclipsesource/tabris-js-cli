#!/usr/bin/env node

const program = require('commander');
const spawn = require('cross-spawn');
const path = require('path');
const packageJson = require('./package.json');

program
  .version(packageJson.version)
  .command('init')
  .description('Create a new Tabris.js project in the current directory.')
  .action(() => spawn(path.join(__dirname, 'node_modules', '.bin', 'yo'), ['tabris-js'], {stdio: 'inherit'}));

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
