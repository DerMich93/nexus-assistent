# Nexus Assistent 1.2

Dein persönlicher KI-Assistent für Windows 11. Der Nexus Assistent (kurz: NEXUS) läuft auf deinem PC, speichert alle Daten lokal und spricht mit der
KI deiner Wahl: in der Cloud mit deinem eigenen API-Key **oder komplett lokal**. Es gibt keine Werbung, keine Telemetrie und kein Konto bei uns.

## Überblick

| Bereich | Was es kann |
|---|---|
| **KI** | OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, OpenRouter (Cloud); Ollama und beliebige OpenAI-kompatible Server wie LM Studio (lokal). Eigener Modellname möglich. Der Chat kennt den Gesprächsverlauf, das Datum, auf Wunsch Gedächtnis, Aufgaben und Termine. |
| **Aufgaben & Kalender** | Aufgaben mit Fälligkeit und Wiederholung; lokaler Kalender mit Monatsansicht, Serientermine, `.ics`-Import/-Export; Erinnerungen und Morgenüberblick. |
| **Modell-Zentrale** | Automatische KI-Auswahl je Aufgabe (Allgemein, Dokumente, Code, Recherche) mit Ausweichmodellen bei Limit oder Ausfall; Datenschutz-Ampel; Monatsbudget (Standard 0 €); unter jeder Antwort „via Anbieter · Modell“. |
| **Wetter, Feiertage, Rechner** | Wetter über Open-Meteo (kostenlos, ohne Key), Feiertage je Bundesland (lokal berechnet), exaktes Rechenwerkzeug für die KI. |
| **Updates** | Signierte Auto-Updates über GitHub (Einrichtung: `UPDATES.md`); Installation nur auf Klick. |
| **Arbeitsordner** | `Dokumente\Nexus-Arbeitsordner`: Word (`.docx`), Excel (`.xlsx`), `.txt`, `.md`, `.csv` und `.json` an den Chat anhängen; NEXUS schlägt neue Dateien vor (Word, Excel, Text), gespeichert wird nur nach „Bestätigen“ und **nie über eine vorhandene Datei**. |
| **Aktionen per Chat** | NEXUS schlägt Aufgaben, Termine und Gedächtnis-Einträge vor, gespeichert wird **nur nach deinem Klick auf „Bestätigen“**. |
| **Internet (geschützt)** | Websuche (DuckDuckGo) und Lesen freigegebener Seiten, standardmäßig aus; aus Internetinhalten entstehen nie Aktionen. |
| **Sprache** | Spracheingabe lokal (whisper.cpp) oder per Cloud; Vorlesen mit den Windows-Stimmen. |
| **Hintergrund** | Autostart, Infobereich-Symbol, Windows-Benachrichtigungen für Erinnerungen und Termine. |
| **Datenschutz & Sicherheit** | API-Keys im Windows-Schlüsselbund; lokale Datenverschlüsselung (XChaCha20-Poly1305) mit Wiederherstellungsschlüssel; automatische Sicherung (die letzten 5); passwortgeschützte Datensicherung (Argon2id); Freigaben pro Datenart für Cloud-KI. |

**Bewusst noch nicht enthalten:** Live-Antworten Wort für Wort, E-Mail-Anbindung, Entsperren per Passwort statt Windows-Konto, signierter Installer (siehe „Ausblick“).

## Installieren

### Weg 1 – eine Datei, ein Doppelklick
**`NEXUS-INSTALLIEREN.bat`** doppelklicken. Das Fenster
1. prüft Node.js, Rust und die C++-Build-Tools und installiert Fehlendes nach Rückfrage über winget,
2. sichert vorhandene NEXUS-Daten nach `%LOCALAPPDATA%\NEXUS\Backups`,
3. baut den Nexus Assistenten und erzeugt die fertige Datei **`Nexus-Assistent-Setup.exe`** (liegt danach im Ordner),
4. startet auf Wunsch die Installation.

Der erste Lauf dauert 15–30 Minuten (die C++-Build-Tools sind mehrere GB groß). Spätere Läufe sind deutlich schneller.
Ein **Update** funktioniert genauso: Neuen Ordner entpacken und `NEXUS-INSTALLIEREN.bat` erneut ausführen; die Daten bleiben erhalten.
Die erzeugte `Nexus-Assistent-Setup.exe` kannst du auf andere Windows-PCs kopieren; dort brauchst du keine Werkzeuge.

### Weg 2 – Installer von GitHub bauen lassen (nichts auf dem PC installieren)
1. Privates GitHub-Repository anlegen und den **Inhalt dieses Ordners** hochladen (`.gitignore` ist dabei).
2. Im Repository **Actions → „Nexus Assistent Windows Installer“ → Run workflow**.
3. Nach dem Lauf unter **Artifacts** „Nexus-Assistent-Windows-Installer“ herunterladen (`.exe` und `.msi`).

