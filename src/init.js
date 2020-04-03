const program = require('commander');
const {handleErrors} = require('./helpers/errorHandler');

program.command('init')
  .description('Create a new Tabris.js app in the current directory.')
  .action(handleErrors(init));

function init() {
  const yeoman = require('yeoman-environment');

  const env = yeoman.createEnv();
  env.register(require.resolve('generator-tabris-js'));
  env.run('tabris-js');
}
