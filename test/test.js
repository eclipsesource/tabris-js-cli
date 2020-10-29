const chai = require('chai');
const stripAnsi = require('strip-ansi');
const {expect} = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const temp = require('temp').track();
const {platform} = require('os');
const {writeFileSync, mkdirSync} = require('fs-extra');
const {join} = require('path');

chai.use(sinonChai);

const sandbox = sinon.sandbox.create();
const spy = sandbox.spy.bind(sandbox);
const stub = sandbox.stub.bind(sandbox);
const match = sinon.match;
const createStubInstance = sinon.createStubInstance;

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
    writeFileSync(join(path, 'node_modules', 'tabris', 'boot.min.js'), '');
  }
}

function waitForCalls(spyInstance, minCallCount = 1, maxDelay = 1500) {
  let attempts = 0;
  const maxAttempts = Math.ceil(maxDelay / 100);
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (spyInstance.callCount === minCallCount) {
        clearInterval(interval);
        const messages = [];
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

function waitForStdout(process, timeout = 2000) {
  let stdout = '';
  process.stdout.on('data', data => {
    stdout += stripAnsi(data);
  });
  return new Promise((resolve, reject) => {
    process.stderr.on('data', data => {
      if (stripAnsi(data.toString()) === '') {
        return;
      }
      reject(new Error('waitForStdout rejected with stderr ' + stripAnsi(data.toString())));
    });
    setTimeout(() => resolve(stdout), timeout);
  });
}

function waitForStderr(process, timeout = 2000) {
  return new Promise((resolve, reject) => {
    process.stderr.on('data', data => {
      if (stripAnsi(data.toString()) === '') {
        return;
      }
      resolve(stripAnsi(data.toString()));
    });
    setTimeout(() => reject('waitForStderr timed out'), timeout);
  });
}

module.exports = {
  expect,
  spy,
  stub,
  createStubInstance,
  match,
  restore,
  writeTabrisProject,
  waitForStdout,
  waitForStderr,
  waitForCalls
};
