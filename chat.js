/* NEXUS-Oberfläche: Chat: Senden, Aktionskarten, Internet, Vorlesen.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    // ---- Chat, Sprachausgabe und Spracheingabe -------------------------------------------------
    let isSpeaking = false, busy = false, voiceEnabled = false, speakEnabled = false;
    const GREETING = 'Guten Tag. Ich bin Nexus. Wie darf ich Ihnen behilflich sein?';
    const speakButton = document.getElementById('speakButton');
    const voiceButton = document.getElementById('voiceButton');
    try { speakEnabled = localStorage.getItem('nexus.speak') === '1'; } catch (_) {}

    function idleState() {
      orbState = voiceEnabled ? 'listening' : 'idle';
      statusText.textContent = voiceEnabled ? 'Sprachsteuerung aktiv' : 'System bereit';
    }
    function renderSpeakButton() {
      speakButton.classList.toggle('active', speakEnabled);
      speakButton.textContent = speakEnabled ? 'Vorlesen: AN' : 'Vorlesen: AUS';
      speakButton.setAttribute('aria-pressed', String(speakEnabled));
    }
    function setSpeakEnabled(enabled) {
      speakEnabled = enabled;
      try { localStorage.setItem('nexus.speak', enabled ? '1' : '0'); } catch (_) {}
      if (!enabled && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); isSpeaking = false; if (orbState === 'speaking') idleState(); }
      renderSpeakButton();
    }
    function speakText(text) {
      if (!('speechSynthesis' in window)) { idleState(); return; }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE'; utterance.pitch = .9; utterance.rate = 1;
      const finish = () => { isSpeaking = false; if (orbState === 'speaking') idleState(); };
      utterance.onend = finish; utterance.onerror = finish;
      isSpeaking = true;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
    }
    speakButton.addEventListener('click', () => setSpeakEnabled(!speakEnabled));
    renderSpeakButton();

    // Nur der Chat-Verlauf, der dem Modell wirklich etwas nützt: keine Begrüßung, keine automatischen Hinweise.
    function contextMessages() {
      const skip = [/^Guten Tag\. Ich bin Nexus\./, /^Erinnerung: /, /^Überfällige Erinnerung: /, /^Termin (in \d+ Min\.|beginnt jetzt): /, /^Heute ganztägig: /, /^Guten Morgen\. Hier ist dein Überblick/, /^Es tut mir leid\. Die KI-Anfrage/, /^Sehr wohl\. Bitte richten Sie/, /^Die KI-Anbindung ist nur/];
      return currentMessages
        .filter(m => (m.sender === 'user' || m.sender === 'nexus') && m.text && !(m.sender === 'nexus' && skip.some(rx => rx.test(m.text))))
        .map(m => ({role: m.sender === 'user' ? 'user' : 'assistant', content: m.text}));
    }
    function taskForContext(task) {
      let line = task.title || '';
      if (task.dueAt) { const d = new Date(task.dueAt); if (!Number.isNaN(d.getTime())) line += ' (fällig: ' + d.toLocaleString('de-DE') + ')'; }
      const repeat = {daily:'täglich', weekly:'wöchentlich', monthly:'monatlich'}[task.recurrence?.type];
      if (repeat) line += ' [' + repeat + ']';
      return line;
    }
    function startNewConversation() {
      if (busy) { statusText.textContent = 'Bitte warten, bis die Antwort da ist.'; return; }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      isSpeaking = false;
      currentConversationId = null;
      currentMessages = [{sender: 'nexus', text: GREETING}];
      const box = document.getElementById('chatBox'); box.innerHTML = '';
      addMessage(GREETING, 'nexus', false);
      orbState = voiceEnabled ? 'listening' : 'idle';
      statusText.textContent = 'Neues Gespräch begonnen';
      document.getElementById('userInput').focus();
    }
    document.getElementById('newChatButton').addEventListener('click', startNewConversation);

    // Vorschlag des Assistenten als Karte. Gespeichert wird nur nach ausdruecklicher Bestaetigung.
    function renderActionCard(action) {
      const box = document.getElementById('chatBox');
      const card = document.createElement('div'); card.className = 'action-card';
      const title = document.createElement('div'); title.className = 'action-title';
      title.textContent = action.type === 'remember' ? 'Vorschlag: im Gedächtnis speichern' : (action.type === 'create_event' ? 'Vorschlag: Termin in den Kalender eintragen' : 'Vorschlag: Aufgabe anlegen');
      const body = document.createElement('div'); body.className = 'action-body'; body.textContent = NexusActions.describe(action);
      card.append(title, body);
      action.warnings.forEach(w => { const el = document.createElement('div'); el.className = 'action-warning'; el.textContent = w; card.appendChild(el); });
      const row = document.createElement('div'); row.className = 'action-buttons';
      const confirmButton = document.createElement('button'); confirmButton.className = 'btn'; confirmButton.type = 'button'; confirmButton.textContent = 'Bestätigen';
      const discardButton = document.createElement('button'); discardButton.className = 'btn secondary'; discardButton.type = 'button'; discardButton.textContent = 'Verwerfen';
      row.append(confirmButton, discardButton); card.appendChild(row); box.appendChild(card); box.scrollTop = box.scrollHeight;
      discardButton.addEventListener('click', () => card.remove());
      confirmButton.addEventListener('click', async () => {
        confirmButton.disabled = true; discardButton.disabled = true;
        try {
          const call = NexusActions.toInvoke(action);
          const result = await desktopInvoke(call.cmd, call.args);
          if (call.cmd === 'save_task') { taskItems = result; renderTasks(); }
          else if (call.cmd === 'save_event') { calendarEvents = result; if (calendarModal.classList.contains('open')) renderCalendar(); }
          else { memoryItems = result; renderMemories(); }
          card.remove();
          addMessage('\u2714 Gespeichert \u2013 ' + NexusActions.describe(action), 'nexus'); await persistConversation();
        } catch (error) {
          confirmButton.disabled = false; discardButton.disabled = false;
          const el = document.createElement('div'); el.className = 'action-warning'; el.textContent = 'Speichern fehlgeschlagen: ' + String(error); card.appendChild(el);
        }
      });
    }

    // Internetzugriff nur mit Freigabe; bei Cloud-KI zusaetzlich mit eigener Freigabe.
    function webAllowed(cfg) { return cfg.webSearch === true && (isLocalProvider(cfg) || cfg.webWithCloud === true); }
    // Fuehrt eine Internetanfrage des Modells aus und liefert den (fremden) Text fuer das Modell zurueck.
    async function runWebRequest(request) {
      orbState = 'processing'; statusText.textContent = 'Ich recherchiere im Internet ...';
      try {
        if (request.type === 'search') {
          addMessage('\uD83D\uDD0E Ich suche im Internet nach: \u201E' + request.query + '\u201C', 'nexus', false);
          const found = await desktopInvoke('web_search', {query: request.query});
          return {body: NexusWeb.formatSearch(request.query, found.results), urls: (found.results || []).slice(0, 3).map(r => r.url)};
        }
        addMessage('\uD83D\uDD0E Ich lese die Seite: ' + NexusWeb.hostOf(request.url), 'nexus', false);
        const page = await desktopInvoke('web_read', {url: request.url});
        return {body: NexusWeb.formatPage(page.url, page.text), urls: [page.url]};
      } catch (error) {
        return {body: 'Die Internetabfrage ist fehlgeschlagen: ' + NexusWeb.sanitize(String(error), 300), urls: []};
      }
    }

    async function sendMessage() {
      const input = document.getElementById('userInput'), value = input.value.trim();
      if (!value || busy) return;
      busy = true;
      const sendButton = document.getElementById('sendButton');
      sendButton.disabled = true;
      addMessage(value, 'user'); await persistConversation(); input.value = '';
      orbState = 'processing'; statusText.textContent = 'NEXUS denkt nach ...';
      try {
        let reply, webRounds = 0;
        const webSources = [];
        if (!aiConfig.provider) {
          reply = 'Sehr wohl. Bitte richten Sie zunächst unter „KI-Verwaltung“ einen KI-Anbieter ein.';
        } else if (!desktopMode) {
          reply = 'Die KI-Anbindung ist nur in der installierten Windows-Desktop-App verfügbar. In der Browser-Vorschau kann ich nicht antworten.';
        } else {
          // Lokale KI (Daten bleiben auf dem PC) erhält Erinnerungen und Aufgaben immer;
          // Cloud-Anbieter nur nach ausdrücklicher Freigabe in der KI-Verwaltung.
          const local = isLocalProvider(aiConfig);
          const memories = (local || aiConfig.shareMemoriesWithCloud) ? (await desktopInvoke('list_memories')).map(m => m.text) : [];
          const tasks = (local || aiConfig.shareTasksWithCloud) ? (await desktopInvoke('list_tasks')).filter(t => !t.done).map(taskForContext) : [];
          const events = (local || aiConfig.shareCalendarWithCloud) ? await upcomingEventLines().catch(() => []) : [];
          const webOn = webAllowed(aiConfig);
          const base = {
            provider: aiConfig.provider,
            model: effectiveModel(aiConfig),
            baseUrl: baseUrlFor(aiConfig),
            memories, tasks, events, webEnabled: webOn,
            now: new Date().toLocaleString('de-DE', {weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'})
          };
          let messages = contextMessages();
          reply = await desktopInvoke('ai_chat', {...base, messages});
          // Internetanfragen des Modells: hoechstens 2 pro Frage. Der Webtext bleibt nur in dieser einen Anfrage und
          // wird nicht im Gespraechsverlauf gespeichert.
          while (webOn && webRounds < NexusWeb.MAX_ROUNDS) {
            const request = NexusWeb.parseRequest(reply);
            if (!request) break;
            webRounds++;
            const outcome = await runWebRequest(request);
            webSources.push(...outcome.urls);
            messages = [...messages, {role: 'assistant', content: NexusWeb.requestText(request)}, {role: 'user', content: NexusWeb.wrapResults(outcome.body, webRounds >= NexusWeb.MAX_ROUNDS)}];
            reply = await desktopInvoke('ai_chat', {...base, messages});
          }
        }
        // Waren Internetinhalte im Spiel, entstehen daraus nie Aktionen (Schutz vor eingeschleusten Anweisungen).
        const parsed = NexusActions.extract(NexusWeb.strip(reply));
        const fromWeb = webRounds > 0;
        const actions = fromWeb ? [] : parsed.actions;
        let shown = parsed.text || (actions.length ? 'Ich habe einen Vorschlag vorbereitet. Bitte bestätigen Sie ihn unten.' : 'Dazu konnte ich leider keine Antwort formulieren.');
        if (fromWeb && parsed.actions.length) shown += '\n\nHinweis: Aus Internetinhalten lege ich nichts automatisch an. Bitte wiederhole diese Bitte ohne Recherche.';
        const sourceLine = fromWeb ? NexusWeb.sourcesLine(webSources) : '';
        addMessage(sourceLine ? shown + '\n\n' + sourceLine : shown, 'nexus'); await persistConversation();
        actions.forEach(renderActionCard);
        if (speakEnabled) { orbState = 'speaking'; statusText.textContent = 'NEXUS spricht ...'; speakText(shown); }
        else idleState();
      } catch (error) {
        const message = 'Es tut mir leid. Die KI-Anfrage ist fehlgeschlagen: ' + String(error);
        orbState = 'idle'; statusText.textContent = 'KI-Verbindung prüfen';
        addMessage(message, 'nexus'); await persistConversation();
      } finally {
        busy = false;
        sendButton.disabled = false;
      }
    }
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('userInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
