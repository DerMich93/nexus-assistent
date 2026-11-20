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
    function contextMessages(allowFiles) {
      const files = allowFiles === undefined ? filesAllowed(aiConfig) : allowFiles;
      const skip = [/^Guten Tag\. Ich bin Nexus\./, /^Erinnerung: /, /^Überfällige Erinnerung: /, /^Termin (in \d+ Min\.|beginnt jetzt): /, /^Heute ganztägig: /, /^Guten Morgen\. Hier ist dein Überblick/, /^Es tut mir leid\. Die KI-Anfrage/, /^Sehr wohl\. Bitte richten Sie/, /^Die KI-Anbindung ist nur/];
      return currentMessages
        .filter(m => (m.sender === 'user' || m.sender === 'nexus') && m.text && !(m.sender === 'nexus' && skip.some(rx => rx.test(m.text))))
        .map(m => ({role: m.sender === 'user' ? 'user' : 'assistant', content: m.sender === 'nexus' ? NexusRouter.stripVia(m.text) : fileContent(m, files)}));
    }
    // Angehängter Dateitext bleibt nur im laufenden Gespräch (nicht im gespeicherten Verlauf) und geht an
    // Cloud-KI nur, solange die Freigabe besteht.
    function fileContent(m, allowFiles) {
      if (!m.fileContext) return m.text;
      return m.text + '\n\n' + (allowFiles ? m.fileContext : '[Angehängte Datei nicht mitgeschickt: keine Freigabe für Cloud-KI.]');
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
      title.textContent = {remember: 'Vorschlag: im Gedächtnis speichern', create_event: 'Vorschlag: Termin in den Kalender eintragen', save_file: 'Vorschlag: Datei im Arbeitsordner speichern'}[action.type] || 'Vorschlag: Aufgabe anlegen';
      const body = document.createElement('div'); body.className = 'action-body'; body.textContent = NexusActions.describe(action);
      card.append(title, body);
      if (action.type === 'save_file') { const pre = document.createElement('pre'); pre.className = 'action-preview'; pre.textContent = NexusActions.filePreview(action); card.appendChild(pre); }
      action.warnings.forEach(w => { const el = document.createElement('div'); el.className = 'action-warning'; el.textContent = w; card.appendChild(el); });
      const row = document.createElement('div'); row.className = 'action-buttons';
      const confirmButton = document.createElement('button'); confirmButton.className = 'btn'; confirmButton.type = 'button'; confirmButton.textContent = 'Bestätigen';
      const discardButton = document.createElement('button'); discardButton.className = 'btn secondary'; discardButton.type = 'button'; discardButton.textContent = 'Verwerfen';
      row.append(confirmButton, discardButton); card.appendChild(row); box.appendChild(card); box.scrollTop = box.scrollHeight;
      const discard = () => { if (discardButton.disabled) return; confirmButton.disabled = true; discardButton.disabled = true; card.remove(); };
      discardButton.addEventListener('click', discard);
      card.nexusDiscard = discard;
      card.nexusConfirm = async () => {
        if (confirmButton.disabled) return;
        confirmButton.disabled = true; discardButton.disabled = true;
        try {
          if (action.type === 'save_file') {
            const bytes = await NexusOffice.build(action);
            const saved = await desktopInvoke('workspace_write', {name: action.name, data: Array.from(bytes)});
            card.remove();
            addMessage('\u2714 Gespeichert im Arbeitsordner: \u201E' + saved + '\u201C' + (saved !== action.name ? ' (eine Datei \u201E' + action.name + '\u201C gab es schon; sie bleibt unver\u00e4ndert)' : ''), 'nexus'); await persistConversation();
            if (filesModal.classList.contains('open')) refreshFiles();
            return;
          }
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
      };
      confirmButton.addEventListener('click', card.nexusConfirm);
      return card;
    }
    // Mehrere Vorschlaege auf einmal: "Alle bestaetigen" arbeitet die Karten nacheinander ab (jede wird einzeln geprueft).
    function renderBulkBar(cards) {
      const box = document.getElementById('chatBox');
      const bar = document.createElement('div'); bar.className = 'action-bulk';
      const all = document.createElement('button'); all.className = 'btn'; all.type = 'button'; all.textContent = 'Alle bestätigen (' + cards.length + ')';
      const none = document.createElement('button'); none.className = 'btn secondary'; none.type = 'button'; none.textContent = 'Alle verwerfen';
      bar.append(all, none); box.appendChild(bar); box.scrollTop = box.scrollHeight;
      all.addEventListener('click', async () => {
        all.disabled = true; none.disabled = true;
        for (const card of cards) await card.nexusConfirm(); // bereits verworfene oder gespeicherte Karten sind gesperrt
        bar.remove();
      });
      none.addEventListener('click', () => { cards.forEach(c => c.nexusDiscard()); bar.remove(); });
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
      const input = document.getElementById('userInput');
      const attachment = pendingAttachment;
      const value = input.value.trim() || (attachment ? 'Bitte sieh dir die angehängte Datei an.' : '');
      if (!value || busy) return;
      if (attachment && !filesAllowed(aiConfig)) { statusText.textContent = 'Datei nicht gesendet: Für Cloud-KI zuerst in der KI-Verwaltung erlauben.'; return; }
      busy = true;
      const sendButton = document.getElementById('sendButton');
      sendButton.disabled = true;
      addMessage(attachment ? value + '\n\uD83D\uDCCE ' + attachment.name : value, 'user');
      if (attachment) { currentMessages[currentMessages.length - 1].fileContext = NexusOffice.wrapForModel(attachment.name, attachment.info); clearAttachment(); }
      await persistConversation(); input.value = '';
      orbState = 'processing'; statusText.textContent = 'NEXUS denkt nach ...';
      try {
        let reply, webRounds = 0, used = null;
        const webSources = [], failures = [];
        if (!aiConfig.provider && !routerOn(aiConfig)) {
          reply = 'Sehr wohl. Bitte richten Sie zunächst unter „KI-Verwaltung“ einen KI-Anbieter ein.';
        } else if (!desktopMode) {
          reply = 'Die KI-Anbindung ist nur in der installierten Windows-Desktop-App verfügbar. In der Browser-Vorschau kann ich nicht antworten.';
        } else {
          const candidates = planCandidates(value, !!attachment);
          // Private Daten nur einmal lesen; pro KI wird dann entschieden, was sie bekommen darf.
          const anyLocal = candidates.some(c => c.local);
          const allMemories = (anyLocal || aiConfig.shareMemoriesWithCloud) ? (await desktopInvoke('list_memories')).map(m => m.text) : [];
          const allTasks = (anyLocal || aiConfig.shareTasksWithCloud) ? (await desktopInvoke('list_tasks')).filter(t => !t.done).map(taskForContext) : [];
          const allEvents = (anyLocal || aiConfig.shareCalendarWithCloud) ? await upcomingEventLines().catch(() => []) : [];
          const weatherBlock = await weatherBlockFor(value);
          const extra = [];
          const may = (c, flag) => c.local || (c.privateOk && aiConfig[flag] === true);
          const webFor = c => aiConfig.webSearch === true && (c.local || aiConfig.webWithCloud === true);
          const messagesFor = c => {
            const list = contextMessages(c.local || (c.privateOk && aiConfig.shareFilesWithCloud === true));
            if (weatherBlock && list.length) list[list.length - 1] = {...list[list.length - 1], content: list[list.length - 1].content + '\n\n' + weatherBlock};
            return [...list, ...extra];
          };
          const now = nowLine();
          let index = 0;
          // Fragt die KIs der Reihe nach; gewechselt wird nur bei Limit, Ausfall, fehlendem Key oder Zeitüberschreitung.
          const ask = async () => {
            for (;;) {
              const c = candidates[index];
              if (c.routed) statusText.textContent = 'NEXUS denkt nach … (' + c.label + ')';
              try {
                const answer = await desktopInvoke('ai_chat', {
                  provider: c.id, model: c.model, baseUrl: c.baseUrl,
                  memories: may(c, 'shareMemoriesWithCloud') ? allMemories : [], tasks: may(c, 'shareTasksWithCloud') ? allTasks : [],
                  events: may(c, 'shareCalendarWithCloud') ? allEvents : [], webEnabled: webFor(c), now, persona: aiConfig.persona || {},
                  fast: !!c.routed && index < candidates.length - 1, messages: messagesFor(c)
                });
                used = c; return answer;
              } catch (error) {
                if (!c.routed || index >= candidates.length - 1 || !NexusRouter.retryable(error)) {
                  throw failures.length ? new Error(String(error) + ' (vorher versucht: ' + failures.map(f => f.label + ' – ' + f.reason).join(', ') + ')') : error;
                }
                failures.push({label: c.label, reason: NexusRouter.reason(error)});
                index++;
              }
            }
          };
          reply = await ask();
          // Werkzeuge: Rechnen (höchstens 3) und Internet (höchstens 2). Ergebnisse bleiben nur in dieser Anfrage.
          let calcRounds = 0;
          for (let round = 0; round < 5; round++) {
            const calc = NexusTools.parseCalc(reply);
            if (calc !== null && calcRounds < 3) {
              calcRounds++;
              extra.push({role: 'assistant', content: '<nexus-calc>' + calc + '</nexus-calc>'}, {role: 'user', content: NexusTools.calcResultText(calc)});
              reply = await ask(); continue;
            }
            const request = webFor(used) && webRounds < NexusWeb.MAX_ROUNDS ? NexusWeb.parseRequest(reply) : null;
            if (!request) break;
            webRounds++;
            const outcome = await runWebRequest(request);
            webSources.push(...outcome.urls);
            extra.push({role: 'assistant', content: NexusWeb.requestText(request)}, {role: 'user', content: NexusWeb.wrapResults(outcome.body, webRounds >= NexusWeb.MAX_ROUNDS)});
            reply = await ask();
          }
          reply = NexusTools.stripCalc(reply);
          if (used && used.routed) await recordSpend(used, messagesFor(used), reply);
        }
        // Waren Internetinhalte im Spiel, entstehen daraus nie Aktionen (Schutz vor eingeschleusten Anweisungen).
        const parsed = NexusActions.extract(NexusWeb.strip(reply));
        const fromWeb = webRounds > 0;
        const actions = fromWeb ? [] : parsed.actions;
        let shown = parsed.text || (actions.length ? 'Ich habe einen Vorschlag vorbereitet. Bitte bestätigen Sie ihn unten.' : 'Dazu konnte ich leider keine Antwort formulieren.');
        if (fromWeb && parsed.actions.length) shown += '\n\nHinweis: Aus Internetinhalten lege ich nichts automatisch an. Bitte wiederhole diese Bitte ohne Recherche.';
        if (parsed.incomplete) shown += '\n\nHinweis: Mein Vorschlag wurde unvollständig übertragen (die Antwort war vermutlich zu lang) und wird deshalb nicht angezeigt. Bitte in kleineren Teilen versuchen.';
        const sourceLine = fromWeb ? NexusWeb.sourcesLine(webSources) : '';
        const viaLine = used && used.routed ? NexusRouter.viaLine(used, failures) : '';
        addMessage([shown, sourceLine, viaLine].filter(Boolean).join('\n\n'), 'nexus'); await persistConversation();
        const cards = actions.map(renderActionCard);
        if (cards.length >= 2) renderBulkBar(cards);
        if (speakEnabled) { orbState = 'speaking'; statusText.textContent = 'NEXUS spricht ...'; speakText(shown); }
        else idleState();
      } catch (error) {
        const message = 'Es tut mir leid. Die KI-Anfrage ist fehlgeschlagen: ' + (error && error.message ? error.message : String(error));
        orbState = 'idle'; statusText.textContent = 'KI-Verbindung prüfen';
        addMessage(message, 'nexus'); await persistConversation();
      } finally {
        busy = false;
        sendButton.disabled = false;
      }
    }
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('userInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
