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
