#!/usr/bin/env node

const program = require('commander');
const packageJson = require('../package.json');
const updateNotifier = require('update-notifier');

require('./init');
require('./serve');
require('./build');
require('./clean');

updateNotifier({pkg: packageJson}).notify({defer: false});

program.version(packageJson.version);
program.on('*', () =>
  program.commands.some(command => command._name === process.argv[0]) || program.help()
).parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
