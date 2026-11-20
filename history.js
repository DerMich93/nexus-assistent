/* NEXUS-Oberfläche: Gesprächsverlauf.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    let currentConversationId = null;
    let currentMessages = [{sender:'nexus', text:'Guten Tag. Ich bin Nexus. Wie darf ich Ihnen behilflich sein?'}];
    function addMessage(text, sender, persist=true) {
      const box = document.getElementById('chatBox'), msg = document.createElement('div');
      msg.className = `message ${sender}`; msg.textContent = text; box.appendChild(msg); box.scrollTop = box.scrollHeight;
      if (persist) { currentMessages.push({sender, text, createdAt: new Date().toISOString()}); }
    }
    async function persistConversation() {
      if (!desktopMode || !currentMessages.length) return;
      try {
        const firstUser = currentMessages.find(m => m.sender === 'user');
        const title = firstUser ? firstUser.text.slice(0, 72) : 'Neue Unterhaltung';
        const saved = await desktopInvoke('save_conversation', {conversationId: currentConversationId, title, messages: currentMessages});
        currentConversationId = saved.id;
      } catch (error) { document.getElementById('statusText').textContent = 'Gespräch konnte nicht gespeichert werden'; }
    }
    async function openHistory() {
      document.getElementById('historyModal').classList.add('open');
      await renderHistory();
    }
    async function renderHistory() {
      const list = document.getElementById('historyList'); list.innerHTML = '';
      if (!desktopMode) { list.textContent = 'Der Gesprächsverlauf ist nur in der Windows-Desktop-App verfügbar.'; return; }
      try {
        const conversations = await desktopInvoke('list_conversations');
        const term = document.getElementById('historySearch').value.trim().toLocaleLowerCase();
        const filtered = conversations.filter(c => (c.title || '').toLocaleLowerCase().includes(term) || (c.messages || []).some(m => (m.text || '').toLocaleLowerCase().includes(term)));
        if (!filtered.length) { list.innerHTML = '<div class="memory-empty">Keine passenden Gespräche gefunden.</div>'; return; }
        filtered.sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        filtered.forEach(c => {
          const card=document.createElement('div'); card.className='memory-item';
          const heading=document.createElement('strong'); heading.textContent=c.title || 'Unterhaltung'; card.appendChild(heading);
          const meta=document.createElement('div'); meta.style.opacity='.7'; meta.style.marginTop='5px'; meta.textContent=`${(c.messages || []).length} Nachrichten · ${c.updatedAt ? new Date(Number(c.updatedAt) * 1000).toLocaleString('de-DE') : ''}`; card.appendChild(meta);
          const preview=document.createElement('div'); preview.style.marginTop='6px'; preview.textContent=((c.messages || []).slice(-1)[0] || {}).text || ''; card.appendChild(preview);
          const actions=document.createElement('div'); actions.className='memory-item-actions';
          const open=document.createElement('button'); open.className='btn'; open.textContent='Öffnen'; open.addEventListener('click',()=>restoreConversation(c));
          const del=document.createElement('button'); del.className='btn secondary'; del.textContent='Löschen'; del.addEventListener('click',async()=>{if(!confirm('Diese Unterhaltung wirklich löschen?'))return; await desktopInvoke('delete_conversation',{id:c.id}); await renderHistory();});
          actions.append(open,del); card.appendChild(actions); list.appendChild(card);
        });
      } catch(error) { list.textContent='Gesprächsverlauf konnte nicht geladen werden: '+String(error); }
    }
    function restoreConversation(conversation) {
      currentConversationId=conversation.id; currentMessages=conversation.messages || [];
      const box=document.getElementById('chatBox'); box.innerHTML='';
      currentMessages.forEach(m=>addMessage(m.text || '',m.sender || 'nexus',false));
      document.getElementById('historyModal').classList.remove('open');
      document.getElementById('statusText').textContent='Gespräch geladen';
    }
    document.getElementById('historyButton').addEventListener('click',openHistory);
    document.getElementById('closeHistoryButton').addEventListener('click',()=>document.getElementById('historyModal').classList.remove('open'));
    document.getElementById('historySearch').addEventListener('input',renderHistory);
    document.getElementById('clearHistoryButton').addEventListener('click',async()=>{if(!desktopMode)return;if(!confirm('Wirklich alle gespeicherten Gespräche endgültig löschen?'))return;try{await desktopInvoke('clear_conversations');if(currentConversationId){currentConversationId=null;currentMessages=[{sender:'nexus',text:'Guten Tag. Ich bin Nexus. Wie darf ich Ihnen behilflich sein?'}];const box=document.getElementById('chatBox');box.innerHTML='';addMessage(currentMessages[0].text,'nexus',false);}await renderHistory();document.getElementById('historyStatus').textContent='Alle Gespräche wurden gelöscht.';}catch(e){document.getElementById('historyStatus').textContent=String(e);}});
