/* NEXUS-Oberfläche: Morgenüberblick.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    let lastMorningOverviewDate = '';
    const weekdayNames = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    async function checkMorningOverview() {
      if (!desktopMode) return;
      try {
        const config = await desktopInvoke('load_automations');
        if (config.morningOverview !== true) return;
        const now = new Date(), day = String(now.getDay()), scheduledTime = config.morningSchedule?.[day];
        if (!scheduledTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) return;
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        if (config.lastMorningOverviewDate === today || lastMorningOverviewDate === today) return;
        const [hour, minute] = scheduledTime.split(':').map(Number);
        if (now.getHours()*60+now.getMinutes() < hour*60+minute) return;
        const tasks = await desktopInvoke('list_tasks');
        const openTasks = tasks.filter(task => !task.done);
        const dueToday = openTasks.filter(task => {
          if (!task.dueAt) return false;
          const due = new Date(task.dueAt);
          return due.getFullYear()===now.getFullYear() && due.getMonth()===now.getMonth() && due.getDate()===now.getDate();
        });
        const overdue = openTasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
        const summary = [`Guten Morgen. Hier ist dein Überblick für ${weekdayNames[now.getDay()]}, den ${now.toLocaleDateString('de-DE')}.`,
          `Offene Aufgaben: ${openTasks.length}.`, `Heute fällig: ${dueToday.length}.`, `Überfällig: ${overdue.length}.`];
        if (dueToday.length) summary.push('Heute: '+dueToday.map(t=>t.title).join('; ')+'.');
        if (overdue.length) summary.push('Überfällig: '+overdue.map(t=>t.title).join('; ')+'.');
        let todaysEvents = [];
        try { todaysEvents = NexusCalendar.onDay(await desktopInvoke('list_events'), now); } catch (_) { /* Kalender nicht lesbar */ }
        summary.push(`Termine heute: ${todaysEvents.length}.`);
        if (todaysEvents.length) summary.push('Termine: ' + todaysEvents.map(o => NexusCalendar.shortLine(o)).join('; ') + '.');
        // 1.2: Feiertag, Geburtstage der nächsten 7 Tage (aus dem Kalender) und Wetter für den Heimatort.
        const holiday = NexusTools.holidayOn(now, aiConfig.holidayState || '');
        if (holiday) summary.push('Heute ist Feiertag: ' + holiday.name + '.');
        try {
          const all = await desktopInvoke('list_events'), birthdays = [];
          for (let i = 0; i < 7; i++) {
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
            NexusCalendar.onDay(all, day).filter(o => /geburtstag/i.test(o.event.title)).forEach(o => birthdays.push((i === 0 ? 'heute' : weekdayNames[day.getDay()]) + ': ' + o.event.title));
          }
          if (birthdays.length) summary.push('Geburtstage diese Woche: ' + birthdays.join('; ') + '.');
        } catch (_) { /* Kalender nicht lesbar */ }
        const place = ((aiConfig.weather || {}).place || '').trim();
        if (place && weatherEnabled()) { try { summary.push(NexusTools.weatherSummary(await desktopInvoke('weather_forecast', {place})) + '.'); } catch (_) { summary.push('Wetter: derzeit nicht abrufbar.'); } }
        addMessage(summary.join(' '),'nexus');
        notifyNative('NEXUS Morgenüberblick', summary.slice(1).join(' '));
        statusText.textContent='Dein Morgenüberblick ist bereit.';
        lastMorningOverviewDate=today;
        config.lastMorningOverviewDate=today;
        await desktopInvoke('save_automations',{config});
      } catch (error) { console.warn('Morgenüberblick konnte nicht erstellt werden:',error); }
    }
    setInterval(checkMorningOverview,30000);
    setTimeout(checkMorningOverview,5000);
