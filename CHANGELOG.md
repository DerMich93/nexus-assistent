# Änderungen

## 1.1.0 – Arbeitsordner
**Neu**
- **Arbeitsordner** `Dokumente\Nexus-Arbeitsordner`: Dateien ansehen, im Explorer öffnen und mit 📎 an den Chat anhängen.
- **Lesen:** Word (`.docx`) mit Überschriften, Aufzählungen und Tabellen; Excel (`.xlsx`) mit allen Tabellenblättern, Datumswerten und berechneten Formeln; `.txt`, `.md`, `.csv`, `.json` (UTF-8, UTF-16 und ältere ANSI-Dateien). Bis 30.000 Zeichen pro Datei, Kürzung wird gemeldet.
- **Speichern:** neue Aktion `save_file` mit Vorschau-Karte und Bestätigung. Erzeugt echte Word-Dateien (Überschriften, Fettdruck, Aufzählungen, Tabellen) und Excel-Dateien (mehrere Blätter, Zahlen, Formeln; deutsche Funktionsnamen und Semikolons werden übersetzt). CSV mit BOM für Umlaute in Excel.
- **Schutz im Code:** nur Dateien direkt im Ordner, nur erlaubte Endungen, keine Pfade, Verknüpfungen, reservierten Windows-Namen; Größenlimits; **nie überschreiben** (bei gleichem Namen `Name (2).ext`, abgesichert mit `create_new`); kein Löschen. Dateiinhalte gehen als fremde Daten an die KI; Cloud-KI nur mit eigener Freigabe; nach einer Websuche keine Datei-Vorschläge.
- Abgeschnittene Antworten mit unvollständigem Vorschlag werden erkannt und ehrlich gemeldet.
- Ohne neue Abhängigkeiten (ZIP über die eingebauten Compression-Streams).
- 6 neue Rust-Tests, 15 Unit- und 22 Oberflächentests.

**Geändert**
- Längere Nachrichten erlaubt (40.000 Zeichen pro Nachricht, 100.000 im Verlauf), damit angehängte Dateien Platz haben.
- Anthropic: Antwortlimit von 4096 auf 8192 Tokens erhöht (für längere Dokumente).

## 1.0.0 – Nexus Assistent
Erste fertige Version. Sie fasst alle Entwicklungsstufen (0.7 bis 0.14) zusammen.

**Umbenennung und Aufräumen**
- Die App heißt jetzt **Nexus Assistent** (Fenstertitel, Installer, Handbuch). Hinweise zum Wechsel von „NEXUS“ stehen in der README.
- Die Oberfläche ist in Dateien aufgeteilt (`web/app.css`, `web/lib/`, `web/ui/`) statt einer einzigen riesigen `index.html`. Rein mechanisch, Verhalten unverändert (durch die Tests belegt).
- **Wirkungslose Schalter entfernt:** „Erinnerungen“, „Projektberichte“ und „Dateiorganisation“ im Automatisierungs-Fenster taten nichts. Es bleibt der Morgenüberblick.
- **Ehrliche Statusanzeige:** „Netzwerk: Aktiv“ und „Sprache: Bereit“ waren feste Texte. Die Seitenleiste zeigt jetzt den echten Stand von Internet, Spracheingabe und Datenschutz (verschlüsselt / unverschlüsselt / gesperrt).
- 7 neue Oberflächentests (insgesamt 84 Unit-, 175 Oberflächen-, 32 Rust-Tests).

**Funktionsumfang von 1.0**
- KI: 8 Anbieter (Cloud und lokal), Verlauf, Datum, Kontext aus Gedächtnis/Aufgaben/Terminen mit Freigaben pro Datenart.
- Aufgaben mit Wiederholung, lokaler Kalender (Serien, `.ics`), Erinnerungen, Morgenüberblick.
- Aktionen per Chat mit Bestätigung (Aufgabe, Termin, Gedächtnis).
- Internetzugriff mit Schutz (nur freigegebene Adressen, https, Sperre interner Netze, Limits, fremde Daten, keine Aktionen daraus).
- Spracheingabe lokal oder per Cloud, Vorlesen.
- Hintergrundbetrieb: Autostart, Infobereich, Windows-Benachrichtigungen, nur eine Instanz.
- Datenschutz: Schlüsselbund für API-Keys, lokale Datenverschlüsselung mit Wiederherstellungsschlüssel, automatische Sicherung (letzte 5), passwortgeschützte Datensicherung.

**Bekannt offen:** siehe „Ausblick“ in der README (Passwort-Entsperrung, E-Mail, Live-Antworten, Signierung).

## 0.14.0
**Neu**
- **Lokaler Kalender** mit Monatsansicht, Tagesliste und Editor: Termine mit Beginn/Ende, ganztägig/mehrtägig, Ort, Notizen und Wiederholung
  (täglich/wöchentlich/monatlich/jährlich, Intervall, Enddatum). Sonderfälle (31. im Kurzmonat, 29. Februar, Zeitumstellung) sind abgedeckt.
