@echo off
if %1==bin (
  dirname %0
) else (
  if %1==install (
    REM test_install is a fixture generated in build and run test specs
    cp -af ../../../../test_install/. .
  )
 echo NPM %* [%cd%]
)
