const program = require('commander');
const yeoman = require('yeoman-environment');

program.command('init')
  .description('Create a new Tabris.js project in the current directory.')
  .action(() => {
    let env = yeoman.createEnv();
    env.register(require.resolve('generator-tabris-js'));
    env.run('tabris-js');
  });
