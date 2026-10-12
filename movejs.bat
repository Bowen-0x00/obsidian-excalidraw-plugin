@echo off
setlocal
REM ymjr -- Keep vault paths private and deploy only the three plugin artifacts.
set "destination_folder=%~1"
if not defined destination_folder set "destination_folder=%YMJR_PLUGIN_DIR%"
if not defined destination_folder (
  echo Usage: movejs.bat "path-to-vault-plugin-directory"
  echo Alternatively, set YMJR_PLUGIN_DIR in your local environment.
  exit /b 2
)

for %%F in (main.js styles.css manifest.json) do (
  if not exist "%~dp0dist\%%F" (
    echo Missing build artifact: %%F
    exit /b 1
  )
)

if not exist "%destination_folder%" mkdir "%destination_folder%"
if errorlevel 1 exit /b 1

for %%F in (main.js styles.css manifest.json) do (
  copy /y "%~dp0dist\%%F" "%destination_folder%\%%F"
  if errorlevel 1 exit /b 1
)
exit /b 0