const program = require('commander');
const {handleErrors} = require('./errorHandler');

program.command('init')
  .description('Create a new Tabris.js app in the current directory.')
  .action(handleErrors(() => {
    const yeoman = require('yeoman-environment');

    let env = yeoman.createEnv();
    env.register(require.resolve('generator-tabris-js'));
    env.run('tabris-js');
  }));
