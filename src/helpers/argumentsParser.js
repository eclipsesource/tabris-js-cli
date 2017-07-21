function parseVariables(string) {
  if (!string) {
    return {};
  }
  let result = {};
  string
    .split(',')
    .forEach(assignment => {
      if (!assignment.includes('=')) {
        handleInvalidAssignment(assignment);
      }
      let parts = assignment.trim().split('=');
      if (parts[0] === '') {
        handleInvalidAssignment(assignment);
      }
      result[parts[0]] = parts[1];
    });
  return result;
}

function handleInvalidAssignment(assignment) {
  throw new Error(`Invalid variable assignment "${assignment}"`);
}

exports.parseVariables = parseVariables;
