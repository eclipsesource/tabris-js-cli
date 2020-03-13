const {red} = require('chalk');

module.exports = {fail, handleErrors};

function fail(error) {
  console.error(red(error instanceof Error ? error.message : error));
  // require on demand due to a circular dependency issue
  require('../helpers/proc').terminate(1);
}

function handleErrors(runnable) {
  return function() {
    try {
      return runnable.apply(this, arguments);
    } catch (err) {
      fail(err);
    }
  };
}
