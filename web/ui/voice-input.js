/* NEXUS-Oberfläche: Spracheingabe (Mikrofon).
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    // ---- Spracheingabe -------------------------------------------------------------------------
    // Desktop-App: Mikrofon -> Pausenerkennung -> lokale oder gewählte Spracherkennung (KI-Verwaltung).
    // Browser-Vorschau: eingebaute Erkennung des Browsers, falls vorhanden.
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null, voiceController = null;

    function stopNexusVoice() { if (voiceController) { const c = voiceController; voiceController = null; c.stop(); } }
    function setVoiceEnabled(enabled) {
      voiceEnabled = enabled;
      voiceButton.classList.toggle('active', enabled);
      voiceButton.textContent = enabled ? 'Voice: AN' : 'Voice: AUS';
      voiceButton.setAttribute('aria-pressed', String(enabled));
      if (!enabled) { stopNexusVoice(); if (recognition) { try { recognition.stop(); } catch (_) {} } }
      if (!busy && orbState !== 'speaking') idleState();
    }
    function micErrorMessage(error) {
      const name = error && error.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') return 'Mikrofonzugriff verweigert. Bitte in den Windows-Einstellungen unter Datenschutz → Mikrofon erlauben und NEXUS neu starten.';
      if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Kein Mikrofon gefunden.';
      return 'Mikrofon konnte nicht gestartet werden: ' + String((error && error.message) || error);
    }
    async function startNexusVoice() {
      const cfg = aiConfig;
      voiceController = NexusVoice.createController({
        isPaused: () => busy || isSpeaking,
        transcribe: wav => desktopInvoke('transcribe_audio', {mode: cfg.sttMode, baseUrl: sttBaseUrl(cfg), model: cfg.sttModel || '', audio: Array.from(wav)}),
        onState: state => {
          if (!voiceEnabled) return;
          if (state === 'listening') { if (!busy && !isSpeaking) { orbState = 'listening'; statusText.textContent = 'Ich höre zu ...'; } }
          else if (state === 'speech') { orbState = 'listening'; statusText.textContent = 'Ich höre ...'; }
          else if (state === 'transcribing') { orbState = 'processing'; statusText.textContent = 'Ich verstehe ...'; }
        },
        onText: raw => {
          const text = NexusVoice.cleanTranscript(raw);
          if (!text) { statusText.textContent = 'Nichts verstanden. Ich höre weiter zu ...'; return; }
          document.getElementById('userInput').value = text;
          sendMessage();
        },
        onError: error => { statusText.textContent = 'Spracherkennung: ' + String(error); },
        onFatal: error => { setVoiceEnabled(false); statusText.textContent = 'Spracheingabe abgeschaltet: ' + String(error); }
      });
      setVoiceEnabled(true);
      try { await voiceController.start(); }
      catch (error) { setVoiceEnabled(false); statusText.textContent = micErrorMessage(error); }
    }

    if (SpeechRecognition && !desktopMode) {
      recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        if (isSpeaking || busy) return; // NEXUS soll sich nicht selbst zuhören.
        const result = event.results[event.results.length - 1];
        const transcript = result && result[0] ? result[0].transcript.trim() : '';
        if (transcript && voiceEnabled) { document.getElementById('userInput').value = transcript; sendMessage(); }
      };
      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        // Bei dauerhaften Fehlern abschalten, sonst würde onend die Erkennung endlos neu starten.
        if (['network', 'not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(event.error)) setVoiceEnabled(false);
        statusText.textContent = 'Mikrofonfehler: ' + event.error;
      };
      recognition.onend = () => { if (voiceEnabled) { try { recognition.start(); } catch (_) {} } };
    }

    voiceButton.addEventListener('click', async () => {
      if (voiceEnabled) { setVoiceEnabled(false); return; }
      if (desktopMode) {
        if (!aiConfig.sttMode || aiConfig.sttMode === 'off') {
          statusText.textContent = 'Spracheingabe ist noch nicht eingerichtet: KI-Verwaltung → Spracheingabe.';
          openAiSettings(false);
          return;
        }
        await startNexusVoice();
        return;
      }
      if (!recognition) { statusText.textContent = 'Spracheingabe in dieser Umgebung nicht verfügbar'; return; }
      setVoiceEnabled(true);
      try { recognition.start(); }
      catch (error) { setVoiceEnabled(false); statusText.textContent = 'Mikrofon konnte nicht gestartet werden'; }
    });
