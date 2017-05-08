const {removeSync} = require('fs-extra');
const program = require('commander');
const {handleErrors} = require('./errorHandler');

const DESCRIPTION = 'Cleans build artifacts.';

program
  .command('clean')
  .description(DESCRIPTION)
  .action(handleErrors(() => {
    console.log('Removing build folder build/cordova');
    removeSync('build/cordova');
  }));
