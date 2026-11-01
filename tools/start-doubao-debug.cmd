@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-doubao-debug.ps1" %*
if errorlevel 1 pause
