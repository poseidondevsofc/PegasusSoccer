/* game.js - Pegasus Soccer (final)
   Single-key cheats: press '1' -> cheat 1, '2' -> cheat 2, etc.
   Cheats activate only if token present in localStorage 'pegasus_dev_token' OR if activated via window.__pegasusActivate(token).
   Token (keep secret): bb30490eb73240408a4736cc4c775f7c
*/

(function(){
  // ---- Config ----
  const TOKEN = 'bb30490eb73240408a4736cc4c775f7c';
  const DEV_CHEAT_ALWAYS = false; // set true if you want single-key cheats available to anyone (not recommended)

  // ---- Canvas setup ----
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = 900 * DPR;
  canvas.height = 600 * DPR;
  ctx.scale(DPR, DPR);

  const FIELD = {w:900, h:600};

  // ---- Game state ----
  let ball = {x: FIELD.w/2, y: FIELD.h/2, r:14, dx:0, dy:0};
  let players = [{x:200, y:FIELD.h/2, r:28, color:'#00eaff', id:0}, {x:700, y:FIELD.h/2, r:28, color:'#ff6aa3', id:1}];
  let turn = 0;
  let scores = [0,0];
  let isDragging = false;
  let dragPlayer = null;
  let particles = [];
  let muted = false;

  // ---- Cheat state ----
  let __cheatEnabled = false;
  let opponentFrozenUntil = 0;
  let timeStoppedUntil = 0;

  // ---- UI ----
  const startBtn = document.getElementById('startBtn');
  const splash = document.getElementById('splash');
  const uiRoot = document.getElementById('ui');
  const scoreEl = document.getElementById('score');
  const turnEl = document.getElementById('turn');
  const hint = document.getElementById('hint');
  const restartBtn = document.getElementById('restartBtn');
  const muteBtn = document.getElementById('muteBtn');
  const helpOverlay = document.getElementById('help');
  const closeHelp = document.getElementById('closeHelp');

  function safeAddListener(el, ev, fn){ if(el) el.addEventListener(ev, fn); }

  // ---- Sounds ----
  function playSound(type='kick'){ if(muted) return; try{ const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); const g = a.createGain(); o.type = type==='kick'?'sine':'triangle'; o.frequency.setValueAtTime(type==='goal'?880:Math.random()*200+200,a.currentTime); g.gain.setValueAtTime(0.0001,a.currentTime); g.gain.exponentialRampToValueAtTime(0.12,a.currentTime+0.01); g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+0.3); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime+0.35);}catch(e){} }

  // ---- Drawing ----
  function drawField(){ ctx.clearRect(0,0,FIELD.w,FIELD.h); ctx.fillStyle='#054a2d'; ctx.fillRect(0,0,FIELD.w,FIELD.h); ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(FIELD.w/2,0); ctx.lineTo(FIELD.w/2,FIELD.h); ctx.stroke(); ctx.beginPath(); ctx.arc(FIELD.w/2, FIELD.h/2, 70, 0, Math.PI*2); ctx.stroke(); }
  function drawBall(){ const g = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r*3); g.addColorStop(0,'rgba(255,255,255,0.95)'); g.addColorStop(0.2,'rgba(255,255,255,0.8)'); g.addColorStop(0.6,'rgba(0,234,255,0.08)'); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r*2.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.stroke(); }
  function drawPlayers(){ players.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.stroke(); }); }
  function spawnParticles(x,y,count=12){ for(let i=0;i<count;i++){ particles.push({x,y,vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, life:60}); } }
  function updateParticles(){ particles = particles.filter(p=>p.life>0); particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.life--; }); }
  function drawParticles(){ particles.forEach(p=>{ const alpha=Math.max(0,p.life/60); ctx.beginPath(); ctx.fillStyle=`rgba(0,234,255,${alpha})`; ctx.arc(p.x,p.y,Math.max(1,3*alpha),0,Math.PI*2); ctx.fill(); }); }

  // ---- Physics ----
  function physicsStep(){ const now=performance.now()/1000; if(now < timeStoppedUntil) return; ball.x += ball.dx; ball.y += ball.dy; ball.dx *= 0.985; ball.dy *= 0.985; if(Math.abs(ball.dx)<0.02) ball.dx=0; if(Math.abs(ball.dy)<0.02) ball.dy=0; if(ball.x < ball.r){ ball.x = ball.r; ball.dx = Math.abs(ball.dx)*0.6; } if(ball.x > FIELD.w - ball.r){ ball.x = FIELD.w - ball.r; ball.dx = -Math.abs(ball.dx)*0.6; } if(ball.y < ball.r){ ball.y = ball.r; ball.dy = Math.abs(ball.dy)*0.6; } if(ball.y > FIELD.h - ball.r){ ball.y = FIELD.h - ball.r; ball.dy = -Math.abs(ball.dy)*0.6; } players.forEach(p=>{ const dx = ball.x - p.x; const dy = ball.y - p.y; const dist = Math.hypot(dx,dy); if(dist < ball.r + p.r){ const nx = dx/dist, ny = dy/dist; const relSpeed = ball.dx*nx + ball.dy*ny; ball.dx = (ball.dx - 2*relSpeed*nx) + nx*4; ball.dy = (ball.dy - 2*relSpeed*ny) + ny*4; spawnParticles(ball.x, ball.y, 8); } }); const goalSize = 160; if(ball.x < 0 && Math.abs(ball.y - FIELD.h/2) < goalSize/2){ scores[1]++; onGoal(2); } else if(ball.x > FIELD.w && Math.abs(ball.y - FIELD.h/2) < goalSize/2){ scores[0]++; onGoal(1); } }

  function onGoal(playerNum){ playSound('goal'); resetPositions(); updateUI(); spawnParticles(FIELD.w/2, FIELD.h/2, 40); }

  function resetPositions(){ ball.x = FIELD.w/2; ball.y = FIELD.h/2; ball.dx = 0; ball.dy = 0; players[0].x = 200; players[0].y = FIELD.h/2; players[1].x = 700; players[1].y = FIELD.h/2; turn = 0; }

  // ---- Render loop ----
  let rafId = null;
  function render(){ drawField(); drawParticles(); drawPlayers(); drawBall(); updateUI(); updateParticles(); rafId = requestAnimationFrame(render); }

  // ---- Input ----
  function posFromEvent(e){ const rect = canvas.getBoundingClientRect(); const clientX = (e.touches ? e.touches[0].clientX : e.clientX); const clientY = (e.touches ? e.touches[0].clientY : e.clientY); return {x: clientX - rect.left, y: clientY - rect.top}; }

  safeAddListener(canvas,'mousedown', e=>{ const p = players[turn]; const pos = posFromEvent(e); const d = Math.hypot(pos.x - p.x, pos.y - p.y); if(d < p.r + 6){ isDragging = true; dragPlayer = p; } });
  safeAddListener(window,'mouseup', e=>{ if(!isDragging) return; isDragging = false; const p = dragPlayer; const pos = posFromEvent(e); const power = 0.18; const vx = (p.x - pos.x) * power; const vy = (p.y - pos.y) * power; ball.dx += vx; ball.dy += vy; spawnParticles(ball.x, ball.y, 12); playSound('kick'); turn = (turn + 1) % 2; dragPlayer = null; updateUI(); });

  safeAddListener(canvas,'touchstart', e=>{ e.preventDefault(); const ev = new MouseEvent('mousedown', {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY}); canvas.dispatchEvent(ev); });
  safeAddListener(canvas,'touchend', e=>{ const ev = new MouseEvent('mouseup', {}); window.dispatchEvent(ev); });

  // ---- Simple AI ----
  function aiStep(){ const now=performance.now()/1000; if(turn === 1){ if(now < opponentFrozenUntil) return; const p = players[1]; const dx = ball.x - p.x; const dy = ball.y - p.y; const dist = Math.hypot(dx,dy); if(dist > 120){ p.x += Math.sign(dx) * 2; p.y += Math.sign(dy) * 1.2; } else { const power = 0.15; ball.dx += (FIELD.w*0.5 - ball.x) * power * 0.02; ball.dy += (FIELD.h/2 - ball.y) * power * 0.02; spawnParticles(ball.x, ball.y, 10); playSound('kick'); turn = 0; } } }

  // ---- UI wiring ----
  safeAddListener(startBtn,'click', ()=>{ startGame(); });
  safeAddListener(restartBtn,'click', ()=>{ scores = [0,0]; resetPositions(); updateUI(); });
  safeAddListener(muteBtn,'click', ()=>{ muted = !muted; muteBtn.textContent = muted ? '🔈' : '🔊'; });
  safeAddListener(closeHelp,'click', ()=>{ helpOverlay.classList.add('hidden'); helpOverlay.setAttribute('aria-hidden','true'); });
  safeAddListener(window,'keydown', (e)=>{ if(e.key.toLowerCase()==='h') { helpOverlay.classList.remove('hidden'); helpOverlay.setAttribute('aria-hidden','false'); } });

  function startGame(){ if(splash) splash.classList.add('hidden'); if(uiRoot) uiRoot.classList.remove('hidden'); uiRoot.setAttribute('aria-hidden','false'); // start loops if not already started
    if(!render.started){ render.started = true; render(); }
    if(!physics.started){ physics.started = true; setInterval(physicsStep,16); }
    if(!aiLoop.started){ aiLoop.started = true; setInterval(aiStep,600); }
  }

  // ---- UI update ----
  function updateUI(){ scoreEl.textContent = scores[0] + ' - ' + scores[1]; turnEl.textContent = (turn+1); }

  // ---- Cheats API ----
  function enableCheats(){ __cheatEnabled = true; console.log('PegasusCheats enabled'); }
  function freezeOpponent(seconds){ opponentFrozenUntil = performance.now()/1000 + Number(seconds || 30); console.log('Opponent frozen until', new Date(opponentFrozenUntil*1000).toLocaleTimeString()); }
  function stopTime(seconds){ timeStoppedUntil = performance.now()/1000 + Number(seconds || 10); console.log('Time stopped until', new Date(timeStoppedUntil*1000).toLocaleTimeString()); }

  window.__pegasusCheat = function(cmd,arg){ if(!__cheatEnabled) return console.warn('Cheats not enabled. Activate with window.__pegasusActivate(token) or set token in localStorage.'); if(cmd==='freezeOpponent') freezeOpponent(arg||30); if(cmd==='stopTime') stopTime(arg||10); if(cmd==='toggle') __cheatEnabled = !__cheatEnabled; if(cmd==='status') console.log({cheats:__cheatEnabled, opponentFrozenUntil, timeStoppedUntil}); };

  window.__pegasusActivate = function(token){ try{ if(token && token.toString() === TOKEN){ enableCheats(); // also persist flag if desired localStorage.setItem('pegasus_cheats_active','1'); return console.log('Activated cheats.'); } console.warn('Invalid token'); }catch(e){console.error(e);} };

  // Allow activation if token stored in localStorage
  (function(){ try{ const stored = localStorage.getItem('pegasus_dev_token'); if(stored && stored === TOKEN){ enableCheats(); console.log('Cheats auto-enabled from localStorage.'); } }catch(e){} })();

  // ---- Single-key cheat mapping ----
  // Map number keys to cheats: '1' -> freezeOpponent(30), '2' -> stopTime(10), '3' -> toggle cheats, '4' -> status
  safeAddListener(window,'keydown', (e)=>{ if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return; // ignore typing in inputs
    const key = e.key; // '1','2',...
    if(key === '1'){ // cheat 1
      if(DEV_CHEAT_ALWAYS || __cheatEnabled){ freezeOpponent(30); console.log('Cheat 1 executed: freezeOpponent(30)'); }
      else { const stored = localStorage.getItem('pegasus_dev_token'); if(stored && stored === TOKEN){ enableCheats(); freezeOpponent(30); console.log('Cheat 1 executed (via localStorage): freezeOpponent(30)'); } } 
    } else if(key === '2'){ if(DEV_CHEAT_ALWAYS || __cheatEnabled){ stopTime(10); console.log('Cheat 2 executed: stopTime(10)'); } else { const stored = localStorage.getItem('pegasus_dev_token'); if(stored && stored === TOKEN){ enableCheats(); stopTime(10); console.log('Cheat 2 executed (via localStorage): stopTime(10)'); } } 
    } else if(key === '3'){ if(DEV_CHEAT_ALWAYS || __cheatEnabled){ __cheatEnabled = !__cheatEnabled; console.log('Cheats toggled ->',__cheatEnabled); } else { const stored = localStorage.getItem('pegasus_dev_token'); if(stored && stored === TOKEN){ enableCheats(); __cheatEnabled = !__cheatEnabled; console.log('Cheats toggled (via localStorage) ->',__cheatEnabled); } } 
    } else if(key === '4'){ if(DEV_CHEAT_ALWAYS || __cheatEnabled) console.log({cheats:__cheatEnabled, opponentFrozenUntil, timeStoppedUntil}); else { const stored = localStorage.getItem('pegasus_dev_token'); if(stored && stored === TOKEN){ enableCheats(); console.log({cheats:__cheatEnabled, opponentFrozenUntil, timeStoppedUntil}); } } }
  });

  // ---- Misc ----
  function aiLoop(){} // placeholder

  // initial UI update
  updateUI();

})();
