# Erzeugt einmalig den Signaturschluessel fuer automatische Updates des Nexus Assistenten.
# Der private Schluessel verlaesst diesen PC nur, wenn du ihn selbst als GitHub-Secret eintraegst.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:USERPROFILE '.nexus-updater'
$key = Join-Path $dir 'nexus-updater.key'

Write-Host ''
Write-Host ' Nexus Assistent - Update-Schluessel erzeugen' -ForegroundColor Cyan
Write-Host ''
if (Test-Path $key) {
  Write-Host "Es gibt bereits einen Schluessel: $key" -ForegroundColor Yellow
  Write-Host 'Er wird NICHT ueberschrieben. Mit einem neuen Schluessel koennte NEXUS keine Updates mehr annehmen.'
  Write-Host 'Oeffentlicher Schluessel (fuer GitHub-Variable TAURI_UPDATER_PUBKEY):'
  Get-Content "$key.pub"
  exit 0
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js fehlt. Es wird jetzt ueber winget installiert (einmalig).' -ForegroundColor Yellow
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js konnte nicht gefunden werden. Bitte das Fenster schliessen und das Skript erneut starten.' }
}
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Write-Host 'Gleich wirst du nach einem Passwort fuer den Schluessel gefragt. Notiere es gut - du brauchst es fuer GitHub.' -ForegroundColor Yellow
& npx --yes '@tauri-apps/cli@2' signer generate -w $key
if (-not (Test-Path $key) -or -not (Test-Path "$key.pub")) { throw 'Der Schluessel wurde nicht erzeugt.' }

Write-Host ''
Write-Host 'Fertig. Jetzt in GitHub eintragen (Repository nexus-assistent -> Settings -> Secrets and variables -> Actions):' -ForegroundColor Green
Write-Host '  1. Secret   TAURI_SIGNING_PRIVATE_KEY          = Inhalt der Datei (liegt jetzt in der Zwischenablage)'
Write-Host '  2. Secret   TAURI_SIGNING_PRIVATE_KEY_PASSWORD = dein Passwort von eben'
Write-Host '  3. Variable TAURI_UPDATER_PUBKEY               = der oeffentliche Schluessel unten'
Write-Host '  4. Secret   RELEASES_TOKEN                     = Zugangstoken fuer nexus-assistent-releases (siehe UPDATES.md)'
Write-Host ''
Write-Host 'Oeffentlicher Schluessel:' -ForegroundColor Cyan
Get-Content "$key.pub"
Get-Content $key -Raw | Set-Clipboard
Write-Host ''
Write-Host "WICHTIG: Sichere den Ordner $dir (z. B. USB-Stick oder Passwortmanager)." -ForegroundColor Yellow
Write-Host 'Geht der Schluessel verloren, kann NEXUS keine Updates mehr automatisch annehmen (dann einmal von Hand neu installieren).'
