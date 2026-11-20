/* NEXUS-Oberfläche: Sicherungs-Fenster (manuelle, passwortgeschützte Datensicherung).
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    const backupModal = document.getElementById('backupModal');
    document.getElementById('backupButton').addEventListener('click',()=>{
      backupModal.classList.add('open');
      document.getElementById('backupStatus').textContent = desktopMode ? 'Sicherungen werden lokal auf deinem PC erstellt.' : 'Datensicherung ist nur in der Windows-Desktop-App verfügbar.';
    });
    document.getElementById('closeBackupButton').addEventListener('click',()=>backupModal.classList.remove('open'));
    document.getElementById('createBackupButton').addEventListener('click',async()=>{
      const status=document.getElementById('backupStatus');
      const password=document.getElementById('backupPassword').value;
      const confirmPassword=document.getElementById('backupPasswordConfirm').value;
      if(!desktopMode){status.textContent='Bitte die installierte Windows-Desktop-App verwenden.';return;}
      if(password.length<12){status.textContent='Bitte ein Sicherungspasswort mit mindestens 12 Zeichen eingeben.';return;}
      if(password!==confirmPassword){status.textContent='Die beiden Passwörter stimmen nicht überein.';return;}
      status.textContent='Verschlüsselte Sicherung wird erstellt ...';
      try{const result=await desktopInvoke('create_backup',{password});status.textContent=result==='abgebrochen'?'Vorgang abgebrochen.':'Verschlüsselte Sicherung erstellt: '+result;}
      catch(error){status.textContent='Sicherung fehlgeschlagen: '+String(error);}
      finally{document.getElementById('backupPassword').value='';document.getElementById('backupPasswordConfirm').value='';}
    });
    document.getElementById('restoreBackupButton').addEventListener('click',async()=>{
      const status=document.getElementById('backupStatus');
      const password=document.getElementById('restoreBackupPassword').value;
      if(!desktopMode){status.textContent='Bitte die installierte Windows-Desktop-App verwenden.';return;}
      if(!window.confirm('Achtung: Die aktuellen NEXUS-Einstellungen, Aufgaben, Gespräche und Erinnerungen werden durch den Sicherungsstand ersetzt. Fortfahren?'))return;
      status.textContent='Sicherung wird geprüft und wiederhergestellt ...';
      try{const result=await desktopInvoke('restore_backup',{password});status.textContent=result==='abgebrochen'?'Vorgang abgebrochen.':result;}
      catch(error){status.textContent='Wiederherstellung fehlgeschlagen: '+String(error);}
      finally{document.getElementById('restoreBackupPassword').value='';}
    });