Windows SmartScreen kann warnen, weil der Installer nicht signiert ist („Weitere Informationen → Trotzdem ausführen“).

### Wichtig beim Wechsel von einer älteren Version (NEXUS 0.x)
Ab 1.0 heißt die App „Nexus Assistent“ (vorher „NEXUS“). Windows behandelt sie deshalb als eigenes Programm:
1. Lege in der alten Version vorher eine Sicherung an („Datensicherung“ oder „Jetzt sichern“).
2. Installiere den Nexus Assistenten 1.0. Deine Daten (Ordner `%APPDATA%\de.nexus.assistant`) und dein Windows-Schlüsselbund werden weiterverwendet.
3. Deinstalliere danach die alte App „NEXUS“ unter Einstellungen → Apps. Fragt der Deinstaller, ob die Anwendungsdaten gelöscht werden sollen: **nicht** ankreuzen.
4. Ein früher eingerichteter Autostart gehört zur alten App; schalte ihn in 1.0 unter *KI-Verwaltung → Hintergrund & Benachrichtigungen* neu ein.

## Erster Start: Prüfliste
Der Nexus Assistent wurde **ohne Zugriff auf einen Windows-Rechner** entwickelt. Die Logik ist abgesichert (111 Unit-Tests, 222 Oberflächentests in einer simulierten Umgebung, 42 Rust-Tests im Quelltext),
aber die fertige Windows-App ist von den Entwicklungswerkzeugen nie gebaut oder gestartet worden. Die reine Rust-Logik (Arbeitsordner, Persönlichkeit, Ortsnamen) wurde einzeln getestet; der Gesamt-Build mit Tauri, das Update-Modul und der Wetterabruf sind ungeprüft. Bitte arbeite beim ersten Mal diese Liste ab, bevor du dich auf die App verlässt:

1. **Bauen:** `Nexus-Assistent` mit `NEXUS-INSTALLIEREN.bat` bauen. Bricht der Build ab, notiere die erste rote Zeile mit `error` (sie nennt die Ursache).
2. **Start:** Die App zeigt die Oberfläche (kein leeres Fenster) und fragt beim ersten Mal nach dem KI-Anbieter.
3. **KI:** Anbieter und Key eintragen, „Verbindung testen“, eine Frage stellen.
4. **Aufgabe:** Eine Aufgabe mit Fälligkeit in zwei Minuten anlegen; die Erinnerung muss erscheinen.
5. **Kalender:** Einen Termin anlegen, bearbeiten, löschen; einmal als `.ics` exportieren und wieder importieren.
6. **Sicherung:** „Jetzt sichern“ (KI-Verwaltung); die Sicherung erscheint in der Liste.
7. **Verschlüsselung:** Einschalten, Wiederherstellungsschlüssel notieren. Dann `%APPDATA%\de.nexus.assistant\tasks.json` im Editor öffnen: Zeichensalat (Beginn „NXD1“) heißt „verschlüsselt“.
8. **Hintergrund:** Autostart und „Im Infobereich weiterlaufen“ ausprobieren (Symbol neben der Uhr, Rechtsklick → „NEXUS beenden“).
9. **Arbeitsordner:** „Arbeitsordner“ öffnen → „Ordner im Explorer öffnen“; eine Word-Datei hineinlegen, mit 📎 anhängen, eine Frage dazu stellen. Dann „Speichere das als Test.docx“ bitten, bestätigen und die neue Datei in Word öffnen.
10. **Modell-Zentrale:** In der KI-Verwaltung einschalten, Keys für Groq und Mistral speichern, „Diagnose starten“. Dann eine Frage stellen: Unter der Antwort steht „via …“.
11. **Wetter:** Heimatort eintragen, „Brauche ich morgen einen Schirm?“ fragen.
12. **Optional:** Spracheingabe (erst `SPRACHEINGABE-EINRICHTEN.bat`) und Internetzugriff.

## Erste Schritte: KI einrichten
Oben rechts **⚙ KI-Verwaltung** → Anbieter wählen → Modell wählen → API-Key einfügen → **Verbindung testen** → **Speichern**.

| Anbieter | API-Key erzeugen |
|---|---|
| OpenAI | https://platform.openai.com/api-keys |
| Anthropic Claude | https://console.anthropic.com/settings/keys |
| Google Gemini | https://aistudio.google.com/apikey |
| Groq | https://console.groq.com/keys |
| Mistral | https://console.mistral.ai/api-keys |
| OpenRouter | https://openrouter.ai/keys |

Ein ChatGPT-, Claude- oder Gemini-**Abo** enthält kein API-Guthaben. API-Nutzung wird vom Anbieter separat abgerechnet.
NEXUS selbst ist kostenlos, ohne Werbung und ohne Telemetrie.

