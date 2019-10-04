## 3.2.0

* The `init` command now provides an option to generate a MVVM example

## 3.1.0

* No changes

## 3.0.0

* No changes

## 3.0.0 rc1

* Now compatible with both Tabris.js 2.x and 3.x Apps
* The `init` command now supports generating unit tests for 3.x Apps

## 3.0.0 beta1

`tabris serve`:
* QR code containing app URL for scanning with developer app
* App console logs output on developer machine (last connected device only)
* New option `-i` enables interactive JavaScript console sending commands to last connected device
* New option `-a` enables automatic app reload on source code changes
* New option `-p` allows specification of project to serve (independent from "main" js files)
* New option `-m` allows specification of "main" js file to serve (independent from project path)
* Removed path parameter (now replaced by `-p` and `-m` options)

`tabris build`:
* Remove support for Windows builds

## 2.5.0

`tabris clean` will now remove the whole "build/" directory with all of its contents. Previously, it only removed "build/cordova".

## 2.4.0

Improve error handling for non-interactive shells.

## 2.3.0

Update generator dependency to a version compatible with Tabris.js 2.3.0.

## 2.2.0

* Support serving snippets from subdirectories of the current working directory. Previously, only serving snippets from the current working directory was possible.
* Only exclude node_modules directory in the root app directory from being copied to the built app. Tabris.js CLI is only responsible for installation of production Node dependencies in the root app directory.
* Compile the project in the "test" task of the Tabris.js project template. Some compilation errors may not get caught by the linter.
* Make "tabris init" install the latest patch version of the current Tabris.js release.
* Fix an issue causing modules ending on '.js' not to be loaded correctly when using "tabris serve".
* Fix wrong generated package.json "main" file path when serving snippets on Windows.
* Fix serving snippets on Windows when a file with a relative path is given. Previously, wrong path separators were used.
* Fix wrong app path declared in config.xml on Windows. It included incompatible path separators.

## 2.1.0

Update generator dependency to a version compatible with Tabris.js 2.1.0.

## 2.0.6

* Fix folders in .gitignore starting with leading slash from not being exluded from the built app.
* Improve error handling for missing widget ID in config.xml
* Fix a problem causing Windows platform files downloaded by the CLI to be cut-off

## 2.0.5

* Fix build on Windows for user paths containing spaces.
* Let `tabris serve` run the _build_ script of the app before starting the server.
* Keep only the latest nightly platform in the cache to prevent nightly platforms from stacking up.
* Implement a watch option (`-w/--watch`) for `tabris serve`. It executes the _watch_ instead of the _build_ script of the app.
* Set `$IS_DEBUG` variable to `true` for builds without given option `--release` or `--debug`. This enables the developer console for those builds by default.
* Improve error handling for non-existing config.xml
* Don't exclude `build/` and `cordova/` folders in app subfolders from the built app.

## 2.0.4

* Ensure package.json contains a "main" field before starting a build.
* Exclude `build/`, `cordova/www`, `cordova/plugins` and `cordova/platforms` from being copied to the built app.
* Improve build prompt message clarifying what the build key is used for and where it can be obtained.
* Disable minor `tabris` module version check to be able to build e.g. 2.0.x and 2.1.0-dev versions with the latest CLI.

## 2.0.3

Update generator dependency to fix bad author and email in generated config.xml.

## 2.0.2

Lessen the tabris version check to validate only the major.minor version of the installed tabris module. This allows building e.g. 2.0.1 apps with 2.0.0 CLI.

## 2.0.1

Update generator dependency to fix a critical bug affecting the `tabris init` command.

## 2.0.0

The serve command now checks for a valid `package.json` file.

The build command now downloads the native platforms automatically and keeps them in a cache. The environment variables `TABRIS_ANDROID_PLATFORM`, `TABRIS_IOS_PLATFORM`, and `TABRIS_WINDOWS_PLATFORM` are not needed anymore. Please unset these variables to enable the download.

To download the platforms, the CLI will now ask for your build key. This key is available on tabrisjs.com. Once entered, the key is stored in `~/.tabris-cli/build.key`.

## 2.0.0 RC2

Cordova is now a dependency of the Tabris CLI and doesn't need to be installed separately anymore.

The version of `tabris-cli` is adjusted to correspond with the `tabris` module.

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
