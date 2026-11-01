param([int]$Port=9225,[string]$DoubaoPath)
$ErrorActionPreference='Stop'
if($Port -lt 1 -or $Port -gt 65535){throw 'Invalid port'}
if(-not $DoubaoPath){
 $candidates=@("$env:LOCALAPPDATA\Doubao\app\Doubao.exe","$env:LOCALAPPDATA\Programs\Doubao\Doubao.exe","$env:ProgramFiles\Doubao\app\Doubao.exe",'H:\Doubao\app\Doubao.exe')
 $DoubaoPath=$candidates | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
}
if(-not $DoubaoPath -or -not(Test-Path -LiteralPath $DoubaoPath)){throw '请用 -DoubaoPath 指定豆包客户端 exe 路径。'}
if(Get-Process -Name Doubao -ErrorAction SilentlyContinue){throw '请先从豆包系统托盘正常退出，再运行本脚本；不会强制结束进程。'}
Start-Process -FilePath $DoubaoPath -ArgumentList @('--remote-debugging-address=127.0.0.1',"--remote-debugging-port=$Port") -WindowStyle Hidden
Write-Host "豆包已使用本地调试端口 $Port 启动。后续额度读取使用隐藏页面，不弹出额度窗口。"
