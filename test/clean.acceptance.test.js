const {join} = require('path');
const {existsSync, realpathSync, mkdirsSync} = require('fs-extra');
const {spawnSync} = require('child_process');
const temp = require('temp');
const expect = require('chai').expect;
const {restore} = require('./test');

const tabris = join(__dirname, '../src/tabris');
const mockBinDir = join(__dirname, 'bin');

describe('clean', function() {

  this.timeout(10000);

  let cwd, env, opts;

  beforeEach(function() {
    let dir = temp.mkdirSync('test');
    cwd = realpathSync(dir);
    env = {PATH: mockBinDir + ':' + process.env.PATH};
    opts = {cwd, env, encoding: 'utf8'};
  });

  afterEach(restore);

  it('removes build folder', function() {
    mkdirsSync(join(cwd, 'build/cordova'));

    let result = spawnSync('node', [tabris, 'clean'], opts);

    expect(result.stderr).to.equal('');
    expect(result.stdout).to.contain('Removing build/ folder') ;
    expect(existsSync(join(cwd, 'build/cordova'))).to.be.false;
    expect(existsSync(join(cwd, 'build'))).to.be.false;
    expect(result.status).to.equal(0);
  });

  it('does not fail when folder does not exist', function() {
    let result = spawnSync('node', [tabris, 'clean'], opts);

    expect(result.stderr).to.equal('');
    expect(result.stdout).to.contain('Removing build/ folder') ;
    expect(result.status).to.equal(0);
  });

});
