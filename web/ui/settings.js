/* NEXUS-Oberfläche: KI-Verwaltung: Anbieter, Spracheingabe, Hintergrund, Internet, Verschlüsselung, Sicherung.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    // KI-Konfiguration: keine API-Schlüssel im Browser dauerhaft ablegen.
    const providerModels = {
      openai: ['gpt-5.5', 'gpt-5.4-mini', 'chat-latest'],
      anthropic: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
      google: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-pro-preview'],
      groq: ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
      mistral: ['mistral-large-latest', 'mistral-small-latest'],
      openrouter: ['openrouter/auto'],
      ollama: ['qwen2.5:3b', 'llama3.2:3b', 'qwen2.5:1.5b'],
      custom: []
    };
    const providerNames = {openai:'OpenAI',anthropic:'Anthropic Claude',google:'Google Gemini',groq:'Groq',mistral:'Mistral',openrouter:'OpenRouter',ollama:'Ollama (lokal)',custom:'Eigener Server'};
    const setupModal = document.getElementById('aiSetupModal');
    const providerSelect = document.getElementById('providerSelect');
    const modelSelect = document.getElementById('modelSelect');
    const customModelInput = document.getElementById('customModel');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKeyWrap = document.getElementById('apiKeyWrap');
    const ollamaWrap = document.getElementById('ollamaWrap');
    const customWrap = document.getElementById('customWrap');
    const sttModeSelect = document.getElementById('sttModeSelect'), sttUrlInput = document.getElementById('sttUrl'), sttModelInput = document.getElementById('sttModel'), sttKeyInput = document.getElementById('sttKey');
    const sttUrlWrap = document.getElementById('sttUrlWrap'), sttModelWrap = document.getElementById('sttModelWrap'), sttKeyWrap = document.getElementById('sttKeyWrap');
    const sttHint = document.getElementById('sttHint'), testSttButton = document.getElementById('testSttButton');
    const autostartToggle = document.getElementById('autostartToggle'), closeToTrayToggle = document.getElementById('closeToTrayToggle'), notificationsToggle = document.getElementById('notificationsToggle');
    const autoBackupToggle = document.getElementById('autoBackupToggle'), autoBackupSelect = document.getElementById('autoBackupSelect');
    let autostartInitial = false;
    const webSearchToggle = document.getElementById('webSearchToggle'), webCloudToggle = document.getElementById('webCloudToggle');
    const shareCalendarToggle = document.getElementById('shareCalendarToggle'), eventLeadSelect = document.getElementById('eventLeadSelect');
    const vaultStatusEl = document.getElementById('vaultStatus'), vaultToggleButton = document.getElementById('vaultToggleButton'), vaultShowKeyButton = document.getElementById('vaultShowKeyButton');
    const vaultKeyOutput = document.getElementById('vaultKeyOutput'), vaultImportWrap = document.getElementById('vaultImportWrap'), vaultKeyInput = document.getElementById('vaultKeyInput'), vaultHint = document.getElementById('vaultHint');
    let vaultState = {enabled: false, keyPresent: false, locked: false}, vaultKeyTimer = null;
    const desktopMode = !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
    const desktopInvoke = desktopMode ? window.__TAURI__.core.invoke : null;
    let aiConfig = {provider:'', model:'', customModel:'', ollamaUrl:'http://localhost:11434', customUrl:'', shareMemoriesWithCloud:false, shareTasksWithCloud:false, sttMode:'off', sttUrl:'http://127.0.0.1:8178', sttModel:'', closeToTray:false, nativeNotifications:true, autoBackup:true, webSearch:false, webWithCloud:false, shareCalendarWithCloud:false, eventLeadMinutes:15, shareFilesWithCloud:false};
    if (!desktopMode) { try { aiConfig = {...aiConfig, ...JSON.parse(localStorage.getItem('nexus.aiConfig') || '{}')}; } catch (_) {} }

    // Modell, das tatsächlich verwendet wird: der freie Modellname hat Vorrang vor der Auswahlliste.
    function effectiveModel(cfg) { return ((cfg.customModel || '').trim() || (cfg.model || '').trim()); }
    // "Lokal" heißt: Die Daten verlassen diesen PC nicht (Ollama oder ein Server auf localhost).
    function isLocalProvider(cfg) {
      if (cfg.provider === 'ollama') return true;
      if (cfg.provider === 'custom') {
        try { return ['localhost','127.0.0.1','[::1]','::1'].includes(new URL(cfg.customUrl).hostname); } catch (_) { return false; }
      }
      return false;
    }
    const needsApiKey = provider => provider !== 'ollama' && provider !== 'custom';
    function baseUrlFor(cfg) {
      if (cfg.provider === 'ollama') return cfg.ollamaUrl || 'http://localhost:11434';
      if (cfg.provider === 'custom') return cfg.customUrl || '';
      return null;
    }
    function readAiForm() {
      return {
        provider: providerSelect.value,
        model: modelSelect.value,
        customModel: customModelInput.value.trim(),
        ollamaUrl: document.getElementById('ollamaUrl').value.trim() || 'http://localhost:11434',
        customUrl: document.getElementById('customUrl').value.trim(),
        shareMemoriesWithCloud: document.getElementById('shareMemoriesToggle').checked,
        shareTasksWithCloud: document.getElementById('shareTasksToggle').checked,
        sttMode: sttModeSelect.value,
        sttUrl: sttUrlInput.value.trim(),
        sttModel: sttModelInput.value.trim(),
        closeToTray: closeToTrayToggle.checked,
        nativeNotifications: notificationsToggle.checked,
        autoBackup: autoBackupToggle.checked,
        webSearch: webSearchToggle.checked,
        webWithCloud: webCloudToggle.checked,
        shareCalendarWithCloud: shareCalendarToggle.checked,
        shareFilesWithCloud: document.getElementById('shareFilesToggle').checked,
        ...readExtrasForm(),
        eventLeadMinutes: Number(eventLeadSelect.value) || 0
      };
    }
    const STT_DEFAULTS = { local: {url: 'http://127.0.0.1:8178', model: ''}, groq: {url: '', model: 'whisper-large-v3-turbo'}, openai: {url: '', model: 'whisper-1'}, custom: {url: '', model: ''} };
    const STT_HINTS = {
      off: 'Ohne Spracheingabe bleibt der Voice-Knopf ohne Funktion. „Vorlesen“ ist davon unabhängig.',
      local: 'Alles bleibt auf diesem PC. Einmalig einrichten: SPRACHEINGABE-EINRICHTEN.bat im NEXUS-Ordner ausführen. Das lädt whisper.cpp und ein Sprachmodell (ca. 0,5 GB) und startet den Server künftig mit Windows.',
      groq: 'Cloud: Deine Aufnahmen werden an Groq gesendet. Den Key trägst du unten ein; er liegt getrennt vom KI-Key im Windows-Schlüsselbund.',
      openai: 'Cloud: Deine Aufnahmen werden an OpenAI gesendet. Den Key trägst du unten ein.',
      custom: 'Eigener Server mit OpenAI-kompatibler Schnittstelle (/audio/transcriptions). Adresse und Modellname eintragen, ein Key ist optional.'
    };
    function refreshStt(applyDefaults) {
      const mode = sttModeSelect.value, d = STT_DEFAULTS[mode];
      if (d && applyDefaults) { sttUrlInput.value = d.url; sttModelInput.value = d.model; sttKeyInput.value = ''; }
      if (mode === 'local' && !sttUrlInput.value) sttUrlInput.value = STT_DEFAULTS.local.url;
      sttUrlWrap.hidden = !(mode === 'local' || mode === 'custom');
      sttModelWrap.hidden = !(mode === 'groq' || mode === 'openai' || mode === 'custom');
      sttKeyWrap.hidden = !(mode === 'groq' || mode === 'openai' || mode === 'custom');
      sttHint.textContent = STT_HINTS[mode] || '';
      testSttButton.hidden = mode === 'off';
    }
    function sttBaseUrl(cfg) {
      if (cfg.sttMode === 'local') return cfg.sttUrl || STT_DEFAULTS.local.url;
      if (cfg.sttMode === 'custom') return cfg.sttUrl || '';
      return null;
    }
    function fillModelSelect(models, preferred) {
      modelSelect.innerHTML = '';
      models.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; modelSelect.appendChild(option); });
      modelSelect.value = models.includes(preferred) ? preferred : (models[0] || '');
    }
    function refreshModels(selected) {
      const provider = providerSelect.value;
      const presets = providerModels[provider] || [];
      const list = [...presets];
      if (selected && !list.includes(selected)) list.push(selected);
      modelSelect.innerHTML = '';
      if (!list.length) { const option = document.createElement('option'); option.value = ''; option.textContent = 'Modellname unten eintragen'; modelSelect.appendChild(option); }
      else fillModelSelect(list, selected);
      apiKeyWrap.hidden = provider === 'ollama';
      ollamaWrap.hidden = provider !== 'ollama';
      customWrap.hidden = provider !== 'custom';
      apiKeyWrap.querySelector('label').textContent = provider === 'custom' ? 'API-Key (optional, nur falls der Server einen verlangt)' : 'API-Key';
    }
    // ---- Hintergrundbetrieb, Benachrichtigungen, automatische Sicherung -----------------------------
    async function applyBackgroundMode() {
      if (!desktopMode) return;
      try {
        const active = await desktopInvoke('set_background_mode', {enabled: aiConfig.closeToTray === true});
        if (aiConfig.closeToTray === true && !active) document.getElementById('setupStatus').textContent = 'Das Symbol im Infobereich ist nicht verfügbar. NEXUS wird beim Schließen des Fensters beendet.';
      } catch (_) { /* ältere Version ohne diesen Befehl */ }
    }
    // Zeigt eine Windows-Benachrichtigung, aber nur wenn NEXUS gerade nicht im Vordergrund ist.
    function notifyNative(title, body) {
      if (!desktopMode || aiConfig.nativeNotifications === false) return;
      if (typeof document.hasFocus === 'function' && document.hasFocus()) return;
      Promise.resolve(desktopInvoke('notify', {title, body})).catch(() => {});
    }
    async function refreshAutoBackups() {
      autoBackupSelect.innerHTML = '';
      let names = [];
      if (desktopMode) { try { names = await desktopInvoke('list_auto_backups'); } catch (_) {} }
      if (!names.length) { const o = document.createElement('option'); o.value = ''; o.textContent = 'Noch keine Sicherung vorhanden'; autoBackupSelect.appendChild(o); return; }
      names.forEach(name => { const o = document.createElement('option'); o.value = name; o.textContent = new Date(Number(name) * 1000).toLocaleString('de-DE'); autoBackupSelect.appendChild(o); });
    }
    async function maybeAutoBackup() {
      if (!desktopMode || aiConfig.autoBackup === false) return;
      try { await desktopInvoke('auto_backup', {minHours: 12}); } catch (_) {}
    }
    setInterval(maybeAutoBackup, 3600000);

    // ---- Datenverschluesselung ----------------------------------------------------------------------
    function hideVaultKey() { vaultKeyOutput.value = ''; vaultKeyOutput.hidden = true; if (vaultKeyTimer) { clearTimeout(vaultKeyTimer); vaultKeyTimer = null; } }
    async function refreshVault() {
      hideVaultKey();
      if (!desktopMode) { vaultStatusEl.textContent = 'Die Datenverschlüsselung gibt es nur in der Desktop-App.'; vaultToggleButton.hidden = true; vaultShowKeyButton.hidden = true; vaultImportWrap.hidden = true; return; }
      try { vaultState = await desktopInvoke('vault_status'); }
      catch (error) { vaultStatusEl.textContent = 'Status nicht lesbar: ' + String(error); return; }
      updateDataStatus();
      vaultToggleButton.hidden = false;
      vaultToggleButton.textContent = vaultState.enabled ? 'Verschlüsselung ausschalten' : 'Verschlüsselung einschalten';
      vaultShowKeyButton.hidden = !vaultState.keyPresent;
      vaultImportWrap.hidden = !vaultState.locked;
      vaultStatusEl.textContent = vaultState.locked
        ? 'ACHTUNG: Die Daten sind verschlüsselt, aber der Schlüssel fehlt auf diesem PC. Gib unten den Wiederherstellungsschlüssel ein.'
        : (vaultState.enabled ? 'Aktiv: Gespräche, Aufgaben, Gedächtnis und Automatisierungen sind verschlüsselt. Der Schlüssel liegt im Windows-Schlüsselbund dieses Benutzerkontos.'
                              : 'Aus: Deine Daten liegen unverschlüsselt im Ordner %APPDATA%\\de.nexus.assistant.');
    }
    async function showVaultKey(prefix) {
      const key = await desktopInvoke('vault_export_key');
      vaultKeyOutput.value = key; vaultKeyOutput.hidden = false;
      vaultHint.textContent = (prefix || '') + 'Schreibe diesen Schlüssel auf oder lege ihn in einem Passwortmanager ab. Ohne ihn sind die Daten nach einer Neuinstallation von Windows nicht mehr lesbar. Er wird nach einer Minute wieder ausgeblendet.';
      if (vaultKeyTimer) clearTimeout(vaultKeyTimer);
      vaultKeyTimer = setTimeout(hideVaultKey, 60000);
    }
    // Beim Start: Sind die Daten verschluesselt, aber der Schluessel fehlt (z. B. nach Neuinstallation von Windows)?
    async function checkVault() {
      if (!desktopMode) return;
      try {
        vaultState = await desktopInvoke('vault_status');
        updateDataStatus();
        if (vaultState.locked) {
          addMessage('Achtung: Deine Daten sind verschlüsselt, aber der Schlüssel fehlt auf diesem PC. Öffne „KI-Verwaltung → Datenverschlüsselung“ und gib deinen Wiederherstellungsschlüssel ein.', 'nexus', false);
          openAiSettings(false);
        }
      } catch (_) { /* ältere Version ohne diesen Befehl */ }
    }
    function openAiSettings(firstRun=false) {
      document.getElementById('setupTitle').textContent = firstRun ? 'NEXUS – KI einrichten' : 'KI-Verwaltung';
      document.getElementById('setupIntro').textContent = firstRun ? 'Willkommen. Wählen Sie Ihren KI-Anbieter. Diese Auswahl können Sie später jederzeit ändern.' : (desktopMode ? 'Ändern Sie Anbieter, Modell oder Zugangsdaten. API-Schlüssel werden geschützt im Windows-Schlüsselbund verwaltet.' : 'Die KI-Anbindung funktioniert nur in der installierten Windows-Desktop-App.');
      providerSelect.value = aiConfig.provider || 'openai';
      refreshModels(aiConfig.model);
      customModelInput.value = aiConfig.customModel || '';
      document.getElementById('ollamaUrl').value = aiConfig.ollamaUrl || 'http://localhost:11434';
      document.getElementById('customUrl').value = aiConfig.customUrl || '';
      document.getElementById('shareMemoriesToggle').checked = aiConfig.shareMemoriesWithCloud === true;
      document.getElementById('shareTasksToggle').checked = aiConfig.shareTasksWithCloud === true;
      closeToTrayToggle.checked = aiConfig.closeToTray === true;
      notificationsToggle.checked = aiConfig.nativeNotifications !== false;
      autoBackupToggle.checked = aiConfig.autoBackup !== false;
      webSearchToggle.checked = aiConfig.webSearch === true;
      webCloudToggle.checked = aiConfig.webWithCloud === true;
      shareCalendarToggle.checked = aiConfig.shareCalendarWithCloud === true;
      document.getElementById('shareFilesToggle').checked = aiConfig.shareFilesWithCloud === true;
      fillExtrasForm(aiConfig);
      eventLeadSelect.value = String(aiConfig.eventLeadMinutes != null ? aiConfig.eventLeadMinutes : 15);
      autostartToggle.checked = false; autostartInitial = false;
      if (desktopMode) {
        Promise.resolve(desktopInvoke('get_autostart')).then(on => { autostartToggle.checked = !!on; autostartInitial = !!on; }).catch(() => {});
        refreshAutoBackups();
        refreshVault();
      }
      sttModeSelect.value = aiConfig.sttMode || 'off';
      sttUrlInput.value = aiConfig.sttUrl || ''; sttModelInput.value = aiConfig.sttModel || ''; sttKeyInput.value = '';
      refreshStt(false);
      apiKeyInput.value = '';
      const status = document.getElementById('setupStatus');
      status.textContent = '';
      if (desktopMode && aiConfig.provider && aiConfig.provider !== 'ollama') {
        desktopInvoke('has_api_key', {provider: aiConfig.provider}).then(has => { if (has) status.textContent = 'Ein API-Key ist geschützt im Windows-Schlüsselbund hinterlegt.'; }).catch(() => {});
      }
      setupModal.classList.add('open');
    }
    function updateProviderStatus() {
      const configured = !!aiConfig.provider, routed = routerOn(aiConfig);
      const first = routed ? NexusRouter.plan(aiConfig, {profile: 'general'}).candidates[0] : null;
      document.getElementById('providerStatus').textContent = routed ? 'Modell-Zentrale (automatisch)' : (configured ? providerNames[aiConfig.provider] : 'Nicht eingerichtet');
      document.getElementById('aiModuleStatus').textContent = routed ? (first ? 'bevorzugt: ' + first.label + ' · ' + first.model : 'keine KI aktiv') : (configured ? (effectiveModel(aiConfig) || 'Modell fehlt') : 'Nicht eingerichtet');
      const webAsked = aiConfig.webSearch === true, webOk = webAsked && (isLocalProvider(aiConfig) || aiConfig.webWithCloud === true);
      document.getElementById('webStatus').textContent = webOk ? 'An' : (webAsked ? 'Aus (Cloud-KI nicht freigegeben)' : 'Aus');
      document.getElementById('speechStatus').textContent = {off: 'Aus', local: 'Lokal', groq: 'Groq (Cloud)', openai: 'OpenAI (Cloud)', custom: 'Eigener Server'}[aiConfig.sttMode || 'off'] || 'Aus';
      updateDataStatus();
    }
    function updateDataStatus() {
      document.getElementById('dataStatus').textContent = !desktopMode ? '–' : (vaultState.locked ? 'Gesperrt (Schlüssel fehlt)' : (vaultState.enabled ? 'Verschlüsselt' : 'Unverschlüsselt'));
    }
    providerSelect.addEventListener('change', () => { customModelInput.value = ''; refreshModels(); });
    sttModeSelect.addEventListener('change', () => refreshStt(true));
    document.getElementById('aiSettingsButton').addEventListener('click', () => openAiSettings(false));
    document.getElementById('closeSetupButton').addEventListener('click', () => setupModal.classList.remove('open'));
    document.getElementById('saveAiSettingsButton').addEventListener('click', async () => {
      const status = document.getElementById('setupStatus');
      const nextConfig = readAiForm();
      const provider = nextConfig.provider;
      const key = apiKeyInput.value.trim();
      if (!effectiveModel(nextConfig)) { status.textContent = 'Bitte ein Modell auswählen oder den Modellnamen eintragen.'; return; }
      if (provider === 'custom' && !nextConfig.customUrl) { status.textContent = 'Bitte die Adresse des Servers eintragen, z. B. http://localhost:1234'; return; }
      try {
        if (desktopMode && provider !== 'ollama') {
          if (key) await desktopInvoke('save_api_key', {provider, key});
          else if (needsApiKey(provider) && !(await desktopInvoke('has_api_key', {provider}))) { status.textContent = 'Bitte geben Sie einen API-Key ein.'; return; }
        }
        if (['groq', 'openai', 'custom'].includes(nextConfig.sttMode)) {
          const sttProvider = 'stt-' + nextConfig.sttMode, sttKey = sttKeyInput.value.trim();
          if (nextConfig.sttMode === 'custom' && (!nextConfig.sttUrl || !nextConfig.sttModel)) { status.textContent = 'Bitte Adresse und Modellname der Spracherkennung eintragen.'; return; }
          if (nextConfig.sttMode !== 'custom' && !nextConfig.sttModel) { status.textContent = 'Bitte einen Modellnamen für die Spracherkennung eintragen.'; return; }
          if (desktopMode) {
            if (sttKey) await desktopInvoke('save_api_key', {provider: sttProvider, key: sttKey});
            else if (nextConfig.sttMode !== 'custom' && !(await desktopInvoke('has_api_key', {provider: sttProvider}))) { status.textContent = 'Bitte den API-Key für die Spracheingabe eintragen.'; return; }
          }
        }
        if (nextConfig.sttMode === 'local' && !nextConfig.sttUrl) nextConfig.sttUrl = STT_DEFAULTS.local.url;
        sttKeyInput.value = '';
        if (desktopMode) await desktopInvoke('save_config', {config: nextConfig});
        else localStorage.setItem('nexus.aiConfig', JSON.stringify(nextConfig));
        aiConfig = nextConfig;
        if (desktopMode && autostartToggle.checked !== autostartInitial) {
          try { await desktopInvoke('set_autostart', {enabled: autostartToggle.checked}); autostartInitial = autostartToggle.checked; }
          catch (error) { status.textContent = 'Autostart konnte nicht geändert werden: ' + String(error); }
        }
        await applyBackgroundMode();
        maybeAutoBackup();
        apiKeyInput.value = '';
        updateProviderStatus();
        status.textContent = desktopMode ? 'Einstellungen gespeichert. Ein API-Schlüssel liegt geschützt im Windows-Schlüsselbund.' : 'Einstellungen für diese Browser-Vorschau gespeichert. Antworten gibt es nur in der Desktop-App.';
        setTimeout(() => setupModal.classList.remove('open'), 1700);
      } catch (error) {
        status.textContent = 'Speichern fehlgeschlagen: ' + String(error);
      }
    });
    document.getElementById('deleteApiKeyButton').addEventListener('click', async () => {
      const provider = providerSelect.value;
      const status = document.getElementById('setupStatus');
      if (provider === 'ollama') { status.textContent = 'Für Ollama wird kein API-Key verwendet.'; return; }
      if (!desktopMode) { status.textContent = 'Es ist kein API-Key gespeichert (Browser-Vorschau).'; return; }
      if (!window.confirm('Den gespeicherten API-Key für ' + providerNames[provider] + ' wirklich aus dem Windows-Schlüsselbund löschen?')) return;
      try {
        await desktopInvoke('delete_api_key', {provider});
        apiKeyInput.value = '';
        status.textContent = 'API-Key wurde aus dem Windows-Schlüsselbund gelöscht.';
      } catch (error) { status.textContent = 'Löschen fehlgeschlagen: ' + String(error); }
    });
    vaultToggleButton.addEventListener('click', async () => {
      const status = document.getElementById('setupStatus');
      if (!desktopMode) return;
      try {
        if (!vaultState.enabled) {
          if (!window.confirm('Datenverschlüsselung einschalten?\n\nGespräche, Aufgaben, Gedächtnis und Automatisierungen werden auf diesem PC verschlüsselt. Der Schlüssel liegt im Windows-Schlüsselbund. Nach einer Neuinstallation von Windows sind die Daten ohne den Wiederherstellungsschlüssel nicht mehr lesbar. Du bekommst ihn gleich angezeigt.')) return;
          await desktopInvoke('vault_enable');
          await refreshVault();
          await showVaultKey('WICHTIG, jetzt sichern: ');
          status.textContent = 'Verschlüsselung ist eingeschaltet. Bitte den Wiederherstellungsschlüssel notieren.';
        } else {
          if (!window.confirm('Verschlüsselung ausschalten?\n\nDie Daten werden wieder im Klartext gespeichert. Der Schlüssel bleibt im Windows-Schlüsselbund, damit ältere verschlüsselte Sicherungen lesbar bleiben.')) return;
          await desktopInvoke('vault_disable');
          await refreshVault();
          status.textContent = 'Verschlüsselung ist ausgeschaltet.';
        }
      } catch (error) { status.textContent = 'Fehlgeschlagen: ' + String(error); }
    });
    vaultShowKeyButton.addEventListener('click', async () => {
      try { await showVaultKey(''); } catch (error) { document.getElementById('setupStatus').textContent = 'Schlüssel nicht lesbar: ' + String(error); }
    });
    document.getElementById('vaultImportButton').addEventListener('click', async () => {
      const status = document.getElementById('setupStatus');
      if (!desktopMode) return;
      try {
        await desktopInvoke('vault_import_key', {key: vaultKeyInput.value});
        vaultKeyInput.value = '';
        status.textContent = 'Schlüssel übernommen. NEXUS lädt neu ...';
        setTimeout(() => location.reload(), 800);
      } catch (error) { status.textContent = String(error); }
    });
    document.getElementById('autoBackupNowButton').addEventListener('click', async () => {
      const status = document.getElementById('setupStatus');
      if (!desktopMode) { status.textContent = 'Die automatische Sicherung gibt es nur in der Desktop-App.'; return; }
      try {
        const name = await desktopInvoke('auto_backup', {minHours: 0});
        status.textContent = name ? 'Sicherung erstellt. Es bleiben die letzten 5 erhalten.' : 'Keine Änderungen seit der letzten Sicherung. Es wurde nichts Neues angelegt.';
        await refreshAutoBackups();
      } catch (error) { status.textContent = 'Sicherung fehlgeschlagen: ' + String(error); }
    });
    document.getElementById('autoBackupRestoreButton').addEventListener('click', async () => {
      const status = document.getElementById('setupStatus'), name = autoBackupSelect.value;
      if (!desktopMode || !name) { status.textContent = 'Bitte zuerst eine Sicherung auswählen.'; return; }
      const label = new Date(Number(name) * 1000).toLocaleString('de-DE');
      if (!window.confirm('Alle Daten (Gespräche, Aufgaben, Gedächtnis, Einstellungen) auf den Stand vom ' + label + ' zurücksetzen? Der jetzige Stand wird vorher einmalig beiseitegelegt.')) return;
      try {
        await desktopInvoke('restore_auto_backup', {name});
        status.textContent = 'Wiederhergestellt. NEXUS lädt neu ...';
        setTimeout(() => location.reload(), 800);
      } catch (error) { status.textContent = 'Wiederherstellen fehlgeschlagen: ' + String(error); }
    });
    testSttButton.addEventListener('click', async () => {
      const status = document.getElementById('setupStatus'), form = readAiForm();
      if (!desktopMode) { status.textContent = 'Der Test ist nur in der installierten Windows-Desktop-App verfügbar.'; return; }
      try {
        const sttKey = sttKeyInput.value.trim();
        if (sttKey && ['groq', 'openai', 'custom'].includes(form.sttMode)) { await desktopInvoke('save_api_key', {provider: 'stt-' + form.sttMode, key: sttKey}); sttKeyInput.value = ''; }
        status.textContent = 'Teste die Spracherkennung ...';
        await desktopInvoke('transcribe_audio', {mode: form.sttMode, baseUrl: sttBaseUrl(form), model: form.sttModel, audio: Array.from(NexusVoice.silentWav(1))});
        status.textContent = 'Die Spracherkennung antwortet. Nach dem Speichern kannst du sie mit „Voice“ nutzen.';
      } catch (error) { status.textContent = 'Test fehlgeschlagen: ' + String(error); }
    });
    document.getElementById('testConnectionButton').addEventListener('click', async () => {
      const status = document.getElementById('setupStatus');
      const form = readAiForm();
      const provider = form.provider;
      if (!desktopMode) { status.textContent = 'Der Verbindungstest ist nur in der installierten Windows-Desktop-App verfügbar.'; return; }
      if (provider === 'custom' && !form.customUrl) { status.textContent = 'Bitte zuerst die Adresse des Servers eintragen.'; return; }
      try {
        const key = apiKeyInput.value.trim();
        if (key && provider !== 'ollama') { await desktopInvoke('save_api_key', {provider, key}); apiKeyInput.value = ''; }
        if (provider === 'ollama') {
          status.textContent = 'Suche lokale Ollama-Modelle ...';
          const models = await desktopInvoke('list_ollama_models', {ollamaUrl: form.ollamaUrl});
          if (!models.length) { status.textContent = 'Ollama ist erreichbar, aber es ist noch kein Modell installiert. Installieren Sie eines, z. B. mit „ollama pull qwen2.5:3b“.'; return; }
          fillModelSelect(models, form.model);
        } else if (provider === 'custom') {
          status.textContent = 'Frage die Modellliste des Servers ab ...';
          try { const models = await desktopInvoke('list_custom_models', {baseUrl: form.customUrl}); fillModelSelect(models, form.model); } catch (_) { /* Die Modellliste ist optional. */ }
        }
        form.model = modelSelect.value;
        status.textContent = 'Verbindung zu ' + providerNames[provider] + ' wird geprüft ...';
        status.textContent = await desktopInvoke('ai_test', {provider, model: effectiveModel(form), baseUrl: baseUrlFor(form)});
      } catch (error) { status.textContent = 'Verbindungstest fehlgeschlagen: ' + String(error); }
    });
