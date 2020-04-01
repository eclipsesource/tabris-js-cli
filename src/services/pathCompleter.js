const path = require('path');
const fs = require('fs');

/**
 * A file system path completer for Node.js readline.
 * Adopted from https://github.com/DBarthe/readline-path-completer
 * License: MIT, author DBarthe
 */

/**
 * @param {string} line
 * @param {(error: string, result: [string[], string]) => void} callback
 */
function pathCompleter(line, callback) {
  let result;
  let error;
  try {
    result = pathCompleterSync(line);
  } catch(e) {
    error = e;
  } finally {
    callback(error, result);
  }
}

/**
 * @param {string} line
 */
function pathCompleterSync(line) {
  const [folder, name] = parseLine(line);
  const normalizedLine = path.normalize(line);
  try {
    if (!fs.lstatSync(folder).isDirectory(folder)) {
      return [[], normalizedLine];
    }
    const resultList = fs.readdirSync(folder, {withFileTypes: true})
      .filter(file => file.name.indexOf(name) === 0)
      .map(dirent => dirent.name + (dirent.isDirectory() ? '/' : ''))
      .map(file => folder + '/' + file)
      .map(ln => path.normalize(ln));
    return [resultList, normalizedLine];
  } catch (err) {
    return [[], normalizedLine];
  }
}

function parseLine(line) {
  if (line.length === 0) {
    return ['./', ''];
  }
  if (line[line.length - 1] === path.sep) {
    return [line.slice(0, line.length - 1) , ''];
  }
  return [path.dirname(line), path.basename(line)];
}

module.exports = {pathCompleter, pathCompleterSync};
