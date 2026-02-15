<#
Automates environment cleanup, dependency install, and TypeScript check for the project.

USAGE:
1) Pause OneDrive sync (highly recommended) and close editors that may lock files.
2) Open PowerShell as Administrator.
3) From the repo root run: `./scripts/setup-and-check.ps1`

This script will:
- ensure npm uses the public registry
- remove local npm auth tokens and .npmrc (if present)
- remove `node_modules` and `package-lock.json` in `web` and `admin-app`
- clear npm cache
- run `npm install` in `web` and `admin-app`
- run `npx tsc --noEmit` in `web` and save output to `web/tsc-output.txt`
#>

Write-Host "Starting setup-and-check script"

Write-Host "NOTE: Please pause OneDrive sync now if the repo is inside OneDrive. Press Enter to continue after pausing."
Read-Host

Write-Host "Setting npm registry to public and removing auth tokens..."
npm config set registry https://registry.npmjs.org/ 2>$null
npm config delete //registry.npmjs.org/:_authToken 2>$null

if (Test-Path "$HOME\.npmrc") { Write-Host "Removing $HOME\.npmrc"; Remove-Item "$HOME\.npmrc" -Force -ErrorAction SilentlyContinue }
if (Test-Path ".\.npmrc") { Write-Host "Removing .npmrc"; Remove-Item ".\.npmrc" -Force -ErrorAction SilentlyContinue }

function Remove-IfExists($path) {
  if (Test-Path $path) {
    Write-Host "Removing $path"
    Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Removing node_modules and lockfiles in web and admin-app (if present)"
Remove-IfExists ".\web\node_modules"
Remove-IfExists ".\web\package-lock.json"
Remove-IfExists ".\admin-app\node_modules"
Remove-IfExists ".\admin-app\package-lock.json"

Write-Host "Cleaning npm cache (may take a moment)"
npm cache clean --force

Write-Host "Installing dependencies in web"
Push-Location .\web
$webInstall = & npm install 2>&1
Write-Host $webInstall
$webExit = $LASTEXITCODE
Pop-Location

Write-Host "Installing dependencies in admin-app"
Push-Location .\admin-app
$adminInstall = & npm install 2>&1
Write-Host $adminInstall
$adminExit = $LASTEXITCODE
Pop-Location

Write-Host "Running TypeScript check in web (output -> web\tsc-output.txt)"
Push-Location .\web
try {
  npx tsc --noEmit 2>&1 | Tee-Object -FilePath tsc-output.txt
  $tscExit = $LASTEXITCODE
} catch {
  Write-Host "tsc invocation failed: $_"
  $tscExit = 1
}
Pop-Location

Write-Host "Summary: web install exit=$webExit, admin install exit=$adminExit, tsc exit=$tscExit"
Write-Host "If tsc found errors, open web/tsc-output.txt and paste its contents here so I can fix them." 

if ($webExit -ne 0 -or $adminExit -ne 0 -or $tscExit -ne 0) {
  exit 1
} else {
  exit 0
}
