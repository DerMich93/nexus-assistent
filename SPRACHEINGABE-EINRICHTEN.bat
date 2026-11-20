@echo off
setlocal
cd /d "%~dp0"
title Nexus Assistent Spracheingabe einrichten
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Install-Whisper.ps1"
echo.
pause
