const {red} = require('chalk');

module.exports = {fail, handleErrors};

function fail(error) {
  console.error(red(error instanceof Error ? error.message : error));
  process.exit(1);
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
