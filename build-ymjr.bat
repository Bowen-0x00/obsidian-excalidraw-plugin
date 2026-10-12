@echo off
setlocal
REM ymjr -- Build the pinned sibling component and plugin; deploy only when requested.
pushd "%~dp0" || exit /b 1

call npm run build:ymjr
if errorlevel 1 goto :failed

if not "%~1"=="" (
  call "%~dp0movejs.bat" "%~1"
  if errorlevel 1 goto :failed
)

echo Build completed successfully.
popd
exit /b 0

:failed
set "EXIT_CODE=%errorlevel%"
echo Build or deployment failed with exit code %EXIT_CODE%.
popd
exit /b %EXIT_CODE%
