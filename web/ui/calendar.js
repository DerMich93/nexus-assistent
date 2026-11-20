/* NEXUS-Oberfläche: Kalender-Fenster und Termin-Erinnerungen.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    // Lokaler Morgenüberblick: nur nach Freigabe, nur bei laufender Desktop-App.
    // ---- Kalender ------------------------------------------------------------------------------------
    const calendarModal = document.getElementById('calendarModal');
    let calendarEvents = [], calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1), calSelected = new Date(), calEditing = null, calEditingUid = '';
    const calEl = id => document.getElementById(id);
    function calStatus(message) { calEl('calStatus').textContent = message || ''; }

    function renderCalendar() {
      const grid = calEl('calGrid'); grid.innerHTML = '';
      calEl('calMonthLabel').textContent = calMonth.toLocaleDateString('de-DE', {month: 'long', year: 'numeric'});
      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach(name => { const head = document.createElement('div'); head.className = 'cal-head'; head.textContent = name; grid.appendChild(head); });
      const cells = NexusCalendar.monthGrid(calMonth.getFullYear(), calMonth.getMonth());
      const occurrences = NexusCalendar.eventsBetween(calendarEvents, cells[0], NexusCalendar.addDays(cells[41], 1));
      const todayKey = NexusCalendar.dateKey(new Date()), selectedKey = NexusCalendar.dateKey(calSelected);
      cells.forEach(day => {
        const key = NexusCalendar.dateKey(day), next = NexusCalendar.addDays(day, 1);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cal-cell' + (day.getMonth() !== calMonth.getMonth() ? ' other' : '') + (key === todayKey ? ' today' : '') + (key === selectedKey ? ' selected' : '');
        cell.dataset.day = key;
        const number = document.createElement('span'); number.className = 'cal-num'; number.textContent = String(day.getDate()); cell.appendChild(number);
        const here = occurrences.filter(o => o.start < next && (o.end > o.start ? o.end > day : o.start >= day));
        here.slice(0, 2).forEach(o => { const line = document.createElement('div'); line.className = 'cal-ev'; line.textContent = o.event.title; cell.appendChild(line); });
        if (here.length > 2) { const more = document.createElement('div'); more.className = 'cal-more'; more.textContent = '+' + (here.length - 2) + ' weitere'; cell.appendChild(more); }
        cell.addEventListener('click', () => {
          calSelected = new Date(day);
          if (day.getMonth() !== calMonth.getMonth()) calMonth = new Date(day.getFullYear(), day.getMonth(), 1);
          renderCalendar();
        });
        grid.appendChild(cell);
      });
      renderCalendarDay();
    }

    function renderCalendarDay() {
      const list = calEl('calDayList'); list.innerHTML = '';
      calEl('calDayLabel').textContent = NexusCalendar.dayText(calSelected);
      const occurrences = NexusCalendar.onDay(calendarEvents, calSelected);
      if (!occurrences.length) { const empty = document.createElement('div'); empty.className = 'memory-empty'; empty.textContent = 'Keine Termine an diesem Tag.'; list.appendChild(empty); return; }
      occurrences.forEach(o => {
        const card = document.createElement('div'); card.className = 'memory-item';
        const heading = document.createElement('strong'); heading.textContent = o.event.title; card.appendChild(heading);
        const repeat = NexusCalendar.repeatText(o.event.recurrence);
        const meta = document.createElement('div'); meta.style.opacity = '.75'; meta.style.marginTop = '4px';
        meta.textContent = NexusCalendar.timeText(o) + (o.event.location ? ' · ' + o.event.location : '') + (repeat ? ' · ' + repeat : ''); card.appendChild(meta);
        if (o.event.notes) { const notes = document.createElement('div'); notes.style.marginTop = '4px'; notes.textContent = o.event.notes; card.appendChild(notes); }
        const actions = document.createElement('div'); actions.className = 'memory-item-actions';
        const edit = document.createElement('button'); edit.className = 'btn secondary'; edit.type = 'button'; edit.textContent = 'Bearbeiten';
        edit.addEventListener('click', () => openCalendarEditor(o.event));
        actions.appendChild(edit); card.appendChild(actions); list.appendChild(card);
      });
    }

    function closeCalendarEditor() { calEditing = null; calEditingUid = ''; calEl('calEditor').hidden = true; }
    function syncAllDayFields() { calEl('calStartTime').hidden = calEl('calEndTime').hidden = calEl('calAllDay').checked; }
    function openCalendarEditor(event) {
      calEditing = event ? event.id : null; calEditingUid = event ? (event.uid || '') : '';
      const day = NexusCalendar.dateKey(calSelected);
      const f = event ? NexusCalendar.toForm(event) : {title: '', allDay: false, startDate: day, startTime: '09:00', endDate: day, endTime: '10:00', location: '', notes: '', recurrence: 'none', interval: 1, until: ''};
      calEl('calTitle').value = f.title; calEl('calAllDay').checked = f.allDay;
      calEl('calStartDate').value = f.startDate; calEl('calStartTime').value = f.startTime; calEl('calEndDate').value = f.endDate; calEl('calEndTime').value = f.endTime;
      calEl('calLocation').value = f.location; calEl('calNotes').value = f.notes; calEl('calRepeat').value = f.recurrence; calEl('calInterval').value = String(f.interval); calEl('calUntil').value = f.until;
      calEl('calDeleteButton').hidden = !event; calEl('calSeriesHint').hidden = !(event && event.recurrence);
      syncAllDayFields(); calEl('calEditor').hidden = false; calStatus('');
    }
    async function saveCalendarEditor() {
      const result = NexusCalendar.fromForm({
        id: calEditing, uid: calEditingUid, title: calEl('calTitle').value, allDay: calEl('calAllDay').checked,
        startDate: calEl('calStartDate').value, startTime: calEl('calStartTime').value, endDate: calEl('calEndDate').value, endTime: calEl('calEndTime').value,
        location: calEl('calLocation').value, notes: calEl('calNotes').value, recurrence: calEl('calRepeat').value, interval: calEl('calInterval').value, until: calEl('calUntil').value
      });
      if (!result.ok) { calStatus(result.error); return; }
      if (!desktopMode) { calStatus('Termine lassen sich nur in der Windows-Desktop-App speichern.'); return; }
      try {
        calendarEvents = await desktopInvoke('save_event', {event: result.event});
        const start = result.event.allDay ? NexusCalendar.parseDateKey(result.event.start) : new Date(result.event.start);
        calSelected = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        calMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        closeCalendarEditor(); renderCalendar(); calStatus('Termin gespeichert.');
      } catch (error) { calStatus('Speichern fehlgeschlagen: ' + String(error)); }
    }
    async function deleteCalendarEvent() {
      if (!calEditing) return;
      if (!window.confirm('Diesen Termin' + (calEl('calSeriesHint').hidden ? '' : ' samt allen Wiederholungen') + ' wirklich löschen?')) return;
      try { calendarEvents = await desktopInvoke('delete_event', {id: calEditing}); closeCalendarEditor(); renderCalendar(); calStatus('Termin gelöscht.'); }
      catch (error) { calStatus('Löschen fehlgeschlagen: ' + String(error)); }
    }
    async function openCalendar() {
      calendarModal.classList.add('open'); calStatus(''); closeCalendarEditor();
      if (!desktopMode) { calStatus('Der Kalender ist nur in der Windows-Desktop-App verfügbar.'); renderCalendar(); return; }
      try { calendarEvents = await desktopInvoke('list_events'); } catch (error) { calStatus('Kalender konnte nicht geladen werden: ' + String(error)); }
      renderCalendar();
    }
    async function importCalendarFile() {
      if (!desktopMode) { calStatus('Der Import ist nur in der Windows-Desktop-App verfügbar.'); return; }
      try {
        const text = await desktopInvoke('import_calendar_file');
        if (text == null) return;
        const parsed = NexusCalendar.parseICS(text);
        if (!parsed.events.length) { calStatus('In der Datei wurden keine Termine gefunden.' + (parsed.stats.total ? ' (' + parsed.stats.total + ' Einträge nicht lesbar oder abgesagt)' : '')); return; }
        const result = await desktopInvoke('import_events', {events: parsed.events});
        calendarEvents = result.events; renderCalendar();
        calStatus(NexusCalendar.importSummary(parsed.stats, result));
      } catch (error) { calStatus('Import fehlgeschlagen: ' + String(error)); }
    }
    async function exportCalendarFile() {
      if (!desktopMode) { calStatus('Der Export ist nur in der Windows-Desktop-App verfügbar.'); return; }
      if (!calendarEvents.length) { calStatus('Der Kalender ist leer, es gibt nichts zu exportieren.'); return; }
      try {
        const path = await desktopInvoke('export_calendar_file', {content: NexusCalendar.toICS(calendarEvents)});
        if (path) calStatus('Exportiert: ' + path + ' (' + calendarEvents.length + ' Termine).');
      } catch (error) { calStatus('Export fehlgeschlagen: ' + String(error)); }
    }
    document.getElementById('calendarButton').addEventListener('click', openCalendar);
    calEl('closeCalendarButton').addEventListener('click', () => calendarModal.classList.remove('open'));
    calEl('calPrev').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
    calEl('calNext').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });
    calEl('calToday').addEventListener('click', () => { calSelected = new Date(); calMonth = new Date(calSelected.getFullYear(), calSelected.getMonth(), 1); renderCalendar(); });
    calEl('calNewButton').addEventListener('click', () => openCalendarEditor(null));
    calEl('calCancelButton').addEventListener('click', () => { closeCalendarEditor(); calStatus(''); });
    calEl('calSaveButton').addEventListener('click', saveCalendarEditor);
    calEl('calDeleteButton').addEventListener('click', deleteCalendarEvent);
    calEl('calAllDay').addEventListener('change', syncAllDayFields);
    calEl('calImportButton').addEventListener('click', importCalendarFile);
    calEl('calExportButton').addEventListener('click', exportCalendarFile);

    // Erinnerungen vor Terminen: zeitgebundene Termine in der eingestellten Vorlaufzeit, ganztaegige einmal ab 8 Uhr.
    const notifiedEventOccurrences = new Set();
    async function checkDueEvents(now = new Date()) {
      if (!desktopMode) return;
      try {
        calendarEvents = await desktopInvoke('list_events');
        const lead = Number.isFinite(Number(aiConfig.eventLeadMinutes)) ? Math.max(0, Number(aiConfig.eventLeadMinutes)) : 15;
        const from = new Date(now.getTime() - 5 * 60000), to = new Date(now.getTime() + lead * 60000 + 1);
        const dayStart = NexusCalendar.startOfDay(now), dayEnd = NexusCalendar.addDays(dayStart, 1);
        const due = NexusCalendar.eventsBetween(calendarEvents, from, to).filter(o => !o.allDay && o.start >= from && o.start <= to).map(o => {
          const minutes = Math.round((o.start - now) / 60000);
          const where = o.event.location ? ', ' + o.event.location : '';
          return {key: o.event.id + ':' + o.start.getTime(), text: (minutes <= 0 ? 'Termin beginnt jetzt: ' : 'Termin in ' + minutes + ' Min.: ') + o.event.title + ' (' + NexusCalendar.clock(o.start) + where + ')'};
        });
        if (now.getHours() >= 8) NexusCalendar.eventsBetween(calendarEvents, dayStart, dayEnd).filter(o => o.allDay).forEach(o => due.push({key: o.event.id + ':allday:' + NexusCalendar.dateKey(now), text: 'Heute ganztägig: ' + o.event.title}));
        for (const item of due) {
          if (notifiedEventOccurrences.has(item.key)) continue;
          notifiedEventOccurrences.add(item.key);
          statusText.textContent = item.text; addMessage(item.text, 'nexus'); notifyNative('NEXUS Termin', item.text);
          if (calendarModal.classList.contains('open')) calStatus(item.text);
        }
      } catch (_) { /* z. B. Schluessel fehlt: dann meldet checkVault das Problem */ }
    }
    setInterval(() => checkDueEvents(), 30000);
    setTimeout(() => checkDueEvents(), 6000);
    async function upcomingEventLines() { return NexusCalendar.contextLines(await desktopInvoke('list_events'), new Date(), 14); }
