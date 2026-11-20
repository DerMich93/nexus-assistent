/* NEXUS-Oberfläche 1.2: Modell-Zentrale, Wetter, Feiertage, Persönlichkeit, Diagnose und Updates.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    function routerOn(cfg) { return !!(cfg && cfg.router && cfg.router.enabled); }

    // Kandidaten für eine Anfrage: mit Modell-Zentrale die Rangliste des Aufgaben-Profils, sonst der eine Hauptanbieter.
    function planCandidates(text, hasFile) {
      if (!routerOn(aiConfig)) {
        return [{id: aiConfig.provider, label: providerNames[aiConfig.provider] || aiConfig.provider, model: effectiveModel(aiConfig),
          baseUrl: baseUrlFor(aiConfig), local: isLocalProvider(aiConfig), privateOk: true, routed: false}];
      }
      const override = NexusRouter.parseOverride(text);
      const plan = NexusRouter.plan(aiConfig, {profile: NexusRouter.classify(override.text, {hasFile}), override: override.id, hasFile});
      if (!plan.candidates.length) {
        const why = plan.skipped.map(s => (NexusRouter.PROVIDERS[s.id] || {}).label + ': ' + s.reason).join(', ') || 'keine KI aktiviert';
        throw new Error('Keine passende KI verfügbar (' + why + '). Bitte in der KI-Verwaltung unter „Modell-Zentrale“ prüfen.');
      }
      return plan.candidates.map(c => ({...c, routed: true, baseUrl: c.id === 'ollama' ? (aiConfig.ollamaUrl || 'http://localhost:11434') : null}));
    }

    // Datum, Uhrzeit und Feiertage für den System-Prompt.
    function nowLine(date) {
      const d = date || new Date(), state = aiConfig.holidayState || '';
      let line = d.toLocaleString('de-DE', {weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'});
      const today = NexusTools.holidayOn(d, state);
      if (today) line += '; heute ist Feiertag: ' + today.name;
      const next = NexusTools.nextHolidays(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), state, 1)[0];
      if (next) line += '; nächster Feiertag (' + (NexusTools.STATES[state] || 'bundesweit') + '): ' + NexusTools.holidayDe(next);
      return line;
    }

    // Wetterdaten nur bei Wetterfragen; gesendet wird nur der Ort an Open-Meteo.
    function weatherEnabled() { return !aiConfig.weather || aiConfig.weather.enabled !== false; }
    async function weatherBlockFor(text) {
      if (!desktopMode || !weatherEnabled() || !NexusTools.isWeatherQuestion(text)) return '';
      const place = NexusTools.extractPlace(text) || ((aiConfig.weather || {}).place || '').trim();
      if (!place) return '[Wetter: Kein Ort bekannt. Bitte den Nutzer nach dem Ort fragen und auf den Heimatort in der KI-Verwaltung hinweisen.]';
      try { return NexusTools.wrapWeather(await desktopInvoke('weather_forecast', {place})); }
      catch (error) { return '[Wetterdaten konnten nicht abgerufen werden: ' + String(error).slice(0, 200) + ']'; }
    }

    // Grobe Kostenschätzung für bezahlte Anbieter (nur wenn ein Budget über 0 € eingetragen ist).
    async function recordSpend(candidate, messages, reply) {
      if (!(NexusRouter.PROVIDERS[candidate.id] || {}).paid) return;
      const inChars = 3000 + messages.reduce((n, m) => n + String(m.content).length, 0);
      aiConfig.routerSpend = NexusRouter.addSpend(aiConfig, candidate.id, inChars, String(reply).length);
      try { await desktopInvoke('save_config', {config: aiConfig}); } catch (_) {}
    }

    // ---- Formular: Modell-Zentrale, Wetter, Feiertage, Persönlichkeit, Updates ------------------------------
    const LIGHT_TEXT = {green: '🟢 kein Training', yellow: '🟡 kann trainieren'};
    function renderRouterRows(r) {
      const box = document.getElementById('routerProviders'); box.innerHTML = '';
      for (const [id, p] of Object.entries(NexusRouter.PROVIDERS)) {
        const set = r.providers[id];
        const row = document.createElement('div'); row.className = 'router-row'; row.dataset.provider = id;
        const head = document.createElement('label'); head.className = 'privacy-toggle';
        const box1 = document.createElement('input'); box1.type = 'checkbox'; box1.className = 'router-enabled'; box1.checked = !!set.enabled;
        const name = document.createElement('span'); name.textContent = p.label + (p.paid ? ' (kostenpflichtig)' : '') + ' – ' + LIGHT_TEXT[NexusRouter.light(id, r)];
        head.append(box1, name);
        const model = document.createElement('input'); model.type = 'text'; model.className = 'router-model'; model.value = set.model || p.model; model.spellcheck = false; model.setAttribute('aria-label', 'Modell für ' + p.label);
        row.append(head, model); row.nexusEnabled = box1; row.nexusModel = model;
        if (id !== 'ollama') {
          const keyRow = document.createElement('div'); keyRow.className = 'router-key';
          const key = document.createElement('input'); key.type = 'password'; key.className = 'router-key-input'; key.placeholder = 'API-Key (wird im Windows-Schlüsselbund gespeichert)'; key.autocomplete = 'off';
          const save = document.createElement('button'); save.className = 'btn secondary'; save.type = 'button'; save.textContent = 'Key speichern';
          const state = document.createElement('span'); state.className = 'file-meta router-key-state';
          save.addEventListener('click', async () => {
            if (!key.value.trim()) { state.textContent = 'Bitte zuerst einen Key einfügen.'; return; }
            try { await desktopInvoke('save_api_key', {provider: id, key: key.value.trim()}); key.value = ''; state.textContent = 'Key gespeichert.'; }
            catch (error) { state.textContent = 'Fehler: ' + String(error); }
          });
          keyRow.append(key, save, state); row.appendChild(keyRow);
          if (desktopMode) desktopInvoke('has_api_key', {provider: id}).then(has => { if (has && !state.textContent) state.textContent = 'Key hinterlegt.'; }).catch(() => {});
        }
        box.appendChild(row);
      }
    }
    function fillExtrasForm(cfg) {
      const r = NexusRouter.settings(cfg);
      document.getElementById('routerToggle').checked = r.enabled;
      document.getElementById('mistralNoTrainingToggle').checked = !!r.mistralNoTraining;
      document.getElementById('googleBillingToggle').checked = !!r.googleBilling;
      document.getElementById('routerBudget').value = String(r.budgetEur);
      for (const id of Object.keys(NexusRouter.PROFILES)) document.getElementById('routerProfile_' + id).value = r.profiles[id];
      renderRouterRows(r);
      const spentNow = NexusRouter.spent(cfg);
      document.getElementById('routerSpendInfo').textContent = r.budgetEur > 0 ? 'Geschätzt verbraucht in diesem Monat: ' + spentNow.toLocaleString('de-DE', {maximumFractionDigits: 2}) + ' € von ' + r.budgetEur + ' € (nur eine Schätzung).' : 'Budget 0 €: Claude und OpenAI werden nie benutzt.';
      const w = cfg.weather || {};
      document.getElementById('weatherToggle').checked = w.enabled !== false;
      document.getElementById('weatherPlace').value = w.place || '';
      document.getElementById('holidayStateSelect').value = cfg.holidayState || '';
      const p = cfg.persona || {};
      document.getElementById('personaAddress').value = p.address || 'sie';
      document.getElementById('personaLength').value = p.length || 'normal';
      document.getElementById('personaButler').checked = p.butler !== false;
      document.getElementById('updateOnStartToggle').checked = cfg.updateCheckOnStart !== false;
    }
    function readExtrasForm() {
      const providers = {};
      Array.from(document.getElementById('routerProviders').children).forEach(row => {
        const id = row.dataset && row.dataset.provider; if (!id || !row.nexusEnabled) return;
        providers[id] = {enabled: !!row.nexusEnabled.checked, model: (row.nexusModel.value || '').trim() || NexusRouter.PROVIDERS[id].model};
      });
      // Nicht angezeigte Anbieter (Formular noch nicht aufgebaut) behalten ihre bisherigen Werte.
      const before = NexusRouter.settings(aiConfig).providers;
      for (const id of Object.keys(NexusRouter.PROVIDERS)) if (!providers[id]) providers[id] = before[id];
      const profiles = {};
      for (const id of Object.keys(NexusRouter.PROFILES)) profiles[id] = document.getElementById('routerProfile_' + id).value.trim() || NexusRouter.PROFILES[id].order;
      return {
        router: {enabled: document.getElementById('routerToggle').checked, providers, profiles,
          mistralNoTraining: document.getElementById('mistralNoTrainingToggle').checked, googleBilling: document.getElementById('googleBillingToggle').checked,
          budgetEur: Math.max(0, Math.min(1000, Number(String(document.getElementById('routerBudget').value).replace(',', '.')) || 0))},
        routerSpend: aiConfig.routerSpend || {},
        weather: {enabled: document.getElementById('weatherToggle').checked, place: document.getElementById('weatherPlace').value.trim().slice(0, 80)},
        holidayState: document.getElementById('holidayStateSelect').value,
        persona: {address: document.getElementById('personaAddress').value, length: document.getElementById('personaLength').value, butler: document.getElementById('personaButler').checked},
        updateCheckOnStart: document.getElementById('updateOnStartToggle').checked
      };
    }
    (function fillStates() {
      const select = document.getElementById('holidayStateSelect');
      const none = document.createElement('option'); none.value = ''; none.textContent = 'Nur bundesweite Feiertage'; select.appendChild(none);
      for (const [code, name] of Object.entries(NexusTools.STATES)) { const o = document.createElement('option'); o.value = code; o.textContent = name; select.appendChild(o); }
    })();

    // ---- Diagnose: prüft alles Wichtige auf einmal -----------------------------------------------------------
    async function runDiagnosis() {
      const out = document.getElementById('diagnoseOutput'), lines = [];
      const show = () => { out.textContent = lines.join('\n'); };
      if (!desktopMode) { out.textContent = 'Die Diagnose ist nur in der Windows-Desktop-App verfügbar.'; return; }
      const cfg = {...aiConfig, ...readExtrasForm()};
      lines.push('Diagnose läuft …'); show(); lines.pop();
      const tests = [];
      if (routerOn(cfg)) {
        const r = NexusRouter.settings(cfg);
        for (const [id, set] of Object.entries(r.providers)) {
          if (!set.enabled) continue;
          if (NexusRouter.PROVIDERS[id].paid && r.budgetEur <= 0) { lines.push('– ' + NexusRouter.PROVIDERS[id].label + ': gesperrt (Budget 0 €)'); continue; }
          tests.push({label: NexusRouter.PROVIDERS[id].label + ' · ' + set.model, args: {provider: id, model: set.model, baseUrl: id === 'ollama' ? (cfg.ollamaUrl || 'http://localhost:11434') : null}});
        }
      } else if (cfg.provider) {
        tests.push({label: (providerNames[cfg.provider] || cfg.provider) + ' · ' + effectiveModel(cfg), args: {provider: cfg.provider, model: effectiveModel(cfg), baseUrl: baseUrlFor(cfg)}});
      } else lines.push('✘ Keine KI eingerichtet.');
      for (const test of tests) {
        try { await desktopInvoke('ai_test', test.args); lines.push('✔ ' + test.label); }
        catch (error) { lines.push('✘ ' + test.label + ': ' + NexusRouter.reason(error) + ' – ' + String(error).slice(0, 160)); }
        show();
      }
      if (cfg.weather && cfg.weather.enabled !== false && cfg.weather.place) {
        try { const w = await desktopInvoke('weather_forecast', {place: cfg.weather.place}); lines.push('✔ Wetter: ' + w.place); }
        catch (error) { lines.push('✘ Wetter: ' + String(error).slice(0, 160)); }
      } else lines.push('– Wetter: ' + (cfg.weather && cfg.weather.enabled === false ? 'ausgeschaltet' : 'kein Heimatort eingetragen'));
      try { const ws = await desktopInvoke('workspace_info'); lines.push('✔ Arbeitsordner: ' + (ws.files || []).length + ' Dateien'); }
      catch (error) { lines.push('✘ Arbeitsordner: ' + String(error).slice(0, 160)); }
      lines.push((vaultState.locked ? '✘' : '✔') + ' Daten: ' + (vaultState.locked ? 'gesperrt (Schlüssel fehlt)' : (vaultState.enabled ? 'verschlüsselt' : 'unverschlüsselt')));
      try { const u = await desktopInvoke('update_check'); lines.push(u.configured ? (u.available ? '↑ Update verfügbar: ' + u.version : '✔ NEXUS ist aktuell (' + u.current + ')') : '– Auto-Update: nicht eingerichtet (siehe UPDATES.md)'); }
      catch (error) { lines.push('✘ Update-Prüfung: ' + String(error).slice(0, 160)); }
      show();
    }
    document.getElementById('diagnoseButton').addEventListener('click', runDiagnosis);

    // ---- Updates: prüfen, auf Klick sichern und installieren --------------------------------------------------
    async function checkForUpdate(silent) {
      const status = document.getElementById('updateStatus'), install = document.getElementById('updateInstallButton');
      if (!desktopMode) { status.textContent = 'Nur in der Windows-Desktop-App.'; return null; }
      try {
        const u = await desktopInvoke('update_check');
        install.hidden = !(u.configured && u.available);
        status.textContent = !u.configured ? 'Automatische Updates sind in dieser Version noch nicht eingerichtet (siehe UPDATES.md). Installiert: ' + u.current
          : (u.available ? 'Version ' + u.version + ' ist verfügbar (installiert: ' + u.current + ').' + (u.notes ? ' Neu: ' + u.notes.slice(0, 300) : '') : 'NEXUS ist aktuell (' + u.current + ').');
        if (silent && u.configured && u.available) addMessage('Ein Update ist verfügbar: Version ' + u.version + '. Installieren unter KI-Verwaltung → Updates (deine Daten bleiben erhalten).', 'nexus', false);
        return u;
      } catch (error) { if (!silent) status.textContent = String(error); return null; }
    }
    document.getElementById('updateCheckButton').addEventListener('click', () => checkForUpdate(false));
    document.getElementById('updateInstallButton').addEventListener('click', async () => {
      const status = document.getElementById('updateStatus');
      status.textContent = 'Sichere deine Daten und lade das Update …';
      try { await desktopInvoke('auto_backup', {minHours: 0}); } catch (_) { /* Sicherung optional */ }
      try { await desktopInvoke('update_install'); status.textContent = 'Update installiert – NEXUS startet neu.'; }
      catch (error) { status.textContent = 'Update fehlgeschlagen: ' + String(error); }
    });
    setTimeout(() => { if (desktopMode && aiConfig.updateCheckOnStart !== false) checkForUpdate(true); }, 20000);
