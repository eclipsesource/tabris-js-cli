const chai = require('chai');
const {expect} = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const temp = require('temp').track();
const {platform} = require('os');
const {writeFileSync, mkdirSync} = require('fs-extra');
const {join} = require('path');

chai.use(sinonChai);

let sandbox = sinon.sandbox.create();
let spy = sandbox.spy.bind(sandbox);
let stub = sandbox.stub.bind(sandbox);
let match = sinon.match;
let createStubInstance = sinon.createStubInstance;

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

function writeTabrisProject(path, projectPackage, tabrisPackage) {
  if (projectPackage !== false) {
    writeFileSync(join(path, 'package.json'), projectPackage || '{"main": "foo.js"}');
  }
  writeFileSync(join(path, 'foo.js'), 'console.log("test")');
  if (tabrisPackage !== false) {
    mkdirSync(join(path, 'node_modules'), {recursive: true});
    mkdirSync(join(path, 'node_modules', 'tabris'), {recursive: true});
    writeFileSync(join(path, 'node_modules', 'tabris', 'package.json'), tabrisPackage || '{"version": "3.0.0"}');
    writeFileSync(join(path, 'node_modules', 'tabris', 'boot.min.js'));
  }
}

function waitForCalls(spyInstance, minCallCount = 1, maxDelay = 1500) {
  let attempts = 0;
  const maxAttempts = Math.ceil(maxDelay / 100);
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (spyInstance.callCount === minCallCount) {
        clearInterval(interval);
        let messages = [];
        for (const call of spyInstance.getCalls()) {
          messages.push(call.args
            .map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
            .join(''));
        }
        resolve(messages.join('\n'));
      } else if (++attempts > maxAttempts) {
        clearInterval(interval);
        reject(new Error('Timeout while waiting for calls'));
      } else if (spyInstance.callCount > minCallCount) {
        clearInterval(interval);
        reject(new Error('Called more often than expected'));
      }
    }, 100);
  });
}

module.exports = {expect, spy, stub, createStubInstance, match, restore, writeTabrisProject, waitForCalls};
