# NEXUS - Ein-Klick-Installation (ASCII-only, damit Windows PowerShell 5.1 keine Zeichen verfaelscht)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }
function Test-Cmd($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Refresh-Path {
  $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$m;$u;$env:USERPROFILE\.cargo\bin"
}
function Has-Msvc {
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  if (-not (Test-Path $vswhere)) { return $false }
  $path = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  return [bool]$path
}
function Winget-Install($id, $override) {
  # $args ist in PowerShell eine reservierte Variable, daher eigener Name.
  $wingetArgs = @('install', '--id', $id, '-e', '--accept-package-agreements', '--accept-source-agreements')
  if ($override) { $wingetArgs += @('--override', $override) }
  & winget @wingetArgs
  # 3010 = "Neustart erforderlich" - die Installation selbst war erfolgreich.
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 3010) { throw "Installation von $id ist fehlgeschlagen (Code $LASTEXITCODE)." }
}

try {
  Write-Host ''
  Write-Host ' Nexus Assistent 1.0 - Installation' -ForegroundColor Cyan
  Write-Host ' --------------------' -ForegroundColor Cyan
  Write-Host ' Dieses Fenster richtet alles ein, baut den Nexus Assistenten und startet danach die Installation.'
  Write-Host ' Beim ersten Mal dauert das 15 bis 30 Minuten. Bitte das Fenster offen lassen.'
  Write-Host ' Deine Daten und API-Schluessel werden nicht geloescht.'

  # --- 1. Fehlende Werkzeuge feststellen -----------------------------------
  Step '1/5 Werkzeuge pruefen'
  Refresh-Path
  $needNode = -not ((Test-Cmd 'node') -and (Test-Cmd 'npm'))
  $needRust = -not ((Test-Cmd 'cargo') -and (Test-Cmd 'rustc'))
  $needMsvc = -not (Has-Msvc)
  if ($needNode -or $needRust -or $needMsvc) {
    if (-not (Test-Cmd 'winget')) {
      Write-Host 'Der Windows-Paketmanager winget fehlt. Bitte manuell installieren:' -ForegroundColor Yellow
      Write-Host ' Node.js LTS (nodejs.org), Rust (rustup.rs) und die Visual Studio Build Tools'
      Write-Host ' mit dem Workload "Desktopentwicklung mit C++". Danach diese Datei erneut starten.'
      throw 'winget nicht gefunden.'
    }
    Write-Host 'Folgendes fehlt und wird jetzt automatisch installiert:'
    if ($needNode) { Write-Host '  - Node.js LTS (klein)' }
    if ($needRust) { Write-Host '  - Rust (klein)' }
    if ($needMsvc) { Write-Host '  - Visual Studio Build Tools mit C++ (gross, mehrere GB, Windows fragt nach Administratorrechten)' }
    $answer = Read-Host 'Fortfahren? [J/N]'
    if ($answer -notmatch '^(j|ja|y|yes)$') { throw 'Abgebrochen. Es wurde nichts veraendert.' }

    if ($needNode) { Step 'Installiere Node.js'; Winget-Install 'OpenJS.NodeJS.LTS' $null; Refresh-Path }
    if ($needRust) {
      Step 'Installiere Rust'; Winget-Install 'Rustlang.Rustup' $null; Refresh-Path
      if (-not (Test-Cmd 'rustc')) { & rustup default stable-x86_64-pc-windows-msvc }
    }
    if ($needMsvc) {
      Step 'Installiere C++ Build Tools (das dauert)'
      Winget-Install 'Microsoft.VisualStudio.2022.BuildTools' '--passive --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended'
    }
    Refresh-Path
  }
  if (-not ((Test-Cmd 'node') -and (Test-Cmd 'npm'))) { throw 'Node.js wurde nicht gefunden. Bitte Windows neu starten und diese Datei erneut ausfuehren.' }
  if (-not ((Test-Cmd 'cargo') -and (Test-Cmd 'rustc'))) { throw 'Rust wurde nicht gefunden. Bitte Windows neu starten und diese Datei erneut ausfuehren.' }
  if (-not (Has-Msvc)) { throw 'Die C++ Build Tools wurden nicht gefunden. Bitte Windows neu starten und diese Datei erneut ausfuehren.' }
  Write-Host 'Alle Werkzeuge sind vorhanden.' -ForegroundColor Green

  # --- 2. Datensicherung vor der Installation ------------------------------
  Step '2/5 Datensicherung'
  $appData = Join-Path $env:APPDATA 'de.nexus.assistant'
  $jsonFiles = @()
  if (Test-Path -LiteralPath $appData) { $jsonFiles = @(Get-ChildItem -LiteralPath $appData -Filter '*.json' -File -ErrorAction SilentlyContinue) }
  if ($jsonFiles.Count -gt 0) {
    $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
    $backupDir = Join-Path $env:LOCALAPPDATA "NEXUS\Backups\Vor-Installation_$stamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    foreach ($f in $jsonFiles) { Copy-Item -LiteralPath $f.FullName -Destination $backupDir }
    Write-Host "Vorhandene Daten des Nexus Assistenten wurden gesichert nach: $backupDir" -ForegroundColor Green
  } else {
    Write-Host 'Keine bisherigen Daten gefunden (Neuinstallation). Nichts zu sichern.'
  }

  # --- 3. Abhaengigkeiten --------------------------------------------------
  Step '3/5 Programmteile laden (npm install)'
  & npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install ist fehlgeschlagen. Bitte Internetverbindung pruefen.' }

  # --- 4. Installer bauen --------------------------------------------------
  Step '4/5 Nexus Assistent bauen (dauert beim ersten Mal lange, bitte warten)'
  & npm run tauri:build -- --bundles nsis
  if ($LASTEXITCODE -ne 0) { throw 'Der Build ist fehlgeschlagen. Bitte die erste rote Fehlermeldung oben notieren.' }

  $built = Get-ChildItem (Join-Path $Root 'src-tauri\target\release\bundle\nsis') -Filter '*.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $built) { throw 'Der Installer wurde nicht gefunden.' }
  $setup = Join-Path $Root 'Nexus-Assistent-Setup.exe'
  Copy-Item -LiteralPath $built.FullName -Destination $setup -Force
  Write-Host "Fertiger Installer: $setup" -ForegroundColor Green

  # --- 5. Installation starten ---------------------------------------------
  Step '5/5 Nexus Assistent installieren'
  $answer = Read-Host 'Nexus Assistent jetzt installieren? [J/N]'
  if ($answer -match '^(j|ja|y|yes)$') {
    $running = Get-Process -Name 'nexus' -ErrorAction SilentlyContinue
    if ($running) {
      Write-Host 'Der Nexus Assistent laeuft noch (auch im Infobereich) und wird fuer die Installation beendet.'
      $running | Stop-Process -Force
      Start-Sleep -Seconds 2
    }
    Start-Process -FilePath $setup -Wait
    Write-Host 'Fertig. Du findest ihn im Startmenue.' -ForegroundColor Green
  } else {
    Write-Host 'Du kannst Nexus-Assistent-Setup.exe jederzeit selbst starten (Doppelklick).'
  }
  exit 0
}
catch {
  Write-Host ''
  Write-Host "FEHLER: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
