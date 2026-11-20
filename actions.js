/* NEXUS Chat-Aktionen: erkennt Vorschlaege des Modells (<nexus-action>{...}</nexus-action>), prueft sie streng
   und uebersetzt sie in die vorhandenen Befehle save_task / save_memory. Gespeichert wird erst nach Bestaetigung. */
(function (root) {
  'use strict';
  const MAX_ACTIONS = 5;
  const BLOCK_RE = /<nexus-action>([\s\S]*?)<\/nexus-action>/gi;
  const DANGLING_RE = /<nexus-action>[\s\S]*$/i;

  function parseDue(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    // Das Datum muss im Kalender existieren (JavaScript macht sonst aus dem 30. Februar still den 2. Maerz).
    const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (parts) { const check = new Date(+parts[1], +parts[2] - 1, +parts[3]); if (check.getMonth() !== +parts[2] - 1 || check.getDate() !== +parts[3]) return null; }
    const d = new Date(value.trim().replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    return (y < 2000 || y > 2100) ? null : d;
  }

  // "JJJJ-MM-TT" aus einer Datums- oder Datum-Uhrzeit-Angabe; null bei ungueltigem Datum.
  function dayOf(value) {
    if (typeof value !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3] || d.getFullYear() < 2000 || d.getFullYear() > 2100) return null;
    return m[1] + '-' + m[2] + '-' + m[3];
  }
  const localDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  // Termin fuer den Kalender. Zeitgebunden: UTC-Zeit; ganztaegig: Datum (Ende inklusiv) - wie im Kalender gespeichert.
  function normalizeEvent(raw, warnings) {
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 180) : '';
    if (!title) return null;
    const allDay = raw.allDay === true;
    let start, end, startDay;
    if (allDay) {
      startDay = dayOf(raw.start);
      if (!startDay) return null;
      const e = dayOf(raw.end);
      if (raw.end && (!e || e < startDay)) warnings.push('Das Ende war ung\u00FCltig und wurde auf den Starttag gesetzt.');
      start = startDay; end = e && e >= startDay ? e : startDay;
    } else {
      const s = parseDue(raw.start);
      if (!s) return null;
      let e = raw.end ? parseDue(raw.end) : null;
      if (raw.end && (!e || e < s)) { warnings.push('Das Ende war ung\u00FCltig; es gilt eine Dauer von einer Stunde.'); e = null; }
      if (!e) e = new Date(s.getTime() + 3600000);
      start = s.toISOString(); end = e.toISOString(); startDay = localDay(s);
    }
    let kind = typeof raw.recurrence === 'string' ? raw.recurrence : (raw.recurrence && raw.recurrence.type);
    kind = typeof kind === 'string' ? kind.trim().toLowerCase() : 'none';
    let recurrence = null;
    if (['daily', 'weekly', 'monthly', 'yearly'].includes(kind)) {
      let until = dayOf(raw.until);
      if (raw.until && (!until || until < startDay)) { warnings.push('Das Enddatum der Wiederholung war ung\u00FCltig und wurde weggelassen.'); until = null; }
      recurrence = { type: kind, interval: 1, until };
    }
    return {
      type: 'create_event', title, allDay, start, end, recurrence,
      location: typeof raw.location === 'string' ? raw.location.trim().slice(0, 200) : '',
      notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 2000) : '',
      warnings
    };
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const warnings = [];
    if (raw.type === 'remember') {
      const text = typeof raw.text === 'string' ? raw.text.trim() : '';
      if (!text) return null;
      return { type: 'remember', text: text.slice(0, 1200), warnings };
    }
    if (raw.type === 'create_event') return normalizeEvent(raw, warnings);
    if (raw.type !== 'create_task') return null;
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 180) : '';
    if (!title) return null;
    const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 1200) : '';
    const due = parseDue(raw.dueAt);
    if (raw.dueAt && !due) warnings.push('Das Datum war ungueltig und wurde weggelassen.');
    let kind = raw.recurrence && typeof raw.recurrence === 'object' ? raw.recurrence.type : raw.recurrence;
    kind = typeof kind === 'string' ? kind.trim().toLowerCase() : 'none';
    if (!['daily', 'weekly', 'monthly'].includes(kind)) kind = 'none';
    let recurrence = null;
    if (kind !== 'none') {
      if (!due) warnings.push('Die Wiederholung wurde ignoriert, weil der erste Termin fehlt.');
      else {
        let days = [];
        if (kind === 'weekly') {
          const list = Array.isArray(raw.weekdays) ? raw.weekdays : (raw.recurrence && Array.isArray(raw.recurrence.weekdays) ? raw.recurrence.weekdays : []);
          days = [...new Set(list.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
          if (!days.length) days = [due.getDay()];
        }
        recurrence = { type: kind, weekdays: days };
      }
    }
    return { type: 'create_task', title, notes, dueAt: due ? due.toISOString() : null, recurrence, warnings };
  }

  // Trennt Antworttext und Aktionsvorschlaege. Ungueltige Bloecke werden verworfen, aber ebenfalls aus dem Text entfernt.
  function extract(reply) {
    const source = String(reply == null ? '' : reply);
    const actions = [];
    let text = source.replace(BLOCK_RE, (_, body) => {
      if (actions.length < MAX_ACTIONS) {
        try { const a = normalize(JSON.parse(body.trim())); if (a) actions.push(a); } catch (_) { /* ungueltiges JSON: ignorieren */ }
      }
      return '';
    });
    text = text.replace(DANGLING_RE, '').replace(/```[a-z]*\s*```/gi, '').replace(/\n{3,}/g, '\n\n').trim();
    return { text, actions };
  }

  const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function describeEvent(a) {
    const day = d => d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const clock = d => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    let line = 'Termin: \u201E' + a.title + '\u201C \u2013 ';
    if (a.allDay) {
      const s = new Date(a.start + 'T00:00:00'), e = new Date(a.end + 'T00:00:00');
      line += day(s) + (a.end !== a.start ? ' bis ' + day(e) : '') + ' (ganzt\u00E4gig)';
    } else {
      const s = new Date(a.start), e = new Date(a.end);
      line += day(s) + ', ' + clock(s) + '\u2013' + (s.toDateString() === e.toDateString() ? clock(e) : day(e) + ', ' + clock(e));
    }
    if (a.location) line += ' \u2013 ' + a.location;
    if (a.recurrence) {
      line += ' \u2013 ' + { daily: 't\u00E4glich', weekly: 'w\u00F6chentlich', monthly: 'monatlich', yearly: 'j\u00E4hrlich' }[a.recurrence.type];
      if (a.recurrence.until) line += ' bis ' + day(new Date(a.recurrence.until + 'T00:00:00'));
    }
    return line;
  }

  function describe(a) {
    if (a.type === 'create_event') return describeEvent(a);
    if (a.type === 'remember') return 'Merken: \u201E' + a.text + '\u201C';
    let line = 'Aufgabe: \u201E' + a.title + '\u201C';
    if (a.dueAt) line += ' \u2013 f\u00E4llig ' + new Date(a.dueAt).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    else line += ' \u2013 ohne Termin';
    if (a.recurrence) {
      const label = { daily: 't\u00E4glich', weekly: 'w\u00F6chentlich', monthly: 'monatlich' }[a.recurrence.type];
      line += ' \u2013 ' + label + (a.recurrence.type === 'weekly' ? ' (' + a.recurrence.weekdays.map(d => DAY_NAMES[d]).join(', ') + ')' : '');
    }
    return line;
  }

  // Uebersetzt eine bestaetigte Aktion in den Backend-Aufruf.
  function toInvoke(a) {
    if (a.type === 'remember') return { cmd: 'save_memory', args: { id: null, text: a.text } };
    if (a.type === 'create_event') return { cmd: 'save_event', args: { event: { id: null, title: a.title, allDay: a.allDay, start: a.start, end: a.end, location: a.location, notes: a.notes, recurrence: a.recurrence } } };
    return { cmd: 'save_task', args: { id: null, title: a.title, notes: a.notes || '', dueAt: a.dueAt, recurrence: a.recurrence } };
  }

  const api = { extract, normalize, describe, toInvoke, MAX_ACTIONS };
  root.NexusActions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
