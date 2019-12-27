# Tabris.js CLI

[![Build Status](https://travis-ci.org/eclipsesource/tabris-js-cli.svg?branch=master)](https://travis-ci.org/eclipsesource/tabris-js-cli)

A command line tool to create, build and serve Tabris.js apps.

## Table of Contents
* [Installation](#installation)
* [Commands](#commands)
  + [`tabris init`](#tabris-init)
  + [`tabris serve [options] [path]`](#tabris-serve-options-path)
  + [`tabris build [options] <platform> [cordova-platform-opts...]`](#tabris-build-options-platform-cordova-platform-opts)
  + [`tabris run [options] <platform> [cordova-platform-opts...]`](#tabris-run-options-platform-cordova-platform-opts)
  + [`tabris clean`](#tabris-clean)
  + [Common `tabris run` and `tabris build` parameters](#common-tabris-run-and-tabris-build-parameters)
* [License](#license)

## Installation

`npm install -g tabris-cli`

## Commands

### `tabris init`

Creates a new Tabris.js app in the current directory.

*See: [Quick Start Guide - Tabris.js Documentation](https://docs.tabris.com/2.0/getting-started.html)*

### `tabris serve [options]`

Starts a server the [Tabris.js developer app](https://docs.tabris.com/2.0/developer-app) can be pointed to. If a build script is present in package.json, it is executed beforehand.

#### options

##### `-p [path], --project [path]`

The directory to serve the Tabris.js app from. Needs to contain a package.json and installed "tabris" module. When omitted, the current working directory is served.

##### `-m [module], --main [module]`

Overrides the "main" field of package.json. The argument must be a valid module id relative to the project root, e.g. "dist/main.js".

##### `-a, --auto-reload`

Auto reload the application when a source file is modified.

##### `-i, --interactive`

Enable interactive console for JavaScript input.

##### `-l, --logging`

Logs requests to the internal HTTP server of the CLI. Useful for debugging connection issues during app sideloading.

##### `-w, --watch`

Executes the _watch_ instead of the _build_ script given in the package.json of the app before serving. The _watch_ script can be a long-running task.

##### `--no-intro`

Does not print the available external URLs or QR code to the console, only the port. They can still be viewed by opening the given port in a browser.

##### `--external [url]`

Uses the given string as the advertised public URL, to the exclusion of all other. Must include protocol and port. Should be used with `--port` to ensure the actual port matches this one.

##### `--port [port]`

Changes the port the HTTP server listens to. Causes an error if the port is not available.

### `tabris build [options] <platform> [cordova-platform-opts]`

Builds a Tabris.js app for the given platform.

To speed up the build, pre-compiled build artifacts are kept in a build cache and are reused in subsequent builds. To clean up the build cache, e.g. after updating Cordova plug-ins, run `tabris clean`.

*See: [Building a Tabris.js app - Tabris.js Documentation](https://docs.tabris.com/2.0/build.html)*

*See: [Common `tabris run` and `tabris build` parameters](#common-tabris-run-and-tabris-build-parameters)*

### `tabris run [options] <platform> [cordova-platform-opts]`

Builds a Tabris.js app and runs it on a connected device or emulator.

*See: [Building a Tabris.js app - Tabris.js Documentation](https://docs.tabris.com/2.0/build.html)*

*See: [Common `tabris run` and `tabris build` parameters](#common-tabris-run-and-tabris-build-parameters)*

#### options

##### `--target <id>`

The ID of the target device to deploy the app to. See `--list-targets`.

##### `--list-targets`

Show a list of available targets to use with `--target <id>`.

### `tabris clean`

Removes build artifacts.

### Common `tabris run` and `tabris build` parameters

#### platform

`ios` or `android`.

#### options

*Default options*:

  * `--debug`
  * `--cordova-build-config=./build.json`

_Note: when neither `--emulator` nor `--device` is specified and a device is connected, the app will be built for a device. If no device is connected, the app will be built for an emulator._

##### `--variables <replacements>`

Comma-separated list of variable replacements in config.xml. `--variables FOO=bar,BAK=baz` will replace all occurrences of `$FOO` and `$BAK` in config.xml with respectively `bar` and `baz`.

*Note: per default all environment variables are replaced in config.xml. To prevent that, use the `--no-replace-env-vars` option.*

##### `--cordova-build-config <path>`

Path to a build configuration file passed to Cordova. Relative to the `cordova/` directory.

See Cordova platform documentation ([iOS](https://cordova.apache.org/docs/en/latest/guide/platforms/ios/index.html#using-buildjson), [Android](https://cordova.apache.org/docs/en/latest/guide/platforms/android/index.html#using-buildjson)) for more information about the file format.

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

#### cordova-platform-opts

Platform-specific options passed to Cordova.

*See: [Platform-specific options - Cordova CLI Reference](https://cordova.apache.org/docs/en/latest/reference/cordova-cli/#platform-specific-options)*

## License

Published under the terms of the [BSD 3-Clause License](LICENSE).
