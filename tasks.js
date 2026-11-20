/* NEXUS-Oberfläche: Aufgaben und Erinnerungen.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    // Aufgaben und Termine: lokal gespeichert, Fälligkeitshinweise nur während die App läuft.
    let taskItems = [], editingTaskId = null;
    const tasksModal = document.getElementById('tasksModal');
    function resetTaskEditor() { editingTaskId = null; document.getElementById('taskTitle').value=''; document.getElementById('taskDue').value=''; document.getElementById('taskRepeat').value='once'; document.querySelectorAll('.task-weekday').forEach(el=>el.checked=false); document.getElementById('weeklyDays').style.display='none'; document.getElementById('taskNotes').value=''; }
    function taskNextOccurrence(task, fromDate) {
      if (!task.dueAt) return null;
      const first = new Date(task.dueAt);
      if (Number.isNaN(first.getTime())) return null;
      const repeat = task.recurrence?.type || 'once';
      if (repeat === 'once') return first;
      const candidate = new Date(fromDate);
      candidate.setSeconds(0,0);
      if (candidate < first) return first;
      const dueMinutes = first.getHours()*60 + first.getMinutes();
      for (let offset=0; offset<=370; offset++) {
        const day = new Date(candidate.getFullYear(),candidate.getMonth(),candidate.getDate()+offset,first.getHours(),first.getMinutes(),0,0);
        if (day < first) continue;
        if (repeat==='daily') return day;
        if (repeat==='weekly') {
          const days=Array.isArray(task.recurrence?.weekdays)?task.recurrence.weekdays:[];
          if (days.includes(day.getDay())) return day;
        }
        if (repeat==='monthly' && day.getDate()===first.getDate()) return day;
      }
      return null;
    }
    function renderReminderOverview() {
      const host=document.getElementById('reminderOverviewContent');
      if(!host)return;
      host.innerHTML='';
      const now=new Date(), todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      const overdue=[], due=[], upcoming=[];
      for(const task of taskItems) {
        if(task.done || !task.dueAt) continue;
        const first=new Date(task.dueAt);
        if(Number.isNaN(first.getTime())) continue;
        const repeat=task.recurrence?.type||'once';
        if(repeat==='once' && first<now) { overdue.push({task,date:first}); continue; }
        const next=taskNextOccurrence(task,now);
        if(!next) continue;
        if(next.toDateString()===now.toDateString() && next<=now) due.push({task,date:next});
        else if(next>=now && next<=new Date(now.getTime()+7*86400000)) upcoming.push({task,date:next});
      }
      const sections=[
        {title:'Jetzt fällig',items:due,empty:'Im Moment ist nichts fällig.'},
        {title:'Demnächst (7 Tage)',items:upcoming,empty:'Keine Erinnerungen in den nächsten 7 Tagen.'},
        {title:'Überfällig',items:overdue,empty:'Keine überfälligen einmaligen Aufgaben.'}
      ];
      for(const section of sections) {
        const block=document.createElement('div'); block.style.marginBottom='12px';
        const heading=document.createElement('strong'); heading.textContent=section.title+' · '+section.items.length; block.appendChild(heading);
        if(!section.items.length) { const p=document.createElement('div');p.className='memory-empty';p.textContent=section.empty;block.appendChild(p); }
        else {
          section.items.sort((a,b)=>a.date-b.date);
          for(const item of section.items) {
            const line=document.createElement('div');line.className='memory-item';
            const title=document.createElement('strong');title.textContent=item.task.title;line.appendChild(title);
            const when=document.createElement('div');when.style.opacity='.75';when.textContent=item.date.toLocaleString('de-DE');line.appendChild(when);
            block.appendChild(line);
          }
        }
        host.appendChild(block);
      }
    }
    function renderTasks() {
      renderReminderOverview();
      const list=document.getElementById('tasksList'); list.innerHTML='';
      if (!taskItems.length) { list.innerHTML='<div class="memory-empty">Noch keine Aufgaben angelegt.</div>'; return; }
      const sorted=[...taskItems].sort((a,b)=>Number(!!a.done)-Number(!!b.done) || ((a.dueAt||'').localeCompare(b.dueAt||'')));
      sorted.forEach(task=>{
        const card=document.createElement('div'); card.className='memory-item';
        const heading=document.createElement('strong'); heading.textContent=(task.done?'✓ ':'')+task.title; if(task.done) heading.style.textDecoration='line-through'; card.appendChild(heading);
        if(task.dueAt){const due=document.createElement('div');due.style.opacity='.75';due.style.marginTop='5px';const date=new Date(task.dueAt);due.textContent='Fällig: '+(Number.isNaN(date.getTime())?task.dueAt:date.toLocaleString('de-DE'));card.appendChild(due);}
        const repeatLabel={daily:'Täglich',weekly:'Wöchentlich',monthly:'Monatlich'}[task.recurrence?.type];if(repeatLabel){const repeat=document.createElement('div');repeat.style.opacity='.75';repeat.style.marginTop='3px';const names=['So','Mo','Di','Mi','Do','Fr','Sa'];const days=Array.isArray(task.recurrence?.weekdays)?[...task.recurrence.weekdays].sort((a,b)=>a-b):[];repeat.textContent='Wiederholung: '+repeatLabel+(task.recurrence?.type==='weekly'&&days.length?' ('+days.map(d=>names[d]).join(', ')+')':'');card.appendChild(repeat);}if(task.notes){const note=document.createElement('div');note.style.marginTop='5px';note.textContent=task.notes;card.appendChild(note);}
        const actions=document.createElement('div');actions.className='memory-item-actions';
        const toggle=document.createElement('button');toggle.className='btn secondary';toggle.textContent=task.done?'Wieder öffnen':'Erledigt';toggle.addEventListener('click',async()=>{try{taskItems=await desktopInvoke('set_task_done',{id:task.id,done:!task.done});renderTasks();}catch(e){document.getElementById('tasksStatus').textContent=String(e);}});
        const edit=document.createElement('button');edit.className='btn secondary';edit.textContent='Bearbeiten';edit.addEventListener('click',()=>{editingTaskId=task.id;document.getElementById('taskTitle').value=task.title||'';document.getElementById('taskNotes').value=task.notes||'';document.getElementById('taskRepeat').value=task.recurrence?.type||'once';document.querySelectorAll('.task-weekday').forEach(el=>el.checked=Array.isArray(task.recurrence?.weekdays)&&task.recurrence.weekdays.includes(Number(el.value)));document.getElementById('weeklyDays').style.display=task.recurrence?.type==='weekly'?'block':'none';const localDue=task.dueAt?new Date(task.dueAt):null; if(localDue){localDue.setMinutes(localDue.getMinutes()-localDue.getTimezoneOffset());document.getElementById('taskDue').value=localDue.toISOString().slice(0,16);}else{document.getElementById('taskDue').value='';}document.getElementById('tasksStatus').textContent='Aufgabe wird bearbeitet.';});
        const del=document.createElement('button');del.className='btn secondary';del.textContent='Löschen';del.addEventListener('click',async()=>{if(!confirm('Diese Aufgabe wirklich löschen?'))return;try{taskItems=await desktopInvoke('delete_task',{id:task.id});renderTasks();}catch(e){document.getElementById('tasksStatus').textContent=String(e);}});
        actions.append(toggle,edit,del);card.appendChild(actions);list.appendChild(card);
      });
    }
    async function openTasks(){tasksModal.classList.add('open');document.getElementById('tasksStatus').textContent='';resetTaskEditor();if(!desktopMode){document.getElementById('tasksStatus').textContent='Aufgaben sind nur in der Windows-Desktop-App verfügbar.';return;}try{taskItems=await desktopInvoke('list_tasks');renderTasks();}catch(e){document.getElementById('tasksStatus').textContent='Aufgaben konnten nicht geladen werden: '+String(e);}}
    document.getElementById('tasksButton').addEventListener('click',openTasks);
    document.getElementById('closeTasksButton').addEventListener('click',()=>tasksModal.classList.remove('open'));
    document.getElementById('resetTaskButton').addEventListener('click',()=>{resetTaskEditor();document.getElementById('tasksStatus').textContent='';});
    document.getElementById('saveTaskButton').addEventListener('click',async()=>{
      const title=document.getElementById('taskTitle').value.trim(),notes=document.getElementById('taskNotes').value.trim(),due=document.getElementById('taskDue').value;
      const repeatType=document.getElementById('taskRepeat').value;
      const weekdays=[...document.querySelectorAll('.task-weekday:checked')].map(el=>Number(el.value));
      if(!title){document.getElementById('tasksStatus').textContent='Bitte eine Aufgabe eingeben.';return;}
      if(repeatType!=='once'&&!due){document.getElementById('tasksStatus').textContent='Bitte eine erste Fälligkeit mit Datum und Uhrzeit festlegen.';return;}
      if(repeatType==='weekly'&&!weekdays.length){document.getElementById('tasksStatus').textContent='Bitte mindestens einen Wochentag auswählen.';return;}
      if(!desktopMode){document.getElementById('tasksStatus').textContent='Speichern ist nur in der Windows-Desktop-App verfügbar.';return;}
      const recurrence=repeatType==='once'?null:{type:repeatType,weekdays:repeatType==='weekly'?weekdays:[]};
      try{taskItems=await desktopInvoke('save_task',{id:editingTaskId,title,notes,dueAt:due?new Date(due).toISOString():null,recurrence});resetTaskEditor();renderTasks();document.getElementById('tasksStatus').textContent='Aufgabe lokal gespeichert.';}catch(e){document.getElementById('tasksStatus').textContent='Speichern fehlgeschlagen: '+String(e);}
    });
    document.getElementById('taskRepeat').addEventListener('change',()=>{document.getElementById('weeklyDays').style.display=document.getElementById('taskRepeat').value==='weekly'?'block':'none';});
    const notifiedTaskOccurrences=new Set();
    function dueOccurrence(task, now) {
      if(!task.dueAt)return null;
      const due=new Date(task.dueAt); if(Number.isNaN(due.getTime()))return null;
      const repeat=task.recurrence?.type||'once';
      const todayKey=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      const dueKey=[due.getFullYear(),String(due.getMonth()+1).padStart(2,'0'),String(due.getDate()).padStart(2,'0')].join('-');
      const nowMinutes=now.getHours()*60+now.getMinutes(), dueMinutes=due.getHours()*60+due.getMinutes();
      if(repeat==='once')return due.getTime()<=now.getTime()?{key:'once',overdue:dueKey<todayKey}:null;
      if(dueKey>todayKey||nowMinutes<dueMinutes)return null;
      if(repeat==='daily')return {key:todayKey,overdue:dueKey<todayKey};
      if(repeat==='weekly'&&Array.isArray(task.recurrence?.weekdays)&&task.recurrence.weekdays.includes(now.getDay()))return {key:todayKey,overdue:false};
      if(repeat==='monthly'&&now.getDate()===due.getDate())return {key:todayKey,overdue:false};
      return null;
    }
    async function checkDueTasks(){if(!desktopMode)return;try{taskItems=await desktopInvoke('list_tasks');const now=new Date();for(const task of taskItems){if(task.done)continue;const occurrence=dueOccurrence(task,now);if(!occurrence)continue;const key=task.id+':'+occurrence.key;if(notifiedTaskOccurrences.has(key))continue;notifiedTaskOccurrences.add(key);const notice=(occurrence.overdue?'Überfällige Erinnerung: ':'Erinnerung: ')+task.title;statusText.textContent=notice;addMessage(notice,'nexus');notifyNative('NEXUS Erinnerung',notice);const status=document.getElementById('tasksStatus');if(tasksModal.classList.contains('open'))status.textContent=notice;}}catch(_){}}
    setInterval(checkDueTasks,30000);
    setTimeout(checkDueTasks,5000);
