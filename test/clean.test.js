const {join} = require('path');
const {existsSync, realpathSync, mkdirsSync} = require('fs-extra');
const {spawnSync} = require('child_process');
const temp = require('temp').track();
const expect = require('chai').expect;

const tabris = join(__dirname, '../src/tabris');
const mockBinDir = join(__dirname, 'bin');

describe('clean', function() {

  let cwd, env, opts;

  beforeEach(function() {
    let dir = temp.mkdirSync('test');
    cwd = realpathSync(dir);
    env = {PATH: mockBinDir + ':' + process.env.PATH};
    opts = {cwd, env, encoding: 'utf8'};
  });

  it('removes build/cordova folder', function() {
    mkdirsSync(join(cwd, 'build/cordova'));

    let result = spawnSync('node', [tabris, 'clean'], opts);

    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('Removing build folder build/cordova') ;
    expect(existsSync(join(cwd, 'build/cordova'))).to.be.false;
  });

  it('does not fail when folder does not exist', function() {
    let result = spawnSync('node', [tabris, 'clean'], opts);

    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('Removing build folder build/cordova') ;
  });

});
