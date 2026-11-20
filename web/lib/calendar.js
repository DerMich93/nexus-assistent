/* NEXUS Kalender: Termine, Wiederholungen, .ics-Import/-Export, Formular-Umwandlung und Anzeigehilfen.
   Reine Logik ohne Oberflaeche, in Node testbar (tests/unit.test.cjs).
   Datenmodell eines Termins:
   { id, uid, title, allDay, start, end, location, notes, recurrence }
   - Zeitgebundene Termine: start/end als UTC-ISO-Zeit ("2026-11-10T08:00:00.000Z").
   - Ganztaegige Termine: start/end als lokales Datum "JJJJ-MM-TT"; end ist INKLUSIV (letzter Tag).
   - recurrence: null oder { type: daily|weekly|monthly|yearly, interval: 1..99, until: "JJJJ-MM-TT"|null } */
(function (root) {
  'use strict';
  const DAY_MS = 86400000, MAX_EVENTS = 5000, GUARD = 20000;
  const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const REPEAT_LABEL = { daily: 't\u00E4glich', weekly: 'w\u00F6chentlich', monthly: 'monatlich', yearly: 'j\u00E4hrlich' };
  const WINDOWS_ZONES = {
    'W. Europe Standard Time': 'Europe/Berlin', 'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
    'Romance Standard Time': 'Europe/Paris', 'GMT Standard Time': 'Europe/London', 'GTB Standard Time': 'Europe/Bucharest', 'FLE Standard Time': 'Europe/Kiev',
    'E. Europe Standard Time': 'Europe/Chisinau', 'Turkey Standard Time': 'Europe/Istanbul', 'Russian Standard Time': 'Europe/Moscow', 'UTC': 'UTC',
    'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver', 'Pacific Standard Time': 'America/Los_Angeles'
  };

  const pad = n => String(n).padStart(2, '0');
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDateKey(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s));
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  function parseTime(s) { const m = /^(\d{2}):(\d{2})$/.exec(String(s || '')); return m && +m[1] < 24 && +m[2] < 60 ? { h: +m[1], mi: +m[2] } : null; }
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());

  function eventStart(e) { return e.allDay ? parseDateKey(e.start) : new Date(e.start); }
  function eventEnd(e) { return e.allDay ? parseDateKey(e.end || e.start) : new Date(e.end || e.start); }

  // n-ter Beginn einer Wiederholung (Uhrzeit bleibt im Alltag stabil, auch ueber Zeitumstellungen).
  // null = dieses Datum existiert nicht (z. B. 31. in einem 30-Tage-Monat) und wird uebersprungen.
  function nthStart(s, type, interval, k) {
    const y = s.getFullYear(), m = s.getMonth(), d = s.getDate(), h = s.getHours(), mi = s.getMinutes(), se = s.getSeconds();
    if (type === 'daily') return new Date(y, m, d + k * interval, h, mi, se);
    if (type === 'weekly') return new Date(y, m, d + 7 * k * interval, h, mi, se);
    if (type === 'monthly') { const t = new Date(y, m + k * interval, d, h, mi, se); return t.getDate() === d ? t : null; }
    if (type === 'yearly') { const t = new Date(y + k * interval, m, d, h, mi, se); return t.getMonth() === m && t.getDate() === d ? t : null; }
    return undefined;
  }

  // Alle Vorkommen eines Termins, die den Zeitraum [from, to) beruehren.
  function occurrences(event, from, to) {
    const s = eventStart(event), e = eventEnd(event);
    if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
    const allDay = !!event.allDay;
    const spanDays = allDay ? Math.max(0, Math.round((startOfDay(e) - startOfDay(s)) / DAY_MS)) : 0;
    const durationMs = allDay ? 0 : Math.max(0, e - s);
    const make = start => ({ event, allDay, start, end: allDay ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + spanDays + 1) : new Date(start.getTime() + durationMs) });
    const touches = o => (o.end > o.start ? o.end : new Date(o.start.getTime() + 1)) > from && o.start < to;
    const r = event.recurrence;
    if (!r || !r.type) { const o = make(s); return touches(o) ? [o] : []; }
    const interval = Math.max(1, Math.min(99, parseInt(r.interval, 10) || 1));
    const until = r.until ? parseDateKey(r.until) : null;
    const untilEnd = until ? new Date(until.getFullYear(), until.getMonth(), until.getDate() + 1) : null;
    const out = [];
    let k = 0;
    const step = r.type === 'daily' ? interval : (r.type === 'weekly' ? 7 * interval : 0);
    if (step) {
      const back = Math.floor((startOfDay(from) - startOfDay(s)) / DAY_MS) - spanDays - Math.ceil(durationMs / DAY_MS) - 1;
      if (back > 0) k = Math.floor(back / step);
    }
    for (let guard = 0; guard < GUARD; guard++, k++) {
      const start = nthStart(s, r.type, interval, k);
      if (start === undefined) break;
      if (start === null) continue;
      if (start >= to || (untilEnd && start >= untilEnd)) break;
      const o = make(start);
      if (touches(o)) out.push(o);
    }
    return out;
  }

  function eventsBetween(events, from, to) {
    const out = [];
    for (const e of events || []) out.push(...occurrences(e, from, to));
    return out.sort((a, b) => (a.start - b.start) || String(a.event.title).localeCompare(String(b.event.title), 'de'));
  }
  function onDay(events, day) { const a = startOfDay(day); return eventsBetween(events, a, addDays(a, 1)); }

  // 42 Tage (6 Wochen), beginnend mit dem Montag der Woche, in der der Monat anfaengt.
  function monthGrid(year, month) {
    const first = new Date(year, month, 1), offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
  }

  const clock = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  function dayText(d) { return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function repeatText(r) { return r && REPEAT_LABEL[r.type] ? REPEAT_LABEL[r.type] + (r.interval > 1 ? ' (alle ' + r.interval + ')' : '') : ''; }
  function timeText(o) {
    if (o.allDay) {
      const last = new Date(o.end.getFullYear(), o.end.getMonth(), o.end.getDate() - 1);
      return 'ganzt\u00E4gig' + (dateKey(last) !== dateKey(o.start) ? ' bis ' + dayText(last) : '');
    }
    const sameDay = dateKey(o.start) === dateKey(o.end);
    if (o.end.getTime() === o.start.getTime()) return clock(o.start);
    return clock(o.start) + '\u2013' + (sameDay ? clock(o.end) : dayText(o.end) + ', ' + clock(o.end));
  }
  function shortLine(o) { return (o.allDay ? 'ganzt\u00E4gig' : clock(o.start)) + ' ' + o.event.title; }

  // Zeilen fuer den Kontext des Modells: Termine der naechsten Tage (auch gerade laufende).
  function contextLines(events, now, days) {
    return eventsBetween(events, now, new Date(now.getFullYear(), now.getMonth(), now.getDate() + (days || 14), 23, 59, 59)).slice(0, 40).map(o => {
      const e = o.event, rep = repeatText(e.recurrence);
      return String(e.title).replace(/\s+/g, ' ') + ' \u2013 ' + dayText(o.start) + ', ' + timeText(o) + (e.location ? ' \u2013 ' + String(e.location).replace(/\s+/g, ' ') : '') + (rep ? ' [' + rep + ']' : '');
    });
  }

  // ---------- Formular <-> Termin ----------
  function fromForm(f) {
    const title = String(f.title || '').trim();
    if (!title) return { ok: false, error: 'Bitte einen Titel eingeben.' };
    if (title.length > 180) return { ok: false, error: 'Der Titel ist zu lang (h\u00F6chstens 180 Zeichen).' };
    const startDay = parseDateKey(f.startDate);
    if (!startDay) return { ok: false, error: 'Bitte ein g\u00FCltiges Startdatum angeben.' };
    const endDay = f.endDate ? parseDateKey(f.endDate) : startDay;
    if (!endDay) return { ok: false, error: 'Das Enddatum ist ung\u00FCltig.' };
    let event;
    if (f.allDay) {
      if (endDay < startDay) return { ok: false, error: 'Das Ende liegt vor dem Beginn.' };
      event = { allDay: true, start: dateKey(startDay), end: dateKey(endDay) };
    } else {
      const st = parseTime(f.startTime);
      if (!st) return { ok: false, error: 'Bitte eine g\u00FCltige Startzeit angeben.' };
      const start = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), st.h, st.mi);
      let end;
      if (f.endTime) {
        const et = parseTime(f.endTime);
        if (!et) return { ok: false, error: 'Die Endzeit ist ung\u00FCltig.' };
        end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), et.h, et.mi);
      } else end = new Date(start.getTime() + 3600000);
      if (end < start) return { ok: false, error: 'Das Ende liegt vor dem Beginn.' };
      event = { allDay: false, start: start.toISOString(), end: end.toISOString() };
    }
    let recurrence = null;
    if (['daily', 'weekly', 'monthly', 'yearly'].includes(f.recurrence)) {
      let until = null;
      if (f.until) {
        const u = parseDateKey(f.until);
        if (!u) return { ok: false, error: 'Das Enddatum der Wiederholung ist ung\u00FCltig.' };
        if (u < startDay) return { ok: false, error: 'Die Wiederholung endet vor dem ersten Termin.' };
        until = dateKey(u);
      }
      recurrence = { type: f.recurrence, interval: Math.max(1, Math.min(99, parseInt(f.interval, 10) || 1)), until };
    }
    return { ok: true, event: Object.assign({ id: f.id || null, uid: f.uid || '', title, location: String(f.location || '').trim().slice(0, 200), notes: String(f.notes || '').trim().slice(0, 2000), recurrence }, event) };
  }
  function toForm(e) {
    const s = eventStart(e), en = eventEnd(e), r = e.recurrence;
    return {
      id: e.id || null, uid: e.uid || '', title: e.title || '', allDay: !!e.allDay,
      startDate: s ? dateKey(s) : '', startTime: !e.allDay && s ? clock(s) : '', endDate: en ? dateKey(en) : '', endTime: !e.allDay && en ? clock(en) : '',
      location: e.location || '', notes: e.notes || '', recurrence: r && r.type ? r.type : 'none', interval: r && r.interval ? r.interval : 1, until: r && r.until ? r.until : ''
    };
  }

  // ---------- .ics Export ----------
  const utcStamp = d => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  const dateStamp = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const icsEscape = t => String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const icsUnescape = t => String(t).replace(/\\([nN;,\\])/g, (m, c) => (c === 'n' || c === 'N' ? '\n' : c));
  function fold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const parts = []; let cur = '', bytes = 0, limit = 75;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > limit) { parts.push(cur); cur = ''; bytes = 0; limit = 74; }
      cur += ch; bytes += b;
    }
    parts.push(cur);
    return parts.join('\r\n ');
  }
  function toICS(events, now) {
    const stamp = utcStamp(now || new Date());
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NEXUS//Kalender//DE', 'CALSCALE:GREGORIAN'];
    for (const e of events || []) {
      const s = eventStart(e), en = eventEnd(e);
      if (!s || !en || Number.isNaN(s.getTime()) || Number.isNaN(en.getTime())) continue;
      lines.push('BEGIN:VEVENT', 'UID:' + icsEscape(e.uid || (e.id + '@nexus.local')), 'DTSTAMP:' + stamp);
      if (e.allDay) lines.push('DTSTART;VALUE=DATE:' + dateStamp(s), 'DTEND;VALUE=DATE:' + dateStamp(addDays(en, 1)));
      else lines.push('DTSTART:' + utcStamp(s), 'DTEND:' + utcStamp(en));
      lines.push('SUMMARY:' + icsEscape(e.title));
      if (e.location) lines.push('LOCATION:' + icsEscape(e.location));
      if (e.notes) lines.push('DESCRIPTION:' + icsEscape(e.notes));
      const r = e.recurrence;
      if (r && r.type) {
        let rule = 'FREQ=' + r.type.toUpperCase() + (r.interval > 1 ? ';INTERVAL=' + r.interval : '');
        const u = r.until ? parseDateKey(r.until) : null;
        if (u) rule += ';UNTIL=' + (e.allDay ? dateStamp(u) : utcStamp(new Date(u.getFullYear(), u.getMonth(), u.getDate(), 23, 59, 59)));
        lines.push('RRULE:' + rule);
      }
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  // ---------- .ics Import ----------
  function tzOffsetMinutes(utcMs, tz) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {}; for (const part of f.formatToParts(new Date(utcMs))) p[part.type] = part.value;
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second);
    return (asUtc - Math.floor(utcMs / 1000) * 1000) / 60000;
  }
  function zonedToUtc(y, mo, d, h, mi, s, tz) {
    try {
      const guess = Date.UTC(y, mo - 1, d, h, mi, s);
      const off = tzOffsetMinutes(guess, tz);
      let t = guess - off * 60000;
      const off2 = tzOffsetMinutes(t, tz);
      if (off2 !== off) t = guess - off2 * 60000;
      return new Date(t);
    } catch (_) { return null; }
  }
  function parseIcsDate(value, params, stats) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(value).trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (m[4] === undefined) { const day = parseDateKey(m[1] + '-' + m[2] + '-' + m[3]); return day ? { allDay: true, day } : null; }
    const h = +m[4], mi = +m[5], s = +(m[6] || 0);
    let date;
    if (m[7]) date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
    else if (params.TZID) {
      const name = params.TZID.replace(/^"|"$/g, '');
      date = zonedToUtc(y, mo, d, h, mi, s, WINDOWS_ZONES[name] || name);
      if (!date) { stats.unknownZones++; date = new Date(y, mo - 1, d, h, mi, s); }
    } else date = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(date.getTime()) ? null : { allDay: false, date };
  }
  function parseDuration(v) {
    const m = /^(-)?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v).trim());
    if (!m || m[1]) return null;
    return (+(m[2] || 0) * 7 + +(m[3] || 0)) * DAY_MS + (+(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
  }
  function parseRRule(value, start) {
    const parts = {};
    String(value).split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) parts[p.slice(0, i).toUpperCase()] = p.slice(i + 1); });
    const type = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' }[String(parts.FREQ || '').toUpperCase()];
    if (!type) return { recurrence: null, simplified: true };
    let simplified = !!(parts.BYSETPOS || parts.BYYEARDAY || parts.BYWEEKNO || parts.BYHOUR || parts.BYMINUTE || parts.BYSECOND);
    const interval = Math.max(1, Math.min(99, parseInt(parts.INTERVAL || '1', 10) || 1));
    if (parts.BYDAY) { const days = parts.BYDAY.split(','); if (type !== 'weekly' || days.length !== 1 || days[0].toUpperCase() !== ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][start.getDay()]) simplified = true; }
    if (parts.BYMONTHDAY && !((type === 'monthly' || type === 'yearly') && parseInt(parts.BYMONTHDAY, 10) === start.getDate())) simplified = true;
    if (parts.BYMONTH && !(type === 'yearly' && parseInt(parts.BYMONTH, 10) === start.getMonth() + 1)) simplified = true;
    let until = null;
    if (parts.UNTIL) {
      const u = parseIcsDate(parts.UNTIL, {}, { unknownZones: 0 });
      if (u) until = dateKey(u.allDay ? u.day : u.date);
    } else if (parts.COUNT) {
      const n = parseInt(parts.COUNT, 10);
      if (n >= 1 && n <= 5000) {
        let counted = 0, last = null;
        for (let k = 0; k < GUARD && counted < n; k++) { const t = nthStart(start, type, interval, k); if (t) { counted++; last = t; } }
        if (last) until = dateKey(last);
      }
    }
    return { recurrence: { type, interval, until }, simplified };
  }

  // Liest eine .ics-Datei. Gibt { events, stats } zurueck; nicht abbildbare Teile werden gezaehlt, nicht still verschluckt.
  function parseICS(text) {
    const stats = { total: 0, imported: 0, cancelled: 0, overrides: 0, simplified: 0, exceptions: 0, unknownZones: 0, truncated: false };
    const lines = String(text == null ? '' : text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    const events = [];
    let cur = null, alarmDepth = 0;
    for (const line of lines) {
      if (/^BEGIN:VEVENT$/i.test(line)) { cur = []; alarmDepth = 0; continue; }
      if (!cur) continue;
      if (/^BEGIN:VALARM$/i.test(line)) { alarmDepth++; continue; }
      if (/^END:VALARM$/i.test(line)) { alarmDepth = Math.max(0, alarmDepth - 1); continue; }
      if (/^END:VEVENT$/i.test(line)) {
        stats.total++;
        const ev = buildEvent(cur, stats);
        cur = null;
        if (!ev) continue;
        if (events.length >= MAX_EVENTS) { stats.truncated = true; continue; }
        events.push(ev); stats.imported++;
        continue;
      }
      if (alarmDepth > 0) continue;
      const m = /^([A-Za-z0-9-]+)((?:;(?:"[^"]*"|[^:;"])*)*):(.*)$/.exec(line);
      if (!m) continue;
      const params = {};
      m[2].replace(/;([A-Za-z0-9-]+)=("[^"]*"|[^;]*)/g, (_, k, v) => { params[k.toUpperCase()] = v; return ''; });
      cur.push({ name: m[1].toUpperCase(), params, value: m[3] });
    }
    return { events, stats };
  }
  function buildEvent(props, stats) {
    const get = n => props.find(p => p.name === n);
    if (get('RECURRENCE-ID')) { stats.overrides++; return null; }
    const status = get('STATUS');
    if (status && /^CANCELLED$/i.test(status.value.trim())) { stats.cancelled++; return null; }
    const ds = get('DTSTART');
    if (!ds) return null;
    const start = parseIcsDate(ds.value, ds.params, stats);
    if (!start) return null;
    const allDay = start.allDay;
    const de = get('DTEND'), dur = get('DURATION');
    let end = null;
    if (de) end = parseIcsDate(de.value, de.params, stats);
    else if (dur) { const ms = parseDuration(dur.value); if (ms != null) end = allDay ? { allDay: true, day: new Date(start.day.getFullYear(), start.day.getMonth(), start.day.getDate() + Math.round(ms / DAY_MS)) } : { allDay: false, date: new Date(start.date.getTime() + ms) }; }
    let startIso, endIso, startLocal;
    if (allDay) {
      let last = end && end.allDay ? new Date(end.day.getFullYear(), end.day.getMonth(), end.day.getDate() - 1) : start.day;
      if (last < start.day) last = start.day;
      startIso = dateKey(start.day); endIso = dateKey(last); startLocal = start.day;
    } else {
      let endDate = end ? (end.allDay ? end.day : end.date) : start.date;
      if (endDate < start.date) endDate = start.date;
      startIso = start.date.toISOString(); endIso = endDate.toISOString(); startLocal = start.date;
    }
    let recurrence = null;
    const rr = get('RRULE');
    if (rr) { const parsed = parseRRule(rr.value, startLocal); recurrence = parsed.recurrence; if (parsed.simplified) stats.simplified++; }
    if (get('EXDATE')) stats.exceptions++;
    const text = n => { const p = get(n); return p ? icsUnescape(p.value).trim() : ''; };
    return {
      uid: text('UID').slice(0, 200), title: (text('SUMMARY') || '(ohne Titel)').slice(0, 180), allDay,
      start: startIso, end: endIso, location: text('LOCATION').slice(0, 200), notes: text('DESCRIPTION').slice(0, 2000), recurrence
    };
  }

  // Menschenlesbare Zusammenfassung eines Imports.
  function importSummary(stats, result) {
    const parts = [(result && result.added != null ? result.added : stats.imported) + ' Termin(e) importiert'];
    if (result && result.skipped) parts.push(result.skipped + ' schon vorhanden (\u00FCbersprungen)');
    if (stats.cancelled) parts.push(stats.cancelled + ' abgesagte ausgelassen');
    if (stats.overrides) parts.push(stats.overrides + ' Einzel\u00E4nderungen an Serien ausgelassen');
    if (stats.simplified) parts.push(stats.simplified + ' Serie(n) vereinfacht (komplexe Regeln werden nur teilweise abgebildet)');
    if (stats.exceptions) parts.push(stats.exceptions + ' Serie(n) mit Ausnahmetagen (die Ausnahmen fehlen)');
    if (stats.unknownZones) parts.push('unbekannte Zeitzone bei ' + stats.unknownZones + ' Zeitangabe(n), lokale Zeit angenommen');
    if (stats.truncated || (result && result.invalid)) parts.push('einige Termine konnten nicht \u00FCbernommen werden');
    return parts.join('; ') + '.';
  }

  const api = { occurrences, eventsBetween, onDay, monthGrid, nthStart, contextLines, fromForm, toForm, toICS, parseICS, importSummary, dateKey, parseDateKey, startOfDay, addDays, timeText, shortLine, dayText, repeatText, clock, WEEKDAYS, MAX_EVENTS };
  root.NexusCalendar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