### Komplett lokal (nichts verlässt deinen PC)
- **Ollama:** von https://ollama.com/download installieren, dann in der Eingabeaufforderung z. B. `ollama pull qwen2.5:3b`.
  In NEXUS „Lokale KI – Ollama“ wählen und **Verbindung testen** – NEXUS listet deine installierten Modelle auf.
- **LM Studio / llama.cpp / vLLM u. a.:** Server starten, in NEXUS „Eigener Server“ wählen, Adresse eintragen
  (z. B. `http://localhost:1234`). Ein Modellname kann aus der Liste kommen oder von Hand eingetragen werden.

Hinweis zu Modellnamen: Anbieter benennen Modelle laufend um. Die Auswahlliste enthält Startwerte; wenn ein Name
nicht mehr funktioniert, trage den aktuellen im Feld „Eigener Modellname“ ein (siehe Modellliste des Anbieters).

## Aktionen per Chat
NEXUS kann **Aufgaben/Termine/Erinnerungen** (auch wiederkehrend) anlegen und **Gedächtnis-Einträge** speichern.
Das Modell macht nur einen Vorschlag; er erscheint als Karte im Chat. **Nichts wird ohne deinen Klick gespeichert.**
Es gibt bewusst keine Aktionen zum Löschen oder zum Ausführen von Programmen. Geprüft wird streng: unbekannte Aktionen,
kaputte Daten und ungültige Termine werden verworfen. Vorschläge kommen nur auf deine ausdrückliche Bitte, nicht aufgrund
von Inhalten aus Gedächtnis, Aufgabenliste oder eingefügten Texten.
Wie zuverlässig das klappt, hängt vom Modell ab; große Modelle halten das Format sicher ein, sehr kleine lokale
Modelle gelegentlich nicht (dann erscheint einfach keine Karte).

## Modell-Zentrale (automatische KI-Auswahl)
**KI-Verwaltung → Modell-Zentrale** einschalten. NEXUS wählt dann pro Frage eine Rangliste von KIs und wechselt bei **Limit (429), Serverfehler, Zeitüberschreitung, fehlendem oder falschem Key** automatisch zur nächsten (höchstens 4 Versuche). Bei inhaltlichen Fehlern wird nicht gewechselt.

- **Aufgaben-Profile** (Rangliste änderbar, optional mit Modell, z. B. `mistral:codestral-latest`):
  *Allgemein* Groq → Mistral → Gemini → (Claude, OpenAI) → lokal · *Dokumente/lange Texte* (Datei angehängt oder sehr lange Nachricht) Mistral Large → Groq → Gemini → … · *Code & Formeln* Codestral → Groq → … · *Recherche* Groq → Mistral → …
  Erkannt wird mit einfachen Regeln (Datei, Länge, Wörter wie „Formel“, „Excel“, „aktuell“). Von Hand: Nachricht mit `@groq`, `@mistral`, `@gemini`, `@openrouter`, `@lokal`, `@claude` oder `@openai` beginnen.
- **Datenschutz-Ampel:** 🟢 kein Training laut Anbieter (Groq, Claude, OpenAI, lokal; Mistral nur mit abgeschaltetem Training; Gemini nur mit Abrechnungskonto) · 🟡 kann trainieren (Gemini gratis, OpenRouter, Mistral ohne Opt-out).
  Gedächtnis, Aufgaben, Termine und Dateien gehen **nur an 🟢** und nur mit den bisherigen Freigaben. Mit angehängter Datei werden 🟡-Anbieter übersprungen.
- **Budget:** Standard **0 €** – dann werden Claude und OpenAI nie benutzt. Mit Budget schätzt NEXUS die Kosten grob aus der Textlänge (nur eine Schätzung; maßgeblich ist die Abrechnung des Anbieters). OpenRouter nur mit Gratismodellen (`:free`, `openrouter/free`).
- **Kostenlose Anbieter:** Groq (kein Training), Mistral (Training in der Admin-Konsole abschalten!), Gemini (Gratis-Kontingent kann zum Training genutzt werden), OpenRouter (50 Gratis-Anfragen/Tag). Lokal mit Ollama als letzte Reserve (ohne Grafikkarte langsam).
- **Anzeige:** Unter jeder Antwort steht z. B. „⚙ via Mistral · mistral-small-latest (Ersatz: Groq – Limit erreicht)“. **Diagnose starten** prüft alle aktiven KIs, Wetter, Arbeitsordner und Updates.
- **Grenzen:** Modellnamen ändern sich bei den Anbietern oft; die Voreinstellungen sind Startwerte (im Feld überschreibbar, Diagnose zeigt „Modell nicht gefunden“). Kosten- und Ampel-Angaben beruhen auf den Bedingungen der Anbieter zum Stand November 2026.

