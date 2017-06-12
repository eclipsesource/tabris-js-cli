const {red} = require('chalk');

module.exports = {fail, handleErrors};

function fail(message) {
  console.error(red(message));
  process.exit(1);
}

function handleErrors(runnable) {
  return function() {
    try {
      return runnable.apply(this, arguments);
    } catch (err) {
      fail('Error: ' + err);
    }
  };
}
