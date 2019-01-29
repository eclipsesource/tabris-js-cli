# readline

This is a slightly stripped down copy of the built-in node module "readline" taken from https://github.com/nodejs/node/tree/c3fd50463f2d3b6be54ebf8b4dbb85157bc08c3f.

The reason for its inclusion here is that the properties 'line' and 'cursor' are not documented in the official node documentation, but are absolutely required for Terminal.js to function. By using a copy the risk of breaking changes in "readline" is eliminated.
