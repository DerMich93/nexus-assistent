/* NEXUS-Oberfläche: Der animierte NEXUS-Kern.
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    let orbState = 'idle', time = 0, width = 0, height = 0, dpr = 1;
    const particles = Array.from({length: 44}, () => ({x: Math.random(), y: Math.random(), r: Math.random()*1.8+.5, v: Math.random()*.0008+.00025, a: Math.random()*.55+.2}));

    function resizeCanvas() {
      const rect = app.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
      canvas.style.width = width+'px'; canvas.style.height = height+'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    new ResizeObserver(resizeCanvas).observe(app);
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function drawOrb() {
      ctx.clearRect(0, 0, width, height);
      time += .03;
      const appRect = app.getBoundingClientRect(), r = frame.getBoundingClientRect();
      const cx = r.left - appRect.left + r.width*.50;
      // The generated otter artwork holds the sphere around this lower-center position.
      const cy = r.top - appRect.top + r.height*.615;
      const baseRadius = Math.min(r.width, r.height)*.112;
      let pulse = Math.sin(time*2)*baseRadius*.035;
      if (orbState === 'speaking') pulse = Math.sin(time*6)*baseRadius*.105;
      if (orbState === 'listening') pulse = Math.sin(time*4)*baseRadius*.075;
      const rad = baseRadius + pulse;

      const glow = ctx.createRadialGradient(cx,cy,rad*.12,cx,cy,rad*2.15);
      glow.addColorStop(0,'rgba(0,255,204,.42)'); glow.addColorStop(.52,'rgba(0,168,150,.18)'); glow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(cx,cy,rad*2.15,0,Math.PI*2); ctx.fillStyle=glow; ctx.fill();

      const core = ctx.createRadialGradient(cx-rad*.3,cy-rad*.32,3,cx,cy,rad);
      if (orbState === 'speaking') {
        core.addColorStop(0,'#ffffff'); core.addColorStop(.28,'#00ffcc'); core.addColorStop(.68,'#d4af37'); core.addColorStop(1,'rgba(0,255,204,.16)');
      } else if (orbState === 'listening') {
        core.addColorStop(0,'#ffffff'); core.addColorStop(.3,'#ffe9a0'); core.addColorStop(.72,'#ff9b35'); core.addColorStop(1,'rgba(212,175,55,.14)');
      } else {
        core.addColorStop(0,'rgba(255,255,255,.98)'); core.addColorStop(.34,'#00ffcc'); core.addColorStop(.76,'#007b83'); core.addColorStop(1,'rgba(0,255,204,.12)');
      }
      ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2); ctx.fillStyle=core; ctx.fill();

      ctx.save(); ctx.translate(cx,cy);
      for(let i=0;i<3;i++) {
        ctx.save(); ctx.rotate(time*(i%2===0?.8:-1.2));
        ctx.beginPath(); ctx.ellipse(0,0,rad*.92,rad*.34,Math.PI/4*i,0,Math.PI*2);
        ctx.strokeStyle=i%2===0?'rgba(255,255,255,.78)':'rgba(0,255,204,.78)';
        ctx.lineWidth=2; ctx.shadowBlur=12; ctx.shadowColor='#00ffcc'; ctx.stroke(); ctx.restore();
      }
      ctx.restore();

      particles.forEach(p=>{
        p.y -= p.v; if(p.y<0) p.y=1;
        const px = r.left-appRect.left + p.x*r.width, py = r.top-appRect.top + p.y*r.height;
        ctx.beginPath(); ctx.arc(px,py,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(0,255,204,${p.a})`; ctx.fill();
      });
      requestAnimationFrame(drawOrb);
    }
    drawOrb();

    // PWA: Offline-Cache und native Installationsaufforderung des Browsers.
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('Service Worker:', err)));
    }