- **Import und Export als `.ics`** inklusive Zeitzonen (IANA- und Windows-Namen), Ganztag, Dauer, Serien; Wiederimport legt keine Doppelten an;
  nicht abbildbare Teile werden gezählt und im Ergebnis genannt, nicht still verschluckt.
- **Termin-Erinnerungen** mit einstellbarer Vorlaufzeit (Chat + Windows-Benachrichtigung), heutige Termine im Morgenüberblick.
- **Termin-Vorschläge im Chat** (`create_event`) mit Bestätigung; Termine der nächsten 14 Tage als Kontext (lokal immer, Cloud nur mit Freigabe).
- Der Kalender ist verschlüsselt (wenn die Datenverschlüsselung an ist) und in automatischen und manuellen Sicherungen enthalten.
  Ältere Sicherungen ohne Kalender lassen den vorhandenen Kalender unberührt.
- 6 neue Rust-Tests (Datums-/Zeitprüfung, Termin-Bereinigung, Prompt), 42 neue Unit- und 50 neue Oberflächentests.

**Behoben**
- Nicht existierende Kalendertage (z. B. „30. Februar“) wurden von der Datumsprüfung still in den Folgemonat verschoben, auch bei Aufgaben-Vorschlägen. Sie werden jetzt abgelehnt.

**Geändert**
- Der Knopf „Aufgaben & Termine“ heißt jetzt „Aufgaben“ (Termine gibt es im Kalender).

## 0.13.0
**Neu**
- **Internetzugriff** (standardmäßig aus): Websuche über DuckDuckGo und Lesen von Seiten aus den Suchergebnissen. Pro Frage höchstens 2 Abfragen,
  sichtbare Suchanfrage im Chat, Quellenangabe in der Antwort. Bei Cloud-KI zusätzliche eigene Freigabe.
- **Schutz im Code:** nur freigegebene Adressen aus den Suchergebnissen, nur https, Sperre interner/privater Netze inklusive Prüfung nach Weiterleitungen
  und Bindung an die geprüfte Adresse, Größen-/Zeit-/Weiterleitungslimits, Entschärfung des Webtexts, Kennzeichnung als fremde Daten.
- **Keine Aktionen aus Webinhalten:** Nach einer Websuche werden Vorschläge zum Anlegen von Aufgaben/Gedächtnis verworfen.
- Neue Abhängigkeit: `scraper` (HTML lesen). 8 neue Rust-Tests (Netzsperren, Adressprüfung, Suchseite, Bot-Prüfung, Text-Extraktion), 11 Unit- und 23 Oberflächentests.

## 0.12.0
**Neu**
- **Lokale Datenverschlüsselung** für Gedächtnis, Gespräche, Aufgaben und Automatisierungen (XChaCha20-Poly1305). Der Schlüssel liegt im
  Windows-Schlüsselbund, NEXUS entsperrt sich damit selbst; Autostart und Hintergrund-Erinnerungen funktionieren weiter ohne Passwort.
- **Wiederherstellungsschlüssel:** wird beim Einschalten angezeigt, kann später erneut angezeigt und nach einer Neuinstallation von Windows
  wieder eingegeben werden (mit Prüfung gegen die vorhandenen Daten).
- Warnung beim Start, wenn die Daten verschlüsselt sind, der Schlüssel aber fehlt.
- Automatische Sicherungen und Wiederherstellungen sind verschlüsselungsbewusst: Sicherungen sind so verschlüsselt wie die Daten, nach einer
  Wiederherstellung werden übrig gebliebene Klartext-Dateien automatisch nachverschlüsselt.
- 4 neue Rust-Tests (Verschlüsselung, falscher Schlüssel, Vertauschen von Dateien, Manipulation, Schlüsseltext), 14 neue Oberflächentests.

**Geändert**
- Alle Zugriffe auf Datendateien laufen jetzt über eine gemeinsame Lese-/Schreibschicht. `settings.json` bleibt absichtlich im Klartext.

## 0.11.0
**Neu**
- **Hintergrundbetrieb:** Infobereich-Symbol, Autostart mit Windows (leise gestartet), Weiterlaufen beim Schließen (optional).
- **Windows-Benachrichtigungen** für fällige Erinnerungen und den Morgenüberblick, wenn NEXUS nicht im Vordergrund ist.
- **Nur eine Instanz:** Ein zweiter Start öffnet das vorhandene Fenster, statt Daten doppelt zu schreiben.
- **Automatische Sicherung:** bei Änderungen, es bleiben nur die letzten 5; Sofort-Sicherung und Wiederherstellung in der KI-Verwaltung.
- Neue Rust-Tests für die Sicherungsrotation (Namensprüfung, Löschen nur der ältesten, fremde Ordner bleiben), 18 weitere Oberflächentests.

