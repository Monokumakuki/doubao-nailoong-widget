@echo off
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /optimize+ /out:"%~dp0..\src\native\WindowFollower.exe" "%~dp0..\src\native\WindowFollower.cs"
exit /b %errorlevel%
