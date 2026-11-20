/* NEXUS-Oberfläche: Gedächtnis und Automatisierungen.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    const memoryModal = document.getElementById('memoryModal');
    let memoryItems = [], editingMemoryId = null;
    function renderMemories() {
      const list = document.getElementById('memoryList'); list.innerHTML = '';
      if (!memoryItems.length) { list.innerHTML = '<div class="memory-empty">Noch keine Erinnerungen gespeichert.</div>'; return; }
      memoryItems.forEach(item => {
        const card = document.createElement('div'); card.className = 'memory-item';
        const content = document.createElement('div'); content.textContent = item.text; card.appendChild(content);
        const actions = document.createElement('div'); actions.className = 'memory-item-actions';
        const edit = document.createElement('button'); edit.className = 'btn secondary'; edit.type = 'button'; edit.textContent = 'Bearbeiten';
        edit.addEventListener('click', () => { editingMemoryId = item.id; document.getElementById('memoryText').value = item.text; document.getElementById('memoryStatus').textContent = 'Erinnerung wird bearbeitet. Speichern überschreibt den Eintrag.'; });
        const remove = document.createElement('button'); remove.className = 'btn secondary'; remove.type = 'button'; remove.textContent = 'Löschen';
        remove.addEventListener('click', async () => { if (!window.confirm('Diese Erinnerung wirklich löschen?')) return; try { memoryItems = await desktopInvoke('delete_memory', {id:item.id}); if (editingMemoryId === item.id) resetMemoryEditor(); renderMemories(); document.getElementById('memoryStatus').textContent = 'Erinnerung gelöscht.'; } catch(error) { document.getElementById('memoryStatus').textContent = 'Löschen fehlgeschlagen: ' + String(error); } });
        actions.append(edit, remove); card.appendChild(actions); list.appendChild(card);
      });
    }
    function resetMemoryEditor() { editingMemoryId = null; document.getElementById('memoryText').value = ''; }
    async function openMemoryManager() {
      memoryModal.classList.add('open'); document.getElementById('memoryStatus').textContent = ''; resetMemoryEditor();
      if (!desktopMode) { document.getElementById('memoryStatus').textContent = 'Das persönliche Gedächtnis ist in dieser Version nur in der Windows-Desktop-App verfügbar.'; memoryItems = []; renderMemories(); return; }
      try { memoryItems = await desktopInvoke('list_memories'); renderMemories(); }
      catch(error) { document.getElementById('memoryStatus').textContent = 'Gedächtnis konnte nicht geladen werden: ' + String(error); }
    }
    document.getElementById('memoryButton').addEventListener('click', openMemoryManager);

    const automationModal = document.getElementById('automationModal');
    const automationIds = ['autoMorning'];
    const automationKeys = ['morningOverview'];
    async function openAutomationManager() {
      automationModal.classList.add('open');
      document.getElementById('automationStatus').textContent = '';
      let saved = {};
      if (desktopMode) {
        try { saved = await desktopInvoke('load_automations'); }
        catch (error) { document.getElementById('automationStatus').textContent = 'Freigaben konnten nicht geladen werden: '+String(error); }
      } else {
        document.getElementById('automationStatus').textContent = 'Vorschau: Freigaben werden hier nicht dauerhaft gespeichert.';
      }
      automationIds.forEach((id,index) => { document.getElementById(id).checked = saved[automationKeys[index]] === true; });
      const schedule = saved.morningSchedule || {};
      document.querySelectorAll('[data-day]').forEach(box => {
        const day = box.dataset.day, enabled = typeof schedule[day] === 'string';
        box.checked = enabled;
        const time = document.querySelector(`[data-time="${day}"]`);
        time.disabled = !enabled;
        if (enabled) time.value = schedule[day];
      });
      updateMorningScheduleAvailability();
    }
    function updateMorningScheduleAvailability() {
      const enabled = document.getElementById('autoMorning').checked;
      document.getElementById('morningSchedulePanel').style.opacity = enabled ? '1' : '.55';
      document.querySelectorAll('[data-day]').forEach(box => {
        box.disabled = !enabled;
        document.querySelector(`[data-time="${box.dataset.day}"]`).disabled = !enabled || !box.checked;
      });
    }
    document.getElementById('autoMorning').addEventListener('change', updateMorningScheduleAvailability);
    document.querySelectorAll('[data-day]').forEach(box => box.addEventListener('change', updateMorningScheduleAvailability));
    document.getElementById('automationButton').addEventListener('click', openAutomationManager);
    document.getElementById('closeAutomationButton').addEventListener('click',()=>automationModal.classList.remove('open'));
    document.getElementById('saveAutomationButton').addEventListener('click',async()=>{
      const status=document.getElementById('automationStatus');
      if(!desktopMode){status.textContent='Bitte die installierte Windows-Desktop-App verwenden, um Freigaben lokal zu speichern.';return;}
      const config={};
      automationIds.forEach((id,index)=>config[automationKeys[index]]=document.getElementById(id).checked);
      config.morningSchedule = {};
      document.querySelectorAll('[data-day]').forEach(box => {
        if (box.checked) config.morningSchedule[box.dataset.day] = document.querySelector(`[data-time="${box.dataset.day}"]`).value || '08:00';
      });
      if (config.morningOverview && Object.keys(config.morningSchedule).length === 0) {
        status.textContent='Bitte wähle mindestens einen Wochentag für den Morgenüberblick aus.'; return;
      }
      try { await desktopInvoke('save_automations',{config}); status.textContent='Deine Freigaben und der Wochenplan wurden lokal auf diesem PC gespeichert.'; }
      catch(error){status.textContent='Speichern fehlgeschlagen: '+String(error);}
    });

    document.getElementById('closeMemoryButton').addEventListener('click', () => memoryModal.classList.remove('open'));
    document.getElementById('cancelMemoryEdit').addEventListener('click', resetMemoryEditor);
    document.getElementById('saveMemoryButton').addEventListener('click', async () => {
      const text = document.getElementById('memoryText').value.trim();
      if (!text) { document.getElementById('memoryStatus').textContent = 'Bitte zuerst einen Erinnerungstext eingeben.'; return; }
      if (!desktopMode) { document.getElementById('memoryStatus').textContent = 'Speichern ist nur in der Windows-Desktop-App verfügbar.'; return; }
      try { memoryItems = await desktopInvoke('save_memory', {id:editingMemoryId, text}); resetMemoryEditor(); renderMemories(); document.getElementById('memoryStatus').textContent = 'Erinnerung lokal gespeichert.'; }
      catch(error) { document.getElementById('memoryStatus').textContent = 'Speichern fehlgeschlagen: ' + String(error); }
    });