## Wetter, Feiertage, Rechnen, Persönlichkeit
- **Wetter:** Bei Wetterfragen holt NEXUS die Vorhersage (7 Tage) bei **Open-Meteo** – kostenlos, ohne Key, nur Ort bzw. Koordinaten werden gesendet. Ort aus der Frage („in Hamburg“) oder der **Heimatort**. Die KI nennt die Quelle. Abschaltbar.
- **Feiertage:** lokal berechnet (bundesweit oder je Bundesland), ohne Internet. NEXUS kennt den heutigen und den nächsten Feiertag.
- **Morgenüberblick:** zusätzlich Wetter am Heimatort, Feiertag und Geburtstage der nächsten 7 Tage (Termine mit „Geburtstag“ im Titel).
- **Rechner:** Die KI rechnet über ein eigenes Werkzeug (Prozent, Klammern, Potenzen, Runden, Tage zwischen Daten) statt zu schätzen.
- **Persönlichkeit:** Anrede (Sie/du), Antwortlänge (kurz/normal/ausführlich), Butler-Ton an/aus.
- **Alle bestätigen:** Schlägt NEXUS mehrere Einträge vor, lassen sie sich auf einmal bestätigen oder verwerfen.

## Updates
Siehe **`UPDATES.md`** (einmalige Einrichtung: Schlüssel erzeugen, drei Secrets und eine Variable in GitHub, einmal von Hand installieren). Danach: **KI-Verwaltung → Nach Updates suchen → Update installieren** (vorher wird automatisch gesichert). Beim Start prüft NEXUS auf Wunsch selbst und meldet neue Versionen im Chat.

## Arbeitsordner (Dateien lesen und speichern)
Beim ersten Öffnen legt NEXUS den Ordner **`Dokumente\Nexus-Arbeitsordner`** an. Nur auf diesen Ordner hat NEXUS Zugriff.

- **Datei anhängen:** 📎 neben dem Eingabefeld (oder oben „Arbeitsordner“) → Datei wählen → „An Chat anhängen“ → Bitte eintippen, z. B. „Fasse das zusammen“ oder „Überarbeite den Brief freundlicher“.
  NEXUS liest den **Text** der Datei: bei Word ohne Formatierung und Bilder (Überschriften, Aufzählungen und Tabellen bleiben erkennbar), bei Excel die Werte aller Tabellenblätter (Formeln als zuletzt berechnete Werte, Datumswerte als Datum).
  Pro Datei gehen höchstens 30.000 Zeichen an die KI (etwa 10–15 Seiten); was abgeschnitten wurde, sagt NEXUS der KI ausdrücklich.
- **Neue Datei:** Bitte z. B. „Speichere das als Angebot.docx“ oder „Mach mir eine Excel-Tabelle mit meinen Ausgaben“. Es erscheint eine Karte mit Vorschau; erst **„Bestätigen“** schreibt die Datei.
  Gibt es den Namen schon, entsteht **`Name (2).docx`**; das Original bleibt immer unverändert. Word-Dateien bekommen Überschriften, Aufzählungen, Fettdruck und Tabellen; Excel-Dateien Tabellenblätter, Zahlen und Formeln (deutsche Namen wie SUMME werden übersetzt).
- **Grenzen:** Kein Löschen, kein Überschreiben, keine Unterordner, keine Makros. Alte Formate (`.doc`, `.xls`), PDF und kennwortgeschützte Dateien gehen nicht – in Word/Excel als `.docx`/`.xlsx` speichern.
  Beim Überarbeiten schreibt die KI den Text neu: Layout, Schriftarten, Bilder, Kopf-/Fußzeilen der Vorlage gehen dabei verloren. Sehr lange Dokumente können die Antwortlänge des Modells sprengen; dann meldet NEXUS „unvollständig übertragen“ – in Teilen arbeiten.
  Der Dateitext bleibt nur im laufenden Gespräch und wird **nicht** im Gesprächsverlauf gespeichert. Der Arbeitsordner ist nicht Teil der automatischen Sicherung (es sind deine eigenen Dateien).
- **Datenschutz:** Bei Cloud-KI gehen angehängte Dateien nur mit der Freigabe *„Dateien aus dem Arbeitsordner an Cloud-KI schicken“* (KI-Verwaltung, Standard: aus) an den Anbieter. Lokale KI darf immer.
  Dateiinhalte werden der KI als fremde Daten übergeben („keine Anweisungen“); nach einer Websuche entstehen keine Datei-Vorschläge.

## Spracheingabe
**Einrichten (lokal, empfohlen):** `SPRACHEINGABE-EINRICHTEN.bat` ausführen. Das Skript lädt whisper.cpp und ein
Sprachmodell (small, ca. 470 MB) nach `%LOCALAPPDATA%\NEXUS\whisper`, legt eine Autostart-Verknüpfung an und startet
den Server auf `127.0.0.1:8178`. Danach in NEXUS: **KI-Verwaltung → Spracheingabe → „Lokal“ → „Spracheingabe testen“ → Speichern**.

