## 0.6.0

### tabris build/run

#### Support options --device and --emulator

The options `--device` and `--emulator` specify whether an app should be built for/ran on a device or an emulator.

#### Support option --verbose

`--verbose` will provide more verbose output.

## 0.5.1

### Fix missing update-notifier dependency

The runtime dependency update-notifier was declared falsely as a devDependency.

## 0.5.0

### Support build configuration for code signing with Cordova

The `build` and `run` commands now accept a build configuration file used by Cordova (see [iOS](http://cordova.apache.org/docs/en/6.x/guide/platforms/ios/index.html#using-buildjson), [Android](http://cordova.apache.org/docs/en/6.x/guide/platforms/android/index.html#using-buildjson)). It can be given using the `--cordova-build-config=...` option.

### Update notifications

The Tabris CLI will now show a notice when using an outdated version.

## 0.4.0

### Support for request logging

The `serve` command now supports the parameter `--logging` or `-l` to log all requests to the console, e.g.:

    $ tabris serve -l
    Server started.
    Point your Tabris.js client to:
      http://192.168.1.23:8080
    GET /package.json
    GET /node_modules/foo 404: "Not found"
    ...

### Build mode and platform parameters

The `build` command supports the parameters `--debug` and `--release`. These parameters are passed to the cordova build and determine the build mode.

The *platform* parameter is now required.

Parameters given after a double dash `--` are passed as *platform options* to the [cordova build](https://cordova.apache.org/docs/en/latest/reference/cordova-cli), for example:

    tabris build android -- --keystore=...

### Introduced clean command

To speed up the build, the build cache in `build/cordova` won't be cleared automatically for every build, so pre-compiled artifacts can be reused.
Use the `clean` command to clean the build cache, e.g. when changes to the `config.xml` have been made.

    tabris clean

### Introduce run command

The `run` command builds and installs a Tabris.js app on a connected device or emulator.

### Variable replacements in config.xml

It is often useful to replace variables in the `config.xml` at build time, e.g. to insert authentication tokens or build numbers. The tabris CLI will now automatically replace variables of the form `$NAME` (where `NAME` is a sequence of ASCII letters, digits, and underscore) when `<NAME>` is available as environment variable or specified in the `--variables` parameter. For example,

    tabris build android --variables FOO=bar

will replace all occurrences of `$FOO` in the config.xml with `bar`.

The additional variables `$IS_DEBUG` and `$IS_RELEASE` will be replaced by `true` or `false` depending on the build type. This allows to set preferences according to the build type, e.g. to enable the developer console only for debug builds:

    <preference name="EnableDeveloperConsole" value="$IS_DEBUG"/>

Environment variables will always be replaced unless the parameter `--no-replace-env-vars` is specified.

## 0.3.0

### Add build task to perform local builds

The CLI now supports local app builds.

The build tools for the target platform must be installed on your system (Android SDK for Android, XCode for iOS, and Visual Studio for Windows. The path to the respective cordova platform (downloaded from [tabrisjs.com](https://tabrisjs.com/download)) is expected in the environment variable `TABRIS_ANDROID_PLATFORM`, `TABRIS_IOS_PLATFORM`, or `TABRIS_WINDOWS_PLATFORM`, respectively.

With these preparations, builds can be started with

```
tabris build [android|ios|windows]
```

## 0.2.0

### Upgrade to Tabris.js 2.0.0 Beta 2

Set the tabris dependency of generated projects to `2.0.0-beta1`.

## 0.1.0

### Support scaffolding a Tabris.js project

`tabris init` configures a new Tabris.js project in the current directory.

### Support serving a Tabris.js app

`tabris serve` starts a server, which a Tabris.js developer app can connect to.
