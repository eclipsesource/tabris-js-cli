const temp = require('temp');
const fetch = require('node-fetch');
const {join} = require('path');
const Server = require('../src/services/Server');
const Watcher = require('../src/services/Watcher');
const {expect, restore, spy} = require('./test');
const {writeFileSync, realpathSync} = require('fs-extra');


describe('Watcher', function() {

  let server, path, oldCwd, watcher;

  beforeEach(function() {
    path = realpathSync(temp.mkdirSync('foo'));
    oldCwd = process.cwd();
    process.chdir(path);
    server = new Server();
    watcher = new Watcher(server);
    watcher.start();
  });

  afterEach(function() {
    process.chdir(oldCwd);
    watcher.stop();
    restore();
  });

  it('send reload command when file is watched', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    writeFileSync(join(path, 'foo.js'), 'console.log("test")');
    return server.serve(path)
      .then(() => fetch(`http://127.0.0.1:${server.port}/foo.js`))
      .then(response => response.text())
      .then(text => {
        spy(server._debugServer, 'send');
        writeFileSync(join(path, 'foo.js'), `${text};`);
        return waitForCalls(server._debugServer.send, 1)
          .then(log =>
            expect(log).to.contain('tabris.app.reload()')
          );
      });
  }).timeout(3000);

  it('do not send reload command when changed file is not watched', function() {
    writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
    writeFileSync(join(path, 'foo.js'), 'console.log("test")');
    return server.serve(path)
      .then(() => fetch(`http://127.0.0.1:${server.port}/foo.js`))
      .then(response => response.text())
      .then(text => {
        spy(server._debugServer, 'send');
        writeFileSync(join(path, 'bar.js'), `${text};`);
        return new Promise(resolve => {
          setTimeout(() => {
            expect(server._debugServer.send).not.to.have.been.called;
            resolve();
          }, 1500);
        });
      });
  }).timeout(3000);

});

function waitForCalls(spyInstance, minCallCount = 1) {
  let attempts = 0;
  const maxAttempts = 25;
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
      } else if (++attempts > maxAttempts || spyInstance.callCount > minCallCount) {
        clearInterval(interval);
        reject();
      }
    }, 100);
  });
}