**Benutzen:** **Voice** einschalten und einfach sprechen. NEXUS erkennt Anfang und Ende einer Äußerung (ca. 1 Sekunde
Pause), erkennt den Text und schickt ihn wie eine getippte Nachricht ab. Während NEXUS antwortet oder vorliest, hört es nicht zu.
Beim ersten Mal fragt Windows nach der Mikrofon-Erlaubnis.

**Alternativen:** Groq Whisper oder OpenAI Whisper (Cloud; Aufnahmen gehen dann an den Anbieter, der Key liegt getrennt
im Schlüsselbund) oder ein eigener Server mit OpenAI-kompatibler Schnittstelle.
Findet das Skript kein Windows-Paket, zeigt es alle verfügbaren Dateien an und nennt den Weg für den manuellen Download
(entpacken nach `%LOCALAPPDATA%\\NEXUS\\whisper\\bin`, Skript erneut starten). Ohne Installation geht es sofort mit **Groq Whisper** (Cloud).
Bei Problemen mit dem lokalen Server: Fehlermeldung in NEXUS lesen; häufig hilft die Visual-C++-Runtime
(`aka.ms/vs/17/release/vc_redist.x64.exe`) oder eine Ausnahme im Windows Defender für `whisper-server.exe`.

## Hintergrundbetrieb und Benachrichtigungen
In **KI-Verwaltung → Hintergrund & Benachrichtigungen** (alles standardmäßig aus, außer den Benachrichtigungen):
- **Mit Windows starten:** NEXUS beginnt leise im Infobereich (neben der Uhr), ohne Fenster.
- **Im Infobereich weiterlaufen:** Das Schließen des Fensters beendet NEXUS nicht mehr, nur das Fenster verschwindet.
  Klick auf das Symbol öffnet das Menü: „NEXUS öffnen“ / „NEXUS beenden“. Zum Beenden also Rechtsklick → „NEXUS beenden“.
- **Benachrichtigungen:** Fällige Erinnerungen und der Morgenüberblick erscheinen als Windows-Hinweis, **nur wenn NEXUS gerade nicht
  im Vordergrund ist** (sonst steht die Meldung im Chat). Es läuft immer nur eine NEXUS-Instanz; ein zweiter Start öffnet das vorhandene Fenster.
Erinnerungen prüft NEXUS jede halbe Minute. Läuft das Fenster versteckt, kann Windows die Prüfung auf etwa eine Minute drosseln.

## Automatische Sicherung
NEXUS sichert deine Daten (Gespräche, Aufgaben, Gedächtnis, Einstellungen) beim Start und danach stündlich geprüft, **aber nur
bei Änderungen**. Es bleiben **die letzten 5** Sicherungen, ältere werden automatisch gelöscht. Ablage:
`%LOCALAPPDATA%\de.nexus.assistant\AutoBackups`. Unter **KI-Verwaltung → Automatische Sicherung** kannst du sofort sichern
und eine Sicherung wiederherstellen; der Stand davor wird einmalig in `_vor-wiederherstellung` beiseitegelegt.
Die Sicherungen sind Kopien der Dateien **so, wie sie gespeichert sind**: Ist die Datenverschlüsselung an, sind auch die Sicherungen verschlüsselt.
Für Sicherungen, die du aus der Hand gibst oder auf einen anderen PC mitnimmst, nimm die passwortgeschützte **Datensicherung** (Datei `.nexusbackup`).

## Datenverschlüsselung
**KI-Verwaltung → Datenverschlüsselung → „Verschlüsselung einschalten“.** Danach sind Gedächtnis, Gespräche, Aufgaben, Kalender und
Automatisierungen auf der Festplatte verschlüsselt (XChaCha20-Poly1305, jede Datei mit eigenem Zufallswert, fest an den Dateinamen gebunden).
Die Verschlüsselung passiert ausschließlich auf deinem PC, nichts wird irgendwohin gesendet.

- **Schlüssel:** Ein zufälliger Schlüssel liegt im Windows-Schlüsselbund deines Benutzerkontos. NEXUS entsperrt sich damit von selbst,
  deshalb funktionieren Autostart, Hintergrundbetrieb und Erinnerungen ohne Passwort-Eingabe.
- **Wiederherstellungsschlüssel (wichtig!):** Beim Einschalten zeigt NEXUS den Schlüssel einmal an (64 Zeichen in Gruppen). **Schreibe ihn auf oder
  lege ihn in einem Passwortmanager ab.** Wird Windows neu installiert oder das Benutzerkonto gelöscht, ist der Schlüssel im Schlüsselbund weg;
  ohne den Wiederherstellungsschlüssel sind die verschlüsselten Daten dann unwiederbringlich verloren. Mit ihm gibst du ihn unter
  „Datenverschlüsselung“ einfach wieder ein (NEXUS prüft vorher, ob er zu den Daten passt). Du kannst ihn jederzeit erneut anzeigen lassen.
