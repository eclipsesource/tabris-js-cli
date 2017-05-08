const program = require('commander');
const yeoman = require('yeoman-environment');
const {handleErrors} = require('./errorHandler');

program.command('init')
  .description('Create a new Tabris.js project in the current directory.')
  .action(handleErrors(() => {
    let env = yeoman.createEnv();
    env.register(require.resolve('generator-tabris-js'));
    env.run('tabris-js');
  }));
