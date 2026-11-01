param([string]$Destination = [Environment]::GetFolderPath('Desktop'))
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ws = New-Object -ComObject WScript.Shell
$link = $ws.CreateShortcut((Join-Path $Destination '大肥豆插件.lnk'))
$link.TargetPath = Join-Path $root 'node_modules/electron/dist/electron.exe'
$link.Arguments = '"' + (Join-Path $root 'src/main/index.js') + '"'
$link.WorkingDirectory = $root
$link.Description = '大肥豆插件'
$link.IconLocation = Join-Path $root 'assets/ui/icon.ico'
$link.Save()