- **Was geschützt wird:** Das Kopieren der Dateien: aus einer Cloud-Sicherung des Benutzerordners, von einer ausgebauten Festplatte, von einem
  anderen Windows-Konto aus oder durch Programme, die nur Dateien einsammeln.
- **Was nicht geschützt wird:** Jemand, der an deinem angemeldeten Windows-Konto sitzt, kann NEXUS öffnen und alles lesen. Dafür ist die
  Windows-Anmeldung zuständig (Passwort oder PIN, Sperrbildschirm). `settings.json` (Anbieter, Adressen, Schalter) bleibt bewusst lesbar,
  damit NEXUS auch bei fehlendem Schlüssel starten und die Wiederherstellung anbieten kann. API-Keys liegen ohnehin im Schlüsselbund.
- **Ausschalten:** wandelt alles zurück in Klartext. Der Schlüssel bleibt im Schlüsselbund, damit ältere verschlüsselte Sicherungen lesbar bleiben.
- **Eine passwortgeschützte `.nexusbackup`** enthält die Daten unabhängig davon und kann auch ohne diesen Schlüssel wiederhergestellt werden.
- **Prüfen, ob es wirkt:** Öffne `%APPDATA%\de.nexus.assistant\tasks.json` mit dem Editor. Verschlüsselt siehst du Zeichensalat (Beginn „NXD1“),
  sonst lesbaren Text.

## Kalender
Der Knopf **Kalender** öffnet eine Monatsansicht mit Tagesliste. Die Termine liegen nur auf diesem PC (`calendar.json`), sind bei eingeschalteter
Datenverschlüsselung verschlüsselt und stecken in automatischen und manuellen Sicherungen. „Aufgaben“ bleibt für Erledigungen, der Kalender ist für Termine mit festem Zeitpunkt.

- **Termine:** Titel, Beginn/Ende (oder ganztägig, auch mehrtägig), Ort, Notizen und Wiederholung (täglich, wöchentlich, monatlich, jährlich, alle n Einheiten, optional bis zu einem Datum).
  Ein 31. in einem 30-Tage-Monat und ein 29. Februar in Nicht-Schaltjahren werden übersprungen. Die Uhrzeit bleibt über die Zeitumstellung stabil. Änderungen und Löschen einer Serie gelten für alle Wiederholungen.
- **Erinnerungen:** NEXUS meldet einen Termin im Chat und (wenn NEXUS nicht im Vordergrund ist) als Windows-Benachrichtigung. Die Vorlaufzeit (zum Beginn, 5, 15, 30 oder 60 Minuten) stellst du unter *KI-Verwaltung* ein.
  Ganztägige Termine melden sich einmal am Tag ab 8 Uhr. Der **Morgenüberblick** nennt die heutigen Termine.
- **Chat:** NEXUS kann Termine **vorschlagen** („Trag den Elternabend am 1. April um 19 Uhr in der Schule ein“); wie bei Aufgaben wird erst nach **Bestätigen** gespeichert.
  Lokale KI kennt deine Termine der nächsten 14 Tage; bei Cloud-KI nur mit der Freigabe „Termine mitschicken“ (Standard: aus), damit Fragen wie „Habe ich morgen Zeit?“ funktionieren.
  Nach einer Websuche entstehen nie Termin-Vorschläge.
- **Import/Export (`.ics`):** Export erzeugt eine Standarddatei für Handy, Outlook, Thunderbird u. a. Der Import erkennt Zeitzonen (auch Windows-Namen wie „W. Europe Standard Time“), Ganztagstermine, Dauer und Serien.
  Bereits vorhandene Termine (gleiche UID) werden beim erneuten Import übersprungen, nichts wird doppelt angelegt. **Was nicht übernommen wird, sagt NEXUS im Ergebnis ausdrücklich:** abgesagte Termine, Einzeländerungen an Serien,
  Ausnahmetage von Serien und Regeln, die sich nicht abbilden lassen („jeden 1. Montag“, „Mo, Mi und Fr“ werden vereinfacht). Erinnerungsalarme und Teilnehmerlisten der Datei werden ignoriert.
- **Grenzen:** Keine Synchronisation mit Online-Kalendern (CalDAV, Google, Microsoft 365). Dafür bleibt alles lokal. Ein Austausch geht per `.ics`-Datei. Zeiten werden in der Zeitzone dieses PCs angezeigt.
  Termine melden sich nur, solange NEXUS läuft (Fenster offen oder im Infobereich).

## Internetzugriff
**KI-Verwaltung → Internetzugriff** (standardmäßig **aus**). Ist er an, kann das Modell bei Bedarf (aktuelle Ereignisse, Preise, Öffnungszeiten, Versionen) eine Suche
anfordern. NEXUS führt sie aus, zeigt im Chat an, wonach gesucht wird, und gibt dem Modell die Treffer. Bei Bedarf liest es eine Seite aus den Treffern.
Antworten nennen ihre Quellen. Pro Frage gibt es höchstens zwei Abfragen.

