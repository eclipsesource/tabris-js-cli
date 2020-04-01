const {writeFileSync, readdirSync, statSync} = require('fs-extra');
const {join} = require('path');
const temp = require('temp');
const {expect, restore} = require('./test');
const {pathCompleterSync} = require('../src/services/pathCompleter');

describe('pathCompleter', function() {

  let folderPath;

  beforeEach(function() {
    folderPath = temp.mkdirSync('foo');
  });

  afterEach(() => {
    restore();
  });

  it('suggests contents of current working directory when no path given', () => {
    let [suggestions] = pathCompleterSync('');

    expect(suggestions).to.deep.equal(readdirSync('.').map(appendSlashToDirectoryNames));
  });

  it('suggests contents of current working directory when ./ as path given', () => {
    let [suggestions] = pathCompleterSync('./');

    expect(suggestions).to.deep.equal(readdirSync('.').map(appendSlashToDirectoryNames));
  });

  it('suggests directory path with / suffix when directory path without / suffix given', () => {
    let [suggestions] = pathCompleterSync(folderPath);

    expect(suggestions.length).to.equal(1);
    expect(suggestions[0]).to.equal(folderPath + '/');
  });

  it('suggests same file path when file path given', () => {
    let barFilePath = join(folderPath, 'bar');
    writeFileSync(barFilePath);
    let [suggestions] = pathCompleterSync(barFilePath);

    expect(suggestions.length).to.equal(1);
    expect(suggestions[0]).to.equal(barFilePath);
  });

  it('does not suggest anything when file path with / suffix given', () => {
    let barFilePath = join(folderPath, 'bar');
    writeFileSync(barFilePath);
    let [suggestions] = pathCompleterSync(barFilePath + '/');

    expect(suggestions.length).to.equal(0);
  });

  it('suggests files in directory when directory path with / suffix given', () => {
    const barFilePath = join(folderPath, 'bar');
    writeFileSync(barFilePath);
    let [suggestions] = pathCompleterSync(folderPath + '/');

    expect(suggestions.length).to.equal(1);
    expect(suggestions[0]).to.equal(barFilePath);
  });

  it('suggests matching files when directory path and file prefix given', () => {
    let barFilePath = join(folderPath, 'bar');
    let baFilePath = join(folderPath, 'ba');
    let carFilePath = join(folderPath, 'car');
    writeFileSync(barFilePath);
    writeFileSync(baFilePath);
    writeFileSync(carFilePath);
    let [suggestions] = pathCompleterSync(join(folderPath, 'b'));

    expect(suggestions.length).to.equal(2);
    expect(suggestions[0]).to.equal(baFilePath);
    expect(suggestions[1]).to.equal(barFilePath);
  });

});

const appendSlashToDirectoryNames = dir => dir + (statSync(dir).isDirectory() ? '/' : '');
