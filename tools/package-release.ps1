param()
$ErrorActionPreference = 'Stop'
function Get-Sha256([string]$FilePath) {
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($FilePath)
  try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '') }
  finally { $stream.Dispose(); $algorithm.Dispose() }
}
$root = Split-Path -Parent $PSScriptRoot
& cmd.exe /c (Join-Path $PSScriptRoot 'build-native.cmd')
if ($LASTEXITCODE -ne 0) { throw 'Native helper compilation failed' }
$pkg = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$tag = 'DouBao-Nailoong-Widget-' + $pkg.version + '-win-x64-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$stage = Join-Path $root ('dist/' + $tag)
$runtime = Join-Path $root 'node_modules/electron/dist'
if (-not (Test-Path -LiteralPath (Join-Path $runtime 'electron.exe'))) { throw 'Install Electron first.' }
New-Item -ItemType Directory -Path $stage -Force | Out-Null
Get-ChildItem -LiteralPath $runtime | Copy-Item -Destination $stage -Recurse
Rename-Item -LiteralPath (Join-Path $stage 'electron.exe') -NewName 'DouBao-Nailoong-Widget.exe'
& node (Join-Path $PSScriptRoot 'set-exe-icon.js') (Join-Path $stage 'DouBao-Nailoong-Widget.exe')
if ($LASTEXITCODE -ne 0) { throw 'App icon embedding failed' }
$appDir = Join-Path $stage 'resources/app'
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
foreach ($name in @('src','assets','package.json','LICENSE','README.md','NOTICE.md')) {
  Copy-Item -LiteralPath (Join-Path $root $name) -Destination $appDir -Recurse
}
$docDir=Join-Path $appDir 'docs'
New-Item -ItemType Directory -Path $docDir -Force | Out-Null
foreach($name in @('ACCEPTANCE.md','ASSETS.md','images')){Copy-Item -LiteralPath (Join-Path $root ('docs/'+$name)) -Destination $docDir -Recurse}
$toolDir=Join-Path $stage 'tools'
New-Item -ItemType Directory -Path $toolDir -Force | Out-Null
foreach($name in @('start-doubao-debug.ps1','start-doubao-debug.cmd')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $toolDir}
$modules = Join-Path $appDir 'node_modules'
New-Item -ItemType Directory -Path $modules -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'node_modules/ws') -Destination $modules -Recurse
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $stage
Copy-Item -LiteralPath (Join-Path $root 'NOTICE.md') -Destination $stage
Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $stage
New-Item -ItemType Directory -Path (Join-Path $stage 'assets/ui') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'assets/ui/icon.png') -Destination (Join-Path $stage 'assets/ui')
Copy-Item -LiteralPath $docDir -Destination $stage -Recurse
$manifest = Get-ChildItem -LiteralPath $stage -File -Recurse | ForEach-Object {
  [pscustomobject]@{path=$_.FullName.Substring($stage.Length + 1);sha256=(Get-Sha256 $_.FullName)}
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $stage 'SHA256.json') -Encoding UTF8
$zip = $stage + '.zip'
Compress-Archive -LiteralPath $stage -DestinationPath $zip -CompressionLevel Optimal
(Get-Sha256 $zip) | Set-Content -LiteralPath ($zip + '.sha256') -Encoding ASCII
Write-Host $zip
