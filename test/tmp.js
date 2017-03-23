const temp = require('temp').track();

function createTmpDir(name) {
  return new Promise((resolve, reject) => {
    temp.mkdir(name, (err, path) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

exports.createTmpDir = createTmpDir;
