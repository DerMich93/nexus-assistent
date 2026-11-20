/* NEXUS-Oberfläche: Installationshinweis der Browser-Vorschau.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    let deferredInstallPrompt = null;
    const installButton = document.getElementById('installButton');
    if (desktopMode) installButton.hidden = true;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installButton.hidden = false;
    });
    installButton.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installButton.hidden = true;
    });
    window.addEventListener('appinstalled', () => {
      installButton.hidden = true;
      statusText.textContent = 'Nexus-App installiert';
    });
