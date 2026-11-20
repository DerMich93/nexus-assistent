// Arbeitsordner: Der einzige Ort außerhalb der App-Daten, den NEXUS lesen und beschreiben darf.
// Regeln (im Code erzwungen, nicht nur im Prompt):
// - nur Dateien direkt im Ordner (keine Unterordner, keine Pfade, keine Verknüpfungen),
// - nur erlaubte Dateitypen, Größenlimits,
// - Schreiben legt immer eine NEUE Datei an; vorhandene Dateien werden nie überschrieben,
// - es gibt kein Löschen und kein Ausführen.
// Bewusst nur mit der Standardbibliothek, damit die Logik ohne Tauri getestet werden kann.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

pub const FOLDER_NAME: &str = "Nexus-Arbeitsordner";
pub const ALLOWED_EXTENSIONS: [&str; 6] = ["txt", "md", "csv", "json", "docx", "xlsx"];
pub const MAX_READ_BYTES: u64 = 10 * 1024 * 1024;
pub const MAX_WRITE_BYTES: usize = 10 * 1024 * 1024;
pub const MAX_NAME_CHARS: usize = 120;
pub const MAX_LIST: usize = 500;
const MAX_COPIES: u32 = 999;

const RESERVED: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Prüft einen Dateinamen und gibt ihn bereinigt (ohne Leerraum außen) zurück.
pub fn check_name(raw: &str) -> Result<String, String> {
    let name = raw.trim();
    if name.is_empty() { return Err("Der Dateiname fehlt.".into()); }
    if name.chars().count() > MAX_NAME_CHARS { return Err(format!("Der Dateiname ist zu lang (höchstens {MAX_NAME_CHARS} Zeichen).")); }
    if name.chars().any(|c| (c as u32) < 32 || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')) {
        return Err("Der Dateiname enthält unzulässige Zeichen (zum Beispiel / \\ : * ? \" < > |). Erlaubt sind nur Dateien direkt im Arbeitsordner.".into());
    }
    if name.starts_with('.') || name.ends_with('.') || name.ends_with(' ') || name.contains("..") {
        return Err("Der Dateiname ist ungültig.".into());
    }
    let Some((stem, ext)) = name.rsplit_once('.') else {
        return Err(format!("Der Dateiname braucht eine Endung ({}).", ALLOWED_EXTENSIONS.join(", ")));
    };
    let ext = ext.to_ascii_lowercase();
    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!("Dieser Dateityp ist nicht erlaubt. Erlaubt: {}.", ALLOWED_EXTENSIONS.join(", ")));
    }
    let base = stem.split('.').next().unwrap_or("").trim().to_ascii_uppercase();
    if base.is_empty() || RESERVED.contains(&base.as_str()) { return Err("Dieser Dateiname ist unter Windows reserviert.".into()); }
    Ok(name.to_string())
}

/// Liefert den Pfad einer vorhandenen, gewöhnlichen Datei im Ordner (keine Verknüpfung, kein Ordner).
pub fn existing_file(root: &Path, raw_name: &str) -> Result<(PathBuf, u64), String> {
    let name = check_name(raw_name)?;
    let path = root.join(&name);
    let meta = fs::symlink_metadata(&path).map_err(|_| format!("Die Datei „{name}“ gibt es im Arbeitsordner nicht."))?;
    if meta.file_type().is_symlink() || !meta.is_file() { return Err("Nur gewöhnliche Dateien im Arbeitsordner sind erlaubt (keine Verknüpfungen oder Ordner).".into()); }
    // Zusätzlich: Der aufgelöste Pfad muss wirklich im Arbeitsordner liegen.
    let real = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    let real_root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    if real.parent() != Some(real_root.as_path()) { return Err("Die Datei liegt nicht im Arbeitsordner.".into()); }
    Ok((path, meta.len()))
}

pub fn read_file(root: &Path, raw_name: &str) -> Result<Vec<u8>, String> {
    let (path, size) = existing_file(root, raw_name)?;
    if size > MAX_READ_BYTES { return Err(format!("Die Datei ist zu groß (höchstens {} MB).", MAX_READ_BYTES / 1024 / 1024)); }
    fs::read(&path).map_err(|e| format!("Die Datei konnte nicht gelesen werden: {e}"))
}

/// Name der n-ten Kopie: "bericht.docx" -> "bericht (2).docx".
pub fn copy_name(name: &str, n: u32) -> String {
    if n <= 1 { return name.to_string(); }
    match name.rsplit_once('.') {
        Some((stem, ext)) => format!("{stem} ({n}).{ext}"),
        None => format!("{name} ({n})"),
    }
}

