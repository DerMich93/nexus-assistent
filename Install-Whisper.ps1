# NEXUS - lokale Spracheingabe einrichten (whisper.cpp). ASCII-only fuer Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Port = 8178
$Dir = Join-Path $env:LOCALAPPDATA 'NEXUS\whisper'

function Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }
function Download-File($url, $dest) {
  Write-Host "  Lade $url"
  $tmp = "$dest.part"
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
  try {
    $ProgressPreference = 'Continue'
    Start-BitsTransfer -Source $url -Destination $tmp -ErrorAction Stop
  } catch {
    Write-Host '  (Fortschrittsanzeige nicht verfuegbar, bitte warten ...)'
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
  }
  Move-Item -LiteralPath $tmp -Destination $dest -Force
}

try {
  Write-Host ''
  Write-Host ' Nexus Assistent - Lokale Spracheingabe einrichten' -ForegroundColor Cyan
  Write-Host ' ----------------------------------------' -ForegroundColor Cyan
  Write-Host ' Alles bleibt auf diesem PC: whisper.cpp erkennt deine Sprache offline.'
  Write-Host " Installationsordner: $Dir"
  Write-Host ' Der Server lauscht nur auf 127.0.0.1 (dieser PC) und startet kuenftig mit Windows.'
  Write-Host ''
  Write-Host ' Sprachmodell waehlen:'
  Write-Host '   1 = small  (ca. 470 MB, gute Erkennung, empfohlen)'
  Write-Host '   2 = base   (ca. 140 MB, schneller, aber ungenauer)'
  $choice = Read-Host ' Auswahl [1]'
  $modelName = if ($choice -eq '2') { 'base' } else { 'small' }

  New-Item -ItemType Directory -Path $Dir -Force | Out-Null

  Step '1/4 Programm herunterladen (whisper.cpp)'
  Get-Process -Name 'whisper-server' -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 1
  $binDir = Join-Path $Dir 'bin'
  $exe = $null
  if (Test-Path -LiteralPath $binDir) {
    $exe = Get-ChildItem -LiteralPath $binDir -Recurse -Filter 'whisper-server.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if ($exe) {
    Write-Host "  Bereits vorhanden: $($exe.FullName)" -ForegroundColor Green
  } else {
    # Die fertigen Programme haengen nicht an der Quelltext-Version, sondern an den zugehoerigen Nightly-Versionen.
    # Deshalb werden die neuesten Versionen (auch Vorabversionen) nach einem passenden Windows-x64-CPU-Paket durchsucht.
    $releases = Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=15' -Headers @{ 'User-Agent' = 'NEXUS-Setup' }
    $excluded = 'cuda|cublas|vulkan|opencl|blas|arm|openvino|sycl|hip|musa|rocm|win32|xcframework'
    $asset = $null
    foreach ($rel in $releases) {
      $asset = $rel.assets | Where-Object {
        $_.name -like '*.zip' -and $_.name -like 'whisper-bin*' -and $_.name -match 'x64|x86_64' -and $_.name -notmatch $excluded -and
        (($_.name -match '(^|[-_])win([-_.]|$)') -or ($_.name -eq 'whisper-bin-x64.zip'))
      } | Select-Object -First 1
      if ($asset) { Write-Host "  Gefunden in Version $($rel.tag_name): $($asset.name)"; break }
    }
    if (-not $asset) {
      Write-Host '  Verfuegbare Dateien in den neuesten Versionen:' -ForegroundColor Yellow
      foreach ($rel in ($releases | Select-Object -First 4)) { foreach ($a in $rel.assets) { Write-Host "    $($rel.tag_name): $($a.name)" } }
      throw "Es wurde kein passendes Windows-Paket gefunden. Manuell: auf github.com/ggml-org/whisper.cpp/releases (eine Nightly-Version wie b5454, Bereich Assets) das Windows-x64-Paket ohne CUDA/Vulkan laden, nach '$binDir' entpacken und dieses Skript erneut starten."
    }
    $zip = Join-Path $Dir 'whisper-win-x64.zip'
    Download-File $asset.browser_download_url $zip
    if (Test-Path -LiteralPath $binDir) { Remove-Item -LiteralPath $binDir -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $binDir -Force
    Remove-Item -LiteralPath $zip -Force
    $exe = Get-ChildItem -LiteralPath $binDir -Recurse -Filter 'whisper-server.exe' | Select-Object -First 1
    if (-not $exe) { $exe = Get-ChildItem -LiteralPath $binDir -Recurse -Filter 'server.exe' | Select-Object -First 1 }
    if (-not $exe) { throw 'Im Download wurde kein whisper-server.exe gefunden.' }
    Write-Host "  Gefunden: $($exe.FullName)" -ForegroundColor Green
  }

  Step "2/4 Sprachmodell herunterladen ($modelName)"
  $model = Join-Path $Dir "ggml-$modelName.bin"
  if ((Test-Path -LiteralPath $model) -and ((Get-Item -LiteralPath $model).Length -gt 50MB)) {
    Write-Host '  Modell ist bereits vorhanden.' -ForegroundColor Green
  } else {
    Download-File "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$modelName.bin" $model
  }

  Step '3/4 Hilfsprogramme pruefen und Autostart einrichten'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try { & winget install --id 'Microsoft.VCRedist.2015+.x64' -e --silent --accept-package-agreements --accept-source-agreements | Out-Null } catch { }
  }
  $threads = [Math]::Min(8, [Environment]::ProcessorCount)
  $arguments = "-m `"$model`" --host 127.0.0.1 --port $Port -l de -t $threads"
  $startup = [Environment]::GetFolderPath('Startup')
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut((Join-Path $startup 'NEXUS Spracherkennung.lnk'))
  $link.TargetPath = $exe.FullName
  $link.Arguments = $arguments
  $link.WorkingDirectory = $exe.DirectoryName
  $link.WindowStyle = 7
  $link.Description = 'NEXUS lokale Spracherkennung (whisper.cpp)'
  $link.Save()
  Write-Host '  Autostart-Verknuepfung wurde angelegt.' -ForegroundColor Green

  Step '4/4 Server starten und pruefen'
  Start-Process -FilePath $exe.FullName -ArgumentList @('-m', "`"$model`"", '--host', '127.0.0.1', '--port', "$Port", '-l', 'de', '-t', "$threads") -WorkingDirectory $exe.DirectoryName -WindowStyle Minimized
  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    try { Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2 | Out-Null; $ready = $true; break }
    catch { if ($_.Exception.Response) { $ready = $true; break } }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    Write-Host ''
    Write-Host 'Der Server antwortet noch nicht. Moegliche Ursachen:' -ForegroundColor Yellow
    Write-Host ' - Das Modell laedt noch (bei langsamen PCs bis zu 1-2 Minuten): kurz warten und in NEXUS testen.'
    Write-Host ' - Windows Defender hat whisper-server.exe blockiert: im Defender die Datei zulassen.'
    Write-Host ' - Es fehlt die Visual C++ Runtime: von aka.ms/vs/17/release/vc_redist.x64.exe installieren.'
  } else {
    Write-Host '  Der Server laeuft.' -ForegroundColor Green
  }

  Write-Host ''
  Write-Host 'Fertig. Letzter Schritt in NEXUS:' -ForegroundColor Green
  Write-Host '  KI-Verwaltung -> Spracheingabe -> "Lokal" waehlen -> "Spracheingabe testen" -> Speichern.'
  Write-Host '  Danach "Voice" einschalten und einfach sprechen.'
  exit 0
}
catch {
  Write-Host ''
  Write-Host "FEHLER: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
