# Tabris.js CLI

[![Build Status](https://travis-ci.org/eclipsesource/tabris-js-cli.svg?branch=master)](https://travis-ci.org/eclipsesource/tabris-js-cli)

Command line tools which make developing Tabris.js apps even easier.

## Installation

`npm install -g tabris-cli`

## Usage

### Creating a new Tabris.js project

```
tabris init
```
... will guide you through creating a Tabris.js project structure in the current directory.

### Serving a Tabris.js app

```
tabris serve
```
... will start a server you can point the [Tabris.js developer app](https://tabrisjs.com/documentation/latest/developer-app#the-tabrisjs-developer-app) to.

Request logging can be enabled using the option `--logging` or `-l`.

### Building a Tabris.js app

```
tabris build [android|ios|windows]
```

... will perform a local app build. Requires an installation of the development tools for the respective platform.
The path to the cordova platform is expected in the environment variable `TABRIS_ANDROID_PLATFORM`, `TABRIS_IOS_PLATFORM`, or `TABRIS_WINDOWS_PLATFORM`, respectively.
These platforms can be downloaded from [tabrisjs.com](https://tabrisjs.com/download).

The build type (debug or release) can set by adding either `--debug` or `--release`, while debug is the default.

The options `--device` and `--emulator` specify whether the app should be built for/ran on a device or an emulator.

The option `--verbose` will provide more verbose output.

In addition to the `build` command, the CLI supports a `run` command which behaves in the same manner as `build` but also deploys and starts the built app on a connected device or an emulator:

```
tabris run [android|ios|windows]
```

Variables in the `config.xml` are replaced by environment variables unless `--no-replace-env-vars` is given.
Additional variables can be specified with the `--variables` option:
```
tabris build [android|ios|windows] --variables FOO=bar,BAR=baz
```
will replace all occurrences of `$FOO` with `bar` and `$BAR` with `baz`.

For code signing, you can specify a build config file (see: [iOS](http://cordova.apache.org/docs/en/6.x/guide/platforms/ios/index.html#using-buildjson), [Android](http://cordova.apache.org/docs/en/6.x/guide/platforms/android/index.html#using-buildjson)) using the `--cordova-build-config=...` option. It can be relative to the `cordova/` project directory. You may want to include this file in `.gitignore` since it could contain sensitive information.

### Cleaning up build cache

To speed up the build, pre-compiled build artifacts are being reused.
To clean up the build cache, e.g. after adding or updating Cordova plug-ins, call:
```
tabris clean
```

## License

Published under the terms of the [BSD 3-Clause License](LICENSE).
