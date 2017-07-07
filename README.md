# Tabris.js CLI

[![Build Status](https://travis-ci.org/eclipsesource/tabris-js-cli.svg?branch=master)](https://travis-ci.org/eclipsesource/tabris-js-cli)

The super tool for Tabris.js developers.

## Table of Contents
* [Installation](#installation)
* [Commands](#commands)
  + [`tabris init`](#tabris-init)
  + [`tabris serve [options] [path]`](#tabris-serve-options-path)
  + [`tabris build [options] <platform>`](#tabris-build-options-platform)
  + [`tabris run [options] <platform>`](#tabris-run-options-platform)
  + [`tabris clean`](#tabris-clean)
* [License](#license)

## Installation

`npm install -g tabris-cli`

## Commands

### `tabris init`

Creates a new Tabris.js app in the current directory.

*See: [Quick Start Guide - Tabris.js Documentation](https://tabrisjs.com/documentation/2.0/getting-started.html)*

### `tabris serve [options] [path]`

Starts a server the [Tabris.js developer app](https://tabrisjs.com/documentation/2.0/developer-app) can be pointed to.

#### path

The file or directory to serve the Tabris.js app from. When ommitted, the current working directory is served.

#### options

##### `-l, --logging`

Enables request logging.

### `tabris build [options] <platform>`

Builds a Tabris.js app for the given platform.

To speed up the build, pre-compiled build artifacts are kept in a build cache and are reused in subsequent builds. To clean up the build cache, e.g. after updating Cordova plug-ins, run `tabris clean`.

*See: [Building a Tabris.js app - Tabris.js Documentation](https://tabrisjs.com/documentation/2.0/build.html)*

#### platform

One of `ios`, `android` or `windows`.

#### options

*Default options*:

  * `--debug`
  * `--emulator`
  * `--cordova-build-config=./build.json`

##### `--variables <replacements>`

Comma-separated list of variable replacements in config.xml. `--variables FOO=bar,BAK=baz` will replace all occurrences of `$FOO` and `$BAK` in config.xml with respectively `bar` and `baz`.

*Note: per default all environment variables are replaced in config.xml. To prevent that, use the `--no-replace-env-vars` option.*

##### `--cordova-build-config <path>`

Path to a build configuration file passed to Cordova. Relative to the `cordova/` directory.

See Cordova platform documentation ([iOS](https://cordova.apache.org/docs/en/6.x/guide/platforms/ios/index.html#using-buildjson), [Android](https://cordova.apache.org/docs/en/6.x/guide/platforms/android/index.html#using-buildjson)) for more information about the file format.

You may want to include this file in `.gitignore` since it may contain sensitive information.

##### `--debug`

Perform a debug build. Used for development.

##### `--release`

Perform a release build. Used when building apps for the marketplace of their platform.

##### `--emulator`

Build the app for an emulator.

##### `--device`

Build the app for a device.

##### `--no-replace-env-vars`

Do not replace environment variables in config.xml.

*See `--variables` documentation for more information about variable replacement in config.xml.*

##### `--verbose`

Print more verbose output.

### `tabris run [options] <platform>`

Builds a Tabris.js app and runs it on a connected device or emulator.

Uses same parameters as `tabris build`.

*See: [Building a Tabris.js app - Tabris.js Documentation](https://tabrisjs.com/documentation/2.0/build.html)*

### `tabris clean`

Removes build artifacts.

## License

Published under the terms of the [BSD 3-Clause License](LICENSE).
