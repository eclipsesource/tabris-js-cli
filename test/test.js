const chai = require('chai');
const {expect} = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

chai.use(sinonChai);

let sandbox = sinon.sandbox.create();
let spy = sandbox.spy.bind(sandbox);
let stub = sandbox.stub.bind(sandbox);
let restore = sandbox.restore.bind(sandbox);

module.exports = {expect, spy, stub, restore};
