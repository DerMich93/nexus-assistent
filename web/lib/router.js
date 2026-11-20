/* NEXUS Modell-Zentrale: waehlt pro Anfrage passende KIs aus (Aufgaben-Profile mit Rangliste), prueft die
   Datenschutz-Ampel und das Budget und erkennt, wann zum naechsten Modell gewechselt werden darf.
   Reine Logik ohne Oberflaeche, damit sie getestet werden kann. */
(function (root) {
  'use strict';
  const PROVIDERS = {
    groq:       { label: 'Groq',          model: 'llama-3.3-70b-versatile', paid: false },
    mistral:    { label: 'Mistral',       model: 'mistral-small-latest',    paid: false },
    google:     { label: 'Google Gemini', model: 'gemini-3.8-flash',        paid: false },
    openrouter: { label: 'OpenRouter',    model: 'openrouter/free',         paid: false },
    ollama:     { label: 'Lokal (Ollama)',model: 'qwen2.5:3b',              paid: false, local: true },
    anthropic:  { label: 'Claude',        model: 'claude-haiku-5-5',        paid: true },
    openai:     { label: 'OpenAI',        model: 'gpt-5.4-mini',            paid: true }
  };
  const PROFILES = {
    general:   { label: 'Allgemein',             order: 'groq, mistral, google, anthropic, openai, ollama' },
    documents: { label: 'Dokumente/lange Texte', order: 'mistral:mistral-large-latest, groq, google, anthropic, openai, ollama' },
    code:      { label: 'Code & Formeln',        order: 'mistral:codestral-latest, groq, anthropic, openai, ollama' },
    research:  { label: 'Recherche',             order: 'groq, mistral, anthropic, openai, ollama' }
  };
  const ALIASES = { groq: 'groq', mistral: 'mistral', gemini: 'google', google: 'google', openrouter: 'openrouter', lokal: 'ollama', local: 'ollama',
    ollama: 'ollama', claude: 'anthropic', anthropic: 'anthropic', openai: 'openai', gpt: 'openai', chatgpt: 'openai' };
  const MAX_ATTEMPTS = 4;
  // Grobe Preise in Euro pro 1 Mio. Tokens (Ein- und Ausgabe gemittelt), nur fuer die Budget-Schaetzung.
  const PRICE_PER_MTOK = { anthropic: 6, openai: 3 };

  function defaults() {
    const providers = {};
    for (const [id, p] of Object.entries(PROVIDERS)) providers[id] = { enabled: !p.paid && id !== 'openrouter', model: p.model };
    const profiles = {}; for (const [id, p] of Object.entries(PROFILES)) profiles[id] = p.order;
    return { enabled: false, providers, profiles, mistralNoTraining: false, googleBilling: false, budgetEur: 0 };
  }
  function settings(cfg) {
    const d = defaults(), r = (cfg && cfg.router) || {};
    const providers = {};
    for (const id of Object.keys(PROVIDERS)) providers[id] = Object.assign({}, d.providers[id], (r.providers || {})[id] || {});
    return Object.assign(d, r, { providers, profiles: Object.assign({}, d.profiles, r.profiles || {}), budgetEur: Math.max(0, Number(r.budgetEur) || 0) });
  }

  // Datenschutz-Ampel: green = kein Training laut Anbieter (bzw. lokal), yellow = kann trainieren.
  function light(id, r) {
    if (id === 'ollama' || id === 'groq' || id === 'anthropic' || id === 'openai') return 'green';
    if (id === 'mistral') return r.mistralNoTraining ? 'green' : 'yellow';
    if (id === 'google') return r.googleBilling ? 'green' : 'yellow';
    return 'yellow';
  }

  function parseOrder(text) {
    return String(text || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).map(entry => {
      const i = entry.indexOf(':'), alias = (i < 0 ? entry : entry.slice(0, i)).trim().toLowerCase();
      const id = ALIASES[alias];
      return id ? { id, model: i < 0 ? '' : entry.slice(i + 1).trim() } : null;
    }).filter(Boolean);
  }

  // "@groq Frage" waehlt eine KI von Hand.
  function parseOverride(text) {
    const m = /^\s*@([a-zA-Z]+)\b[\s:,]*/.exec(String(text || ''));
    if (!m || !ALIASES[m[1].toLowerCase()]) return { id: null, text: String(text || '') };
    return { id: ALIASES[m[1].toLowerCase()], text: String(text).slice(m[0].length) || String(text) };
  }

  // Einfache, nachvollziehbare Regeln. Greift keine, gilt "Allgemein".
  function classify(text, opts) {
    const t = String(text || ''), o = opts || {};
    if (o.hasFile || t.length > 1500) return 'documents';
    if (/\b(formel|formeln|excel|tabelle\w*|sverweis|vba|makro|code|programm\w*|skript|script|python|javascript|typescript|html|css|sql|regex|funktion|bug|fehlermeldung|compiler)\b/i.test(t)) return 'code';
    if (/\b(aktuell\w*|neueste\w*|nachrichten|news|heute in den|recherch\w*|such\w* im internet|preis\w*|kostet|kurs\w*|öffnungszeit\w*|wer ist|was gibt es neues)\b/i.test(t)) return 'research';
    return 'general';
  }

  function spent(cfg, now) {
    const s = (cfg && cfg.routerSpend) || {}, month = monthKey(now);
    return s.month === month ? Math.max(0, Number(s.eur) || 0) : 0;
  }
  const monthKey = d => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  function estimateEur(id, inChars, outChars) { return ((inChars + outChars) / 4) / 1e6 * (PRICE_PER_MTOK[id] || 0); }
  function addSpend(cfg, id, inChars, outChars, now) {
    if (!PROVIDERS[id] || !PROVIDERS[id].paid) return cfg.routerSpend || {};
    return { month: monthKey(now), eur: Math.round((spent(cfg, now) + estimateEur(id, inChars, outChars)) * 10000) / 10000 };
  }

  /* Liefert die Kandidaten in Reihenfolge. Jeder Kandidat sagt, ob er private Daten bekommen darf
     (nur gruen) und warum andere uebersprungen wurden. */
  function plan(cfg, opts) {
    const r = settings(cfg), o = opts || {}, now = o.now || new Date();
    const profile = o.override ? null : (o.profile || 'general');
    const order = o.override ? [{ id: o.override, model: '' }] : parseOrder(r.profiles[profile] || PROFILES.general.order);
    const candidates = [], skipped = [], seen = new Set();
    for (const entry of order) {
      const p = PROVIDERS[entry.id], set = r.providers[entry.id];
      const model = entry.model || (set && set.model) || p.model;
      const key = entry.id + '|' + model;
      if (seen.has(key)) continue; seen.add(key);
      const lamp = light(entry.id, r);
      if (p.paid && spent(cfg, now) >= r.budgetEur) { skipped.push({ id: entry.id, reason: r.budgetEur > 0 ? 'Monatsbudget erreicht' : 'Budget 0 €' }); continue; }
      if (!o.override && !set.enabled) { skipped.push({ id: entry.id, reason: 'deaktiviert' }); continue; }
      if (entry.id === 'openrouter' && r.budgetEur <= 0 && !/:free$|^openrouter\/free$/.test(model)) { skipped.push({ id: entry.id, reason: 'kein Gratismodell' }); continue; }
      if (o.hasFile && lamp !== 'green') { skipped.push({ id: entry.id, reason: 'Datei nur an Anbieter ohne Training' }); continue; }
      candidates.push({ id: entry.id, label: p.label, model, light: lamp, local: !!p.local, privateOk: lamp === 'green' });
      if (candidates.length >= MAX_ATTEMPTS) break;
    }
    return { profile: profile || 'override', candidates, skipped };
  }

  // Darf nach diesem Fehler das naechste Modell versucht werden?
  function retryable(error) {
    const e = String(error || '');
    return /HTTP (408|409|425|429|5\d\d|401|403|404)\b/.test(e) || /nicht erreichbar|Kein API-Schlüssel|Schlüsselbund|timed out|timeout|Zeitüberschreitung|zuerst ein Modell|keine (lesbare )?Textantwort|connection|operation timed/i.test(e);
  }
  function reason(error) {
    const e = String(error || '');
    if (/HTTP 429/.test(e)) return 'Limit erreicht';
    if (/HTTP 40[13]/.test(e)) return 'Key ungültig';
    if (/HTTP 404/.test(e)) return 'Modell nicht gefunden';
    if (/HTTP 5\d\d/.test(e)) return 'Serverfehler';
    if (/Kein API-Schlüssel/.test(e)) return 'kein Key';
    if (/timed out|timeout|Zeitüberschreitung/i.test(e)) return 'Zeitüberschreitung';
    if (/nicht erreichbar|connection/i.test(e)) return 'nicht erreichbar';
    return 'Fehler';
  }
  // Zeile unter der Antwort: "via Groq · llama-3.3 (Ersatz: Mistral – Limit erreicht)"
  const VIA_PREFIX = '⚙ via ';
  function viaLine(candidate, failures) {
    let line = VIA_PREFIX + candidate.label + ' · ' + candidate.model;
    if (failures && failures.length) line += ' (Ersatz: ' + failures.map(f => f.label + ' – ' + f.reason).join(', ') + ')';
    return line;
  }
  const stripVia = text => String(text).replace(/\n\n⚙ via [^\n]*$/, '');

  const api = { PROVIDERS, PROFILES, MAX_ATTEMPTS, defaults, settings, light, parseOrder, parseOverride, classify, plan, retryable, reason,
    viaLine, stripVia, VIA_PREFIX, spent, addSpend, estimateEur, monthKey };
  root.NexusRouter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
