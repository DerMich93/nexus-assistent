@echo off
setlocal
cd /d "%~dp0"
title Nexus Assistent installieren
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Install-NEXUS.ps1"
echo.
if errorlevel 1 (
  echo Die Installation wurde nicht abgeschlossen. Bitte die Meldung oben lesen.
) else (
  echo Vorgang beendet.
)
pause
