const chai = require('chai');
const {expect} = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const temp = require('temp').track();
const {platform} = require('os');

chai.use(sinonChai);

let sandbox = sinon.sandbox.create();
let spy = sandbox.spy.bind(sandbox);
let stub = sandbox.stub.bind(sandbox);
let match = sinon.match;

function restore() {
  sandbox.restore();
  try {
    temp.cleanupSync();
  } catch (ex) {
    console.warn('Could not delete temporary test files: ' + ex);
    if (platform() === 'win32') {
      console.info('This is a currently unresolvable windows/node issue.');
      console.info('Clearing the users temporary files folder may help.');
    }
  }
}

module.exports = {expect, spy, stub, match, restore};