**Geändert**
- `NEXUS-INSTALLIEREN.bat` beendet ein im Infobereich laufendes NEXUS vor der Installation.
- Neue Abhängigkeiten: tauri-plugin-notification, tauri-plugin-autostart, tauri-plugin-single-instance.

## 0.10.1
**Behoben**
- `SPRACHEINGABE-EINRICHTEN.bat` fand das Windows-Paket von whisper.cpp nicht („whisper-bin-x64.zip nicht gefunden“): Die fertigen
  Programme hängen inzwischen an den Nightly-Versionen und heißen anders. Das Skript durchsucht jetzt die neuesten Versionen
  nach dem passenden Paket, zeigt bei Misserfolg alle verfügbaren Dateien an und erkennt einen manuell entpackten Ordner.

## 0.10.0
**Neu**
- **Aktionen per Chat:** NEXUS schlägt Aufgaben/Termine (auch wiederkehrend) und Gedächtnis-Einträge vor; gespeichert wird
  nur nach Klick auf „Bestätigen“. Streng geprüftes Format, nur zwei harmlose Aktionstypen, höchstens 5 pro Antwort.
- **Funktionierende Spracheingabe:** Mikrofon mit automatischer Pausenerkennung, Erkennung über lokalen Whisper-Server
  (`SPRACHEINGABE-EINRICHTEN.bat`), Groq, OpenAI oder eigenen Server. Filter gegen erfundene Whisper-Sätze bei Stille.
- Einstellungsbereich „Spracheingabe“ mit Test-Knopf; eigene Schlüssel im Windows-Schlüsselbund.
- 31 Unit-Tests und 63 Oberflächentests (`npm test`), im GitHub-Workflow integriert.

**Geändert**
- Der System-Prompt beschreibt jetzt, was NEXUS vorschlagen kann (vorher: „kann nichts anlegen“).
- Die Browser-Spracherkennung wird nur noch in der Browser-Vorschau genutzt (in der Desktop-App war sie nicht verfügbar).

## 0.9.0
**Neu**
- Der Assistent sieht jetzt den **bisherigen Gesprächsverlauf** (bisher bekam die KI nur die jeweils letzte Nachricht).
- Neue Anbieter: **Mistral**, **OpenRouter**, **Eigener Server** (OpenAI-kompatibel, z. B. LM Studio, auch lokal).
- Freies Feld **„Eigener Modellname“**; Modellliste für Ollama und eigene Server wird automatisch abgefragt.
- NEXUS kennt Datum und Uhrzeit; optional offene Aufgaben (Cloud nur mit Freigabe, lokal immer).
- Lokale KI (Ollama) erhält jetzt auch Erinnerungen (vorher ignoriert).
- Button **„Neues Gespräch“**; Schalter **„Vorlesen“** getrennt von der Spracheingabe.
- Rust-Tests für Gesprächsverlauf und Adressregeln; GitHub-Workflow führt alle Rust-Tests vor dem Installer-Bau aus.
- Gesamte Dokumentation in `README.md` zusammengeführt (ersetzt 15 teils veraltete Textdateien).

**Behoben**
- **Morgenüberblick wurde nie ausgelöst** (fehlerhafter regulärer Ausdruck für die Uhrzeit).
- Antworten wurden immer vorgelesen, auch bei „Voice: AUS“.
- Spracheingabe konnte bei Fehler „network“ in eine Endlosschleife geraten.
- „Verbindung testen“ bei Ollama setzte die Freigabe-Einstellungen unbemerkt zurück.
- Eigene, nicht in der Liste stehende Ollama-Modelle gingen beim erneuten Öffnen der Einstellungen verloren.
- Gemini: Antwortlimit (1200) konnte Antworten abschneiden; Text aus mehreren Teilen wird jetzt zusammengesetzt.
- Fehlerseiten ohne JSON (z. B. HTTP 502) führten zu unverständlichen Meldungen; jetzt Statuscode + Text.
- Datendateien werden atomar geschrieben (kein Datenverlust bei Absturz während des Speicherns).
- Update-Assistent sichert jetzt auch `automations.json`.

**Entfernt**
- Fünf einzelne Skripte (Install/Build/Start/Update) – ersetzt durch **`NEXUS-INSTALLIEREN.bat`** mit Datensicherung und fertiger `NEXUS-Setup.exe`.
- **Vite und der Entwicklungsserver.** Die Oberfläche (`web/`) wird direkt von Tauri eingebettet. Das behebt den Fehler
  „beforeDevCommand terminated with a non-zero status code“, der bei neuen Node-Versionen auftrat.
- `Desktop-Verknuepfung-erstellen.bat` (verwies auf die Browser-Vorschau, in der die KI nicht funktioniert).

## 0.8.x
Wiederkehrende Erinnerungen, Erinnerungsübersicht, passwortgeschützte Sicherungen (Argon2id + XChaCha20-Poly1305).

## 0.7.x
Aufgaben, Gedächtnis, Gesprächsverlauf, Automatisierungs-Freigaben, Groq, Update-Assistent, Windows-Installer-Workflow.
