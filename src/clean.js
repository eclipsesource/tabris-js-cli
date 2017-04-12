const {removeSync} = require('fs-extra');
const program = require('commander');

const DESCRIPTION = 'Cleans build artifacts.';

program
  .command('clean')
  .description(DESCRIPTION)
  .action(() => {
    console.log('Removing build folder build/cordova');
    removeSync('build/cordova');
  });
