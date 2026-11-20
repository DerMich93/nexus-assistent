# Automatische Updates einrichten (einmalig)

Danach baut GitHub jede neue Version selbst, und NEXUS bietet sie unter **KI-Verwaltung → Updates** zum Installieren an.
Auf dem Laptop werden keine Entwicklerwerkzeuge mehr gebraucht. Installiert wird nur nach deinem Klick; vorher sichert NEXUS deine Daten.

**Sicherheit:** Jedes Update ist mit deinem eigenen Schlüssel signiert. NEXUS installiert nur Pakete mit gültiger Signatur.

## 1. Schlüssel erzeugen (Laptop, ca. 5 Minuten)
1. `UPDATE-SCHLUESSEL-ERZEUGEN.bat` doppelklicken (installiert bei Bedarf Node.js).
2. Ein Passwort ausdenken und eingeben – **gut notieren**.
3. Das Fenster zeigt den **öffentlichen Schlüssel**; der private liegt in der Zwischenablage.
4. **Den Ordner `%USERPROFILE%\.nexus-updater` sichern** (USB-Stick oder Passwortmanager). Ohne ihn keine Auto-Updates mehr.

## 2. Zugangstoken für das Release-Repository (github.com)
1. Öffne https://github.com/settings/personal-access-tokens/new (Fine-grained token).
2. Name: `nexus-releases`, Ablauf: z. B. 1 Jahr.
3. *Repository access* → **Only select repositories** → `nexus-assistent-releases`.
4. *Permissions* → *Repository permissions* → **Contents: Read and write**.
5. **Generate token** und den Token kopieren.

## 3. In GitHub eintragen
Repository **nexus-assistent** → **Settings → Secrets and variables → Actions**:

| Art | Name | Wert |
|---|---|---|
| Secret | `TAURI_SIGNING_PRIVATE_KEY` | Inhalt aus der Zwischenablage (Schritt 1) |
| Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | dein Passwort |
| Secret | `RELEASES_TOKEN` | Token aus Schritt 2 |
| Variable (Reiter „Variables“) | `TAURI_UPDATER_PUBKEY` | öffentlicher Schlüssel aus Schritt 1 |

## 4. Erste Version bauen und einmal von Hand installieren
1. Repository **nexus-assistent** → **Actions** → „Nexus Assistent Windows Installer“ → **Run workflow**.
2. Nach ca. 15–25 Minuten liegt in **nexus-assistent-releases** unter *Releases* die Version mit `Nexus Assistent_…_x64-setup.exe`.
3. Diese Datei herunterladen und installieren (Daten bleiben erhalten). Ab jetzt kommen Updates automatisch.

## Neue Versionen
Wenn eine neue Version im Repository liegt: **Actions → Run workflow**. NEXUS meldet das Update beim nächsten Start
(oder über „Nach Updates suchen“).

## Probleme
- **„Automatische Updates sind nicht eingerichtet“**: Die installierte Version wurde ohne Schlüssel gebaut. Schritte 1–4 erledigen und einmal von Hand installieren.
- **Workflow ohne Release**: Fehlt ein Secret oder die Variable, baut GitHub den Installer trotzdem; er liegt dann nur unter *Actions → Lauf → Artifacts*.
- **Signaturfehler beim Update**: Der Schlüssel im Secret passt nicht zum öffentlichen Schlüssel der installierten Version. Nie einen neuen Schlüssel erzeugen, solange der alte existiert.
