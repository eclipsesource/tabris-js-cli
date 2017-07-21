function command(command, cwd = './') {
  console.log(`[${cwd}]`, command);
}

module.exports = {command};