- **Cloud-KI:** Hier ist der Zugriff zusätzlich freizuschalten („Auch bei Cloud-KI erlauben“), weil dann Suchanfrage und gefundene Texte an deinen KI-Anbieter gehen.
  Bei lokaler KI (Ollama, localhost) reicht die Hauptfreigabe.
- **Schutz, im Programmcode erzwungen (nicht nur im Prompt):**
  - Seiten werden **nur** geöffnet, wenn ihre Adresse in den letzten Suchergebnissen stand. Eine eingeschleuste Aufforderung kann NEXUS also nicht auf beliebige Adressen schicken.
  - Nur `https`; keine Adressen mit Zugangsdaten; keine internen Namen (`localhost`, `.local`, `.internal`, einfache Rechnernamen).
  - Jeder Servername wird aufgelöst und gegen **interne und private Netze** geprüft (z. B. `192.168.x.x`, `10.x.x.x`, `127.0.0.1`, Cloud-Metadaten `169.254.169.254`, IPv6-Entsprechungen). Das gilt auch nach jeder Weiterleitung, und die Verbindung wird an die geprüfte Adresse gebunden.
  - Größe (1 MB), Zeit (15 s), Weiterleitungen (4) und Textlänge sind begrenzt; es werden nur Text und HTML gelesen.
  - Webtext wird entschärft (keine Tags) und dem Modell als **fremde, unvertrauenswürdige Daten** übergeben.
  - **Aus Internetinhalten entstehen nie Aktionen:** Nach einer Websuche zeigt NEXUS keinen Vorschlag zum Anlegen von Aufgaben oder Gedächtnis-Einträgen an.
    Webtext und Statuszeilen werden nicht im Gesprächsverlauf gespeichert.
- **Grenzen:** Die Suche nutzt die HTML-Seite von DuckDuckGo. Das ist **keine offizielle Schnittstelle**. Ändert DuckDuckGo das Seitenformat oder blockiert automatische Anfragen,
  fällt die Suche aus; NEXUS meldet das dann ehrlich. Ob die Nutzungsbedingungen von DuckDuckGo diese Nutzung abdecken, ist nicht geprüft; sie ist für den persönlichen Gebrauch mit wenigen Anfragen gedacht.
  Seiten werden als UTF-8 gelesen (andere Zeichensätze können verzerrt erscheinen), Inhalte, die erst per JavaScript entstehen, sieht NEXUS nicht.
  Das Modell sollte keine persönlichen Daten in Suchanfragen schreiben (steht in seinen Anweisungen), garantieren kann das keine KI. Deshalb ist die Anfrage im Chat sichtbar.

## Datenschutz – was geht wohin?
- **API-Keys** liegen im Windows-Schlüsselbund. Nicht in Dateien, nicht in der Oberfläche, nicht in Sicherungen.
- **Spracheingabe lokal:** Audio wird nur an `127.0.0.1` gesendet. **Cloud-Spracheingabe** sendet Aufnahmen an Groq/OpenAI.
- **Internet:** Suchanfragen gehen an DuckDuckGo, gelesene Seiten werden direkt vom jeweiligen Server geladen (dessen Betreiber sieht deine IP-Adresse).
- **Cloud-KI:** Deine Nachrichten und der Gesprächsverlauf gehen an den gewählten Anbieter. **Erinnerungen** und
  **offene Aufgaben** nur, wenn du das in der KI-Verwaltung je einzeln erlaubst (Standard: aus).
- **Lokale KI** (Ollama oder Server auf `localhost`) bekommt Erinnerungen und Aufgaben immer, weil sie den PC nicht verlassen.
- **Arbeitsordner:** Angehängte Dateien gehen an Cloud-KI nur mit eigener Freigabe (Standard: aus); an lokale KI immer.
- **Modell-Zentrale:** Private Daten nur an 🟢-Anbieter (siehe oben). **Wetter:** nur der Ort geht an Open-Meteo. **Updates:** NEXUS fragt nur die öffentliche Release-Seite auf GitHub ab.
- Entfernte eigene Server sind nur per `https` erlaubt. Ein automatischer Anbieterwechsel passiert nur mit eingeschalteter Modell-Zentrale.
- Die lokalen Datendateien (`%APPDATA%\de.nexus.assistant`) sind standardmäßig **nicht** verschlüsselt. Schalte die
  **Datenverschlüsselung** ein (siehe oben) und schütze dein Windows-Konto.

## Datensicherung
In NEXUS oben rechts **Datensicherung**: erzeugt eine `.nexusbackup`-Datei, geschützt mit deinem Passwort (mind. 12 Zeichen,
wird nicht gespeichert – ohne Passwort keine Wiederherstellung). Ältere unverschlüsselte Sicherungen bleiben lesbar.
Zusätzlich sichert `NEXUS-INSTALLIEREN.bat` vor jeder Installation die Datendateien automatisch.

