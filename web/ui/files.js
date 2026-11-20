/* NEXUS-Oberfläche: Arbeitsordner (Dokumente\Nexus-Arbeitsordner) – Dateien ansehen und an den Chat anhängen.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    const filesModal = document.getElementById('filesModal');
    let workspaceFiles = [], pendingAttachment = null;
    const filesStatus = msg => { document.getElementById('filesStatus').textContent = msg; };

    // Dateien gehen an Cloud-KI nur mit eigener Freigabe; lokale KI darf immer.
    function filesAllowed(cfg) {
      if (routerOn(cfg)) return cfg.shareFilesWithCloud === true || NexusRouter.settings(cfg).providers.ollama.enabled;
      return isLocalProvider(cfg) || cfg.shareFilesWithCloud === true;
    }
    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
      return (bytes / 1024 / 1024).toLocaleString('de-DE', {maximumFractionDigits: 1}) + ' MB';
    }
    function renderFiles() {
      const list = document.getElementById('filesList'); list.innerHTML = '';
      if (!workspaceFiles.length) { list.innerHTML = '<div class="memory-empty">Noch keine Dateien im Arbeitsordner.</div>'; return; }
      workspaceFiles.forEach(file => {
        const card = document.createElement('div'); card.className = 'memory-item';
        const name = document.createElement('div'); name.textContent = file.name;
        const meta = document.createElement('div'); meta.className = 'file-meta';
        meta.textContent = (NexusOffice.EXT_LABEL[NexusOffice.extOf(file.name)] || 'Datei') + ' · ' + formatSize(file.size || 0) + (file.modified ? ' · ' + new Date(file.modified * 1000).toLocaleString('de-DE', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '');
        const actions = document.createElement('div'); actions.className = 'memory-item-actions';
        const attach = document.createElement('button'); attach.className = 'btn secondary'; attach.type = 'button'; attach.textContent = 'An Chat anhängen';
        attach.addEventListener('click', () => attachFile(file.name));
        actions.appendChild(attach); card.append(name, meta, actions); list.appendChild(card);
      });
    }
    async function refreshFiles() {
      if (!desktopMode) { filesStatus('Der Arbeitsordner ist nur in der Windows-Desktop-App verfügbar.'); workspaceFiles = []; renderFiles(); return; }
      try {
        const info = await desktopInvoke('workspace_info');
        document.getElementById('filesPath').textContent = 'Ordner: ' + info.path;
        workspaceFiles = info.files || []; renderFiles();
      } catch (error) { filesStatus('Der Arbeitsordner konnte nicht gelesen werden: ' + String(error)); }
    }
    async function openFiles() {
      filesModal.classList.add('open'); filesStatus('');
      await refreshFiles();
    }
    function renderAttachment() {
      const chip = document.getElementById('attachmentChip');
      chip.hidden = !pendingAttachment;
      document.getElementById('attachmentName').textContent = pendingAttachment ? '📎 ' + pendingAttachment.name : '';
    }
    function clearAttachment() { pendingAttachment = null; renderAttachment(); }
    // Liest die Datei, wandelt sie in Text und merkt sie für die nächste Nachricht vor.
    async function attachFile(name) {
      if (!filesAllowed(aiConfig)) {
        filesStatus('Für Cloud-KI zuerst erlauben: KI-Verwaltung → „Dateien aus dem Arbeitsordner an Cloud-KI schicken“. Bei lokaler KI ist das nicht nötig.');
        return false;
      }
      filesStatus('Lese „' + name + '“ ...');
      try {
        const bytes = await desktopInvoke('workspace_read', {name});
        const info = await NexusOffice.extractText(name, bytes);
        if (!info.text.trim()) { filesStatus('In „' + name + '“ wurde kein lesbarer Text gefunden.'); return false; }
        pendingAttachment = {name, info};
        renderAttachment();
        filesModal.classList.remove('open');
        statusText.textContent = info.truncated ? 'Datei angehängt (gekürzt auf ' + NexusOffice.MAX_TEXT.toLocaleString('de-DE') + ' Zeichen)' : 'Datei angehängt – jetzt deine Bitte eingeben';
        document.getElementById('userInput').focus();
        return true;
      } catch (error) {
        filesStatus('„' + name + '“ konnte nicht gelesen werden: ' + (error && error.message ? error.message : String(error)));
        return false;
      }
    }
    document.getElementById('filesButton').addEventListener('click', openFiles);
    document.getElementById('attachButton').addEventListener('click', openFiles);
    document.getElementById('refreshFilesButton').addEventListener('click', refreshFiles);
    document.getElementById('closeFilesButton').addEventListener('click', () => filesModal.classList.remove('open'));
    document.getElementById('attachmentRemove').addEventListener('click', clearAttachment);
    document.getElementById('openFolderButton').addEventListener('click', async () => {
      if (!desktopMode) return;
      try { await desktopInvoke('workspace_open'); } catch (error) { filesStatus(String(error)); }
    });
    renderAttachment();
