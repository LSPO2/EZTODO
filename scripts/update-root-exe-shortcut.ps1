$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$exePath = Join-Path $repoRoot 'apps\desktop\src-tauri\target\release\eztodo-desktop.exe'
$linkPath = Join-Path $repoRoot 'EZTODO 最新版.lnk'

if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
  throw "Release EXE not found: $exePath. Run the Tauri release build first."
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($linkPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = Split-Path -Parent $exePath
$shortcut.IconLocation = "$exePath,0"
$shortcut.Description = 'EZTODO 最新 release'
$shortcut.Save()

Get-Item -LiteralPath $linkPath | Select-Object FullName, Length, LastWriteTime