/// Schreibt eine NEUE Datei. Gibt es den Namen schon, wird "Name (2).ext" usw. verwendet.
/// create_new verhindert auch bei gleichzeitigen Zugriffen jedes Überschreiben.
pub fn write_new_file(root: &Path, raw_name: &str, data: &[u8]) -> Result<String, String> {
    if data.len() > MAX_WRITE_BYTES { return Err(format!("Die Datei ist zu groß (höchstens {} MB).", MAX_WRITE_BYTES / 1024 / 1024)); }
    let name = check_name(raw_name)?;
    for n in 1..=MAX_COPIES {
        let candidate = copy_name(&name, n);
        if candidate.chars().count() > MAX_NAME_CHARS + 6 { break; }
        let path = root.join(&candidate);
        match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                let written = file.write_all(data).and_then(|_| file.sync_all());
                if let Err(e) = written {
                    drop(file);
                    let _ = fs::remove_file(&path); // nur die eben selbst angelegte, unvollständige Datei
                    return Err(format!("Die Datei konnte nicht geschrieben werden: {e}"));
                }
                return Ok(candidate);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("Die Datei konnte nicht angelegt werden: {e}")),
        }
    }
    Err("Es gibt bereits zu viele Dateien mit diesem Namen.".into())
}

pub struct Entry { pub name: String, pub size: u64, pub modified: u64 }

/// Erlaubte, gewöhnliche Dateien im Ordner, neueste zuerst.
pub fn list_files(root: &Path) -> Result<Vec<Entry>, String> {
    let mut out = Vec::new();
    let dir = fs::read_dir(root).map_err(|e| format!("Der Arbeitsordner konnte nicht gelesen werden: {e}"))?;
    for item in dir.flatten() {
        let Ok(kind) = item.file_type() else { continue };
        if !kind.is_file() || kind.is_symlink() { continue; }
        let Some(name) = item.file_name().to_str().map(str::to_string) else { continue };
        if check_name(&name).ok().as_deref() != Some(name.as_str()) { continue; }
        let Ok(meta) = item.metadata() else { continue };
        let modified = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
        out.push(Entry { name, size: meta.len(), modified });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    out.truncate(MAX_LIST);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("nexus-ws-{tag}-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn names_are_checked() {
        assert_eq!(check_name("  Bericht 2026.docx ").unwrap(), "Bericht 2026.docx");
        assert!(check_name("liste.XLSX").is_ok());
        assert!(check_name("notiz.v2.md").is_ok());
        for bad in ["", "../geheim.txt", "..\\geheim.txt", "ordner/datei.txt", "C:\\x.txt", "a:stream.txt", "datei.exe", "datei.bat",
                    "datei", ".versteckt.txt", "punkt.txt.", "CON.txt", "con.md", "LPT1.docx", "nul.backup.txt", "a*b.txt", "x\u{0}.txt", "a..b.txt"] {
            assert!(check_name(bad).is_err(), "sollte abgelehnt werden: {bad:?}");
        }
        assert!(check_name(&format!("{}.txt", "a".repeat(200))).is_err());
    }

    #[test]
    fn writing_never_overwrites() {
        let dir = temp_dir("write");
        assert_eq!(write_new_file(&dir, "bericht.docx", b"eins").unwrap(), "bericht.docx");
        assert_eq!(write_new_file(&dir, "bericht.docx", b"zwei").unwrap(), "bericht (2).docx");
        assert_eq!(write_new_file(&dir, "bericht.docx", b"drei").unwrap(), "bericht (3).docx");
        assert_eq!(fs::read(dir.join("bericht.docx")).unwrap(), b"eins");
        assert_eq!(fs::read(dir.join("bericht (2).docx")).unwrap(), b"zwei");
        assert!(write_new_file(&dir, "../raus.txt", b"x").is_err());
        assert!(write_new_file(&dir, "gross.txt", &vec![0u8; MAX_WRITE_BYTES + 1]).is_err());
        assert!(!dir.parent().unwrap().join("raus.txt").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn reading_stays_inside() {
        let dir = temp_dir("read");
        fs::write(dir.join("notiz.txt"), "hallo").unwrap();
        fs::create_dir_all(dir.join("unter.txt")).unwrap();
        assert_eq!(read_file(&dir, "notiz.txt").unwrap(), b"hallo");
        assert!(read_file(&dir, "fehlt.txt").is_err());
        assert!(read_file(&dir, "unter.txt").is_err(), "Ordner sind keine Dateien");
        assert!(read_file(&dir, "../notiz.txt").is_err());
        #[cfg(unix)]
        {
            let outside = temp_dir("outside");
            fs::write(outside.join("geheim.txt"), "geheim").unwrap();
            std::os::unix::fs::symlink(outside.join("geheim.txt"), dir.join("link.txt")).unwrap();
            assert!(read_file(&dir, "link.txt").is_err(), "Verknüpfungen nach außen sind gesperrt");
            assert!(list_files(&dir).unwrap().iter().all(|e| e.name != "link.txt"));
            let _ = fs::remove_dir_all(&outside);
        }
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn listing_shows_only_allowed_files() {
        let dir = temp_dir("list");
        fs::write(dir.join("a.txt"), "1").unwrap();
        fs::write(dir.join("b.xlsx"), "22").unwrap();
        fs::write(dir.join("programm.exe"), "x").unwrap();
        fs::create_dir_all(dir.join("ordner")).unwrap();
        let names: Vec<String> = list_files(&dir).unwrap().into_iter().map(|e| e.name).collect();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"a.txt".to_string()) && names.contains(&"b.xlsx".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn copy_names() {
        assert_eq!(copy_name("a.txt", 1), "a.txt");
        assert_eq!(copy_name("a.b.txt", 2), "a.b (2).txt");
    }
}
