// Kleine, reine Hilfsfunktionen für 1.2 (Persönlichkeit, Wetter-Ortsnamen, Werkzeug-Anweisungen).
// Nur Standardbibliothek, damit sie ohne Tauri getestet werden können:
//   rustc --edition 2021 --test src-tauri/src/extras.rs

/// Zusätzliche Stil-Anweisungen für den System-Prompt aus den Einstellungen „Persönlichkeit“.
pub fn persona_lines(address: &str, length: &str, butler: bool) -> String {
    let mut out = String::new();
    match address {
        "du" => out.push_str("\n- Sprich den Nutzer mit „du“ an."),
        "sie" => out.push_str("\n- Sprich den Nutzer mit „Sie“ an."),
        _ => {}
    }
    match length {
        "kurz" => out.push_str("\n- Antworte knapp: höchstens drei bis vier Sätze, außer der Nutzer bittet ausdrücklich um mehr."),
        "ausfuehrlich" => out.push_str("\n- Antworte ausführlich und gründlich, mit Erklärungen und Beispielen."),
        _ => {}
    }
    if !butler {
        out.push_str("\n- Verzichte auf den Butler-Ton (kein „Sehr wohl“, keine förmlichen Floskeln); sprich natürlich, freundlich und direkt.");
    }
    if out.is_empty() { out } else { format!("\n\nStil-Vorgaben des Nutzers (haben Vorrang vor dem Grundton oben):{out}") }
}

/// Ortsname für die Wettersuche: kurz, nur Buchstaben, Ziffern, Leerzeichen und wenige Satzzeichen.
pub fn check_place(raw: &str) -> Result<String, String> {
    let place: String = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    let count = place.chars().count();
    if count < 2 || count > 80 { return Err("Bitte einen Ortsnamen mit 2 bis 80 Zeichen angeben.".into()); }
    if !place.chars().all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '.' | '\'' | ',' | '(' | ')')) {
        return Err("Der Ortsname enthält unzulässige Zeichen.".into());
    }
    Ok(place)
}

pub fn check_coordinates(lat: f64, lon: f64) -> Result<(), String> {
    if lat.is_finite() && lon.is_finite() && (-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lon) { Ok(()) }
    else { Err("Ungültige Koordinaten.".into()) }
}

/// Anweisungen für die Werkzeuge Rechnen und Wetter (immer Teil des System-Prompts).
pub const TOOLS_PROMPT: &str = r###"

Rechnen: Für jede Rechnung mit konkreten Zahlen (Prozente, Summen, Zinsen, Einheiten, Tage zwischen Daten) nutzt du das Rechenwerkzeug, statt im Kopf zu rechnen. Schreibe dazu als EINZIGEN Inhalt deiner Antwort genau einen Block, zum Beispiel <nexus-calc>250 * 19%</nexus-calc> oder <nexus-calc>tage("2026-11-20"; "2026-12-24")</nexus-calc>. Erlaubt: Zahlen (Komma oder Punkt), + - * / ^, Klammern, % (Prozent), sqrt, round(x; n), abs, min, max, tage(von; bis). Du bekommst das Ergebnis und antwortest dann normal. Höchstens drei Rechnungen pro Frage.

Wetter: Wenn die Nachricht des Nutzers Wetterdaten zwischen <<<WETTER und WETTER>>> enthält, stammen sie von Open-Meteo. Nutze nur diese Werte, erfinde keine, und nenne am Ende kurz die Quelle „Wetterdaten: Open-Meteo.com“. Fehlen Wetterdaten, sage ehrlich, dass du das aktuelle Wetter nicht kennst."###;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persona() {
        assert_eq!(persona_lines("", "normal", true), "");
        let p = persona_lines("du", "kurz", false);
        assert!(p.contains("„du“") && p.contains("knapp") && p.contains("Butler-Ton"));
        assert!(persona_lines("sie", "ausfuehrlich", true).contains("ausführlich"));
        assert!(persona_lines("quatsch", "quatsch", true).is_empty());
    }

    #[test]
    fn places() {
        assert_eq!(check_place("  Bad   Homburg ").unwrap(), "Bad Homburg");
        assert_eq!(check_place("Frankfurt (Oder)").unwrap(), "Frankfurt (Oder)");
        assert!(check_place("München").is_ok());
        for bad in ["", "a", "Berlin&x=1", "Köln/../", "<script>", &"x".repeat(81)] { assert!(check_place(bad).is_err(), "{bad}"); }
    }

    #[test]
    fn coordinates() {
        assert!(check_coordinates(53.55, 9.99).is_ok());
        assert!(check_coordinates(91.0, 0.0).is_err());
        assert!(check_coordinates(f64::NAN, 0.0).is_err());
    }

    #[test]
    fn tools_prompt() { assert!(TOOLS_PROMPT.contains("<nexus-calc>") && TOOLS_PROMPT.contains("<<<WETTER")); }
}