## Bekannte Grenzen (ehrlich)
- Antworten erscheinen am Stück, nicht Wort für Wort.
- **Spracheingabe:** Die Erkennung läuft im separaten Whisper-Server. Auf langsamen PCs dauert sie einige Sekunden (Modell „base“ ist schneller, aber ungenauer). Die Sprache ist fest auf Deutsch eingestellt.
  Bei Hintergrundgeräuschen kann NEXUS Fremdes aufnehmen; ein Headset-Mikrofon hilft.
- Erinnerungen, Termine und der Morgenüberblick gibt es nur, solange NEXUS läuft (Fenster offen oder im Infobereich). Ist NEXUS ganz beendet, passiert nichts.
- NEXUS führt selbst keine Programme aus und greift nur auf den Arbeitsordner zu (lesen, neue Dateien anlegen; nie löschen oder überschreiben). Aufgaben, Termine, Gedächtnis und Dateien per Chat gibt es nur mit deiner Bestätigung.
- Die Websuche nutzt eine inoffizielle Schnittstelle von DuckDuckGo und kann ausfallen (siehe „Internetzugriff“).
- Der Installer ist nicht signiert; Windows SmartScreen kann deshalb warnen.
- Die Sicherheitsrichtlinie der App (CSP) ist etwas weiter gefasst als nötig (`unsafe-eval`). Es gibt keinen Fremdinhalt in der Oberfläche, trotzdem ist sie ein Kandidat zum Verschärfen.

## Ausblick
- **Entsperren per Passwort** statt über das Windows-Konto (zusätzlicher Modus der Datenverschlüsselung). Bewusst zurückgestellt: Ein Fehler hier könnte Daten unlesbar machen, das soll erst nach einem verifizierten Build entstehen.
- **E-Mail nur lesend** (IMAP). Bewusst zurückgestellt: braucht einen echten Mailserver zum Testen, geht um dein Mail-Passwort und öffnet Angriffsfläche durch fremde Mailinhalte (eingeschleuste Anweisungen).
  Käme mit denselben Schutzregeln wie der Internetzugriff.
- **1.3:** Bilder/Belege lesen, PDF und Scans (OCR). **1.4:** „Frag deine Dokumente“, bessere Stimme, Übersetzen. **1.5:** Routinen, kluge Hinweise, Rückblicke, Mehrschritt-Aufgaben, Gedächtnis-Vorschläge, Live-Antworten.
- Signierter Installer, strengere Sicherheitsrichtlinie.

## Für Entwickler
- **Aufbau:** `web/index.html` (Gerüst) und `web/app.css` (Gestaltung); `web/lib/` enthält die reine Logik ohne Oberfläche (`actions.js`, `calendar.js`, `office.js`, `router.js`, `tools.js`, `voice.js`, `web.js`), `web/ui/` die Oberflächen-Skripte
  (klassische Skripte mit gemeinsamem Zustand, Reihenfolge siehe `index.html`); `src-tauri/src/main.rs` ist das Rust-Backend; `tests/` die Tests; `tools/` die PowerShell-Skripte.
- `npm test` – 111 Unit-Tests (Pausenerkennung, WAV, Aktionen, Internet, Kalender, Word/Excel, Modell-Zentrale, Wetter, Feiertage, Rechner) und 222 Oberflächentests in simulierter Umgebung mit Fake-Backend; kein Windows nötig. Der Oberflächentest lädt genau die Dateien, die `index.html` einbindet.
- `cargo test --manifest-path src-tauri/Cargo.toml` – Rust-Tests (Backup- und Datenverschlüsselung, Gesprächsverlauf, Adressregeln, Netzsperren, Kalenderprüfung, Arbeitsordner).
- **Arbeitsordner:** Die Regeln stehen in `src-tauri/src/workspace.rs` (nur Standardbibliothek, einzeln testbar: `rustc --edition 2021 --test src-tauri/src/workspace.rs`; ebenso `extras.rs`). Word/Excel lesen und schreiben `web/lib/office.js` ohne Fremdbibliothek (ZIP über die eingebauten Compression-Streams von WebView2).
- Zum Ausprobieren ohne Installer: `npm install`, dann `npm run tauri:dev`. Es gibt keinen Bundler und keinen Dev-Server; Tauri bettet `web/` direkt ein.
- Alle KI-Anfragen laufen über das Rust-Backend (`ai_chat`, `ai_test`). Neue OpenAI-kompatible Anbieter brauchen nur einen Eintrag in `openai_compatible_base`, `normalize_provider`, `provider_label` und `credential_entry`.
- Wichtige Sicherheitsregeln im Code: Datendateien nur über `read_data_string`/`write_data`; Internetabrufe nur über `fetch_page_text`; Dateien des Nutzers nur über `workspace.rs` (`write_new_file` mit `create_new`, nie überschreiben); Aktionen werden nach Internetnutzung verworfen (`chat.js`).
