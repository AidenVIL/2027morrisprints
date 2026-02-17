@echo off
REM Build script for admin-app: installs deps, builds, and reveals the EXE
SETLOCAL

REM Change to the admin-app directory (script placed at repo root)
cd /d "%~dp0admin-app"

echo === Installing dependencies ===
npm ci || npm install
if %ERRORLEVEL% neq 0 (
  echo npm install failed. Inspect output above.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo === Building admin app (vite build && electron-builder) ===
echo === Building admin app (vite build && electron-builder) ===
npm run build
if %ERRORLEVEL% neq 0 (
  echo Build failed. Inspect output above.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo === Locating generated .exe in dist folder ===
set "EXE_PATH="
for /r "%cd%\dist" %%f in (*.exe) do (
  set "EXE_PATH=%%f"
  goto :found_exe
)

REM If no installer, check win-unpacked
if not defined EXE_PATH (
  for /r "%cd%\dist\win-unpacked" %%g in (*.exe) do (
    set "EXE_PATH=%%g"
    goto :found_exe
  )
)

REM If still not found, check portable installer names
if not defined EXE_PATH (
  for /r "%cd%\dist" %%h in (*portable*.exe) do (
    set "EXE_PATH=%%h"
    goto :found_exe
  )
)

:found_exe
if defined EXE_PATH (
  echo Found executable: %EXE_PATH%
  mkdir "%~dp0admin-app\built-exe" 2>nul
  copy "%EXE_PATH%" "%~dp0admin-app\built-exe\" >nul
  echo Copied to: %~dp0admin-app\built-exe\
  explorer "%~dp0admin-app\built-exe\"
) else (
  echo No .exe found under admin-app\dist. Opening dist for inspection.
  explorer "%cd%\dist"
)

echo Done. Press any key to close.
pause >nul
