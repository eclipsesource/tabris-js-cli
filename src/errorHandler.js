const colors = require('colors/safe');

function fail(message) {
  console.error(colors.red(message));
  process.exit(1);
}

module.exports = {fail};
