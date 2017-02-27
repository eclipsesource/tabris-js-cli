# Tabris.js CLI

[![Build Status](https://travis-ci.org/eclipsesource/tabris-js-cli.svg?branch=master)](https://travis-ci.org/eclipsesource/tabris-js-cli)

Command line tools which make developing Tabris.js apps even easier.

## Installation

`npm install -g tabris-cli`

## Usage

### Creating a new Tabris.js project

```sh
tabris init
```
... will guide you through creating a Tabris.js project structure in the current directory.

### Serving a Tabris.js app
```sh
tabris serve
```
... will start a server you can point the [Tabris.js developer app](https://tabrisjs.com/documentation/latest/developer-app#the-tabrisjs-developer-app) to.

## Development

Clone the repository:

```sh
$ git clone git@github.com:eclipsesource/tabris-js-cli.git
```

Then inside the project directory run:
```sh
$ npm link
```
... to create a [globally installed symbolic link](https://docs.npmjs.com/cli/link) to the module.

## Project Goals
A Command Line Interface (CLI) could be used to:

### Initialize a Tabris.js project

 * Delegate to yeoman

### Start an application (serve files and folders)

In contrast to an HTTP server, the CLI could offer more capabilities

 * Take care of caching modes
 * Serve also snippet files without the need for a package.json
 * Transpile ES6 or typescript on the fly
 * Keep track of changes and notify the client

### Build locally

 * prepare cordova folder layout in build folder
 * copy transpiled sources
 * start cordova build

## License

Published under the terms of the [BSD 3-Clause License](LICENSE).
