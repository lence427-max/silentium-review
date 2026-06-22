@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
pushd "%PROJECT_ROOT%"

echo.
echo Silentium Review local dev launcher
echo Project: %CD%
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules not found. Installing dependencies...
  npm.cmd install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting local dev server...
echo Browser will open: http://127.0.0.1:5173/
echo If the browser does not open, use the Local URL shown by Vite.
echo Close this window to stop the server.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:5173/'" >nul 2>nul

npm.cmd run dev -- --host 127.0.0.1

echo.
echo Dev server stopped.
pause

popd
endlocal
