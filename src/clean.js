const program = require('commander');
const {handleErrors} = require('./helpers/errorHandler');

const DESCRIPTION = 'Cleans build artifacts.';

program
  .command('clean')
  .description(DESCRIPTION)
  .action(handleErrors(clean));

function clean() {
  const {removeSync} = require('fs-extra');
  console.log('Removing build folder build/cordova');
  removeSync('build/cordova');
}
