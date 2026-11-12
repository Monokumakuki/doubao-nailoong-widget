param([string]$WidgetPath,[int]$Port=9225,[switch]$Restore)
$ErrorActionPreference='Stop'
$installDir=Join-Path $env:LOCALAPPDATA 'DaFeiDou'
$taskbarDir=Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
$shortcutPath=Join-Path $taskbarDir '豆包.lnk'
$backup=Join-Path $installDir 'startup-backup\豆包.lnk'
if($Restore){
 if(-not(Test-Path -LiteralPath $backup)){throw '未找到备份。'}
 Copy-Item -LiteralPath $backup -Destination $shortcutPath -Force
 Write-Host '已恢复原始任务栏豆包启动入口。';exit
}
if($Port -lt 1 -or $Port -gt 65535){throw 'Invalid port'}
if(-not(Test-Path -LiteralPath $shortcutPath)){throw '请先将豆包固定到任务栏，再运行本脚本。'}
$root=Split-Path -Parent $PSScriptRoot
if(-not $WidgetPath){
 $portable=Join-Path $root 'DouBao-Nailoong-Widget.exe'
 if(Test-Path -LiteralPath $portable){$WidgetPath=$portable}
 else{$folder=Get-ChildItem -LiteralPath (Join-Path $root 'dist') -Directory | Where-Object {$_.Name -like 'DouBao-Nailoong-Widget-*' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'DouBao-Nailoong-Widget.exe'))} | Sort-Object LastWriteTime -Descending | Select-Object -First 1
 if($folder){$WidgetPath=Join-Path $folder.FullName 'DouBao-Nailoong-Widget.exe'}}
}
if(-not $WidgetPath -or -not(Test-Path -LiteralPath $WidgetPath)){throw '请用 -WidgetPath 指定挂件 exe。'}
$WidgetPath=(Resolve-Path -LiteralPath $WidgetPath).Path
$ws=New-Object -ComObject WScript.Shell
$original=$ws.CreateShortcut($shortcutPath)
$shell=New-Object -ComObject Shell.Application
$oldAppId=$shell.NameSpace($taskbarDir).ParseName('豆包.lnk').ExtendedProperty('System.AppUserModel.ID')
$hostPath=$original.TargetPath
# Reinstallation reads the original backup rather than chaining the bridge to itself.
if(Test-Path -LiteralPath $backup){$hostPath=$ws.CreateShortcut($backup).TargetPath}
$direct=Join-Path (Split-Path -Parent $hostPath) 'app\Doubao.exe'
if(Test-Path -LiteralPath $direct){$hostPath=$direct}
if(-not(Test-Path -LiteralPath $hostPath)){throw '原豆包程序不存在。'}
New-Item -ItemType Directory -Force -Path (Join-Path $installDir 'startup-backup') | Out-Null
if(-not(Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $shortcutPath -Destination $backup}
$source=Join-Path $root 'src/native/DoubaoLauncher.cs'
if(-not(Test-Path -LiteralPath $source)){$source=Join-Path $root 'resources/app/src/native/DoubaoLauncher.cs'}
$exe=Join-Path $installDir 'DoubaoWithWidget.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /optimize+ "/out:$exe" $source
if($LASTEXITCODE -ne 0){throw '启动器编译失败，原快捷方式未修改。'}
$doc=New-Object System.Xml.XmlDocument
$node=$doc.CreateElement('launcher');$node.SetAttribute('host',$hostPath);$node.SetAttribute('widget',$WidgetPath);$node.SetAttribute('port',[string]$Port);[void]$doc.AppendChild($node)
$doc.Save((Join-Path $installDir 'launcher.xml'))
try {
 $original.TargetPath=$exe;$original.Arguments='';$original.Description='豆包 + 大肥豆插件；本地隐藏额度读取';$original.Save()
 $saved=$ws.CreateShortcut($shortcutPath)
 $newAppId=$shell.NameSpace($taskbarDir).ParseName('豆包.lnk').ExtendedProperty('System.AppUserModel.ID')
 if($saved.TargetPath -ne $exe -or $newAppId -ne $oldAppId){throw '快捷方式或任务栏分组验证失败。'}
}catch{Copy-Item -LiteralPath $backup -Destination $shortcutPath -Force;throw}
[pscustomobject]@{Installed=$true;Launcher=$exe;Host=$hostPath;Widget=$WidgetPath;Port=$Port;AppId=$newAppId;Backup=$backup} | ConvertTo-Json
Write-Host '下次从任务栏启动豆包时将同时启动挂件并开放本地额度读取。当前已运行的豆包不会被强制关闭。'
