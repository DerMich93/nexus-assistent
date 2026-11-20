/* NEXUS-Oberfläche: Start: Konfiguration laden.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    async function initializeNexusConfig() {
      if (desktopMode) {
        try { const stored = await desktopInvoke('load_config'); aiConfig={...aiConfig,...stored}; }
        catch (error) { console.warn('NEXUS-Konfiguration konnte nicht geladen werden:', error); }
        applyBackgroundMode();
        maybeAutoBackup();
        checkVault();
      }
      updateProviderStatus();
      if (!aiConfig.provider) setTimeout(()=>openAiSettings(true),350);
    }
    initializeNexusConfig();
