/* game.js - Pegasus Soccer (professional neon)
   Includes hidden developer-only cheats.
   To enable cheats, open console and run:
     window.__pegasusActivate('bb30490eb73240408a4736cc4c775f7c');
   Then call:
     window.__pegasusCheat('freezeOpponent', 30);
     window.__pegasusCheat('stopTime', 10);
*/

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = 900 * DPR;
  canvas.height = 600 * DPR;
  ctx.scale(DPR, DPR);

  // Game state
  const FIELD = {w:900, h:600};
  const ball = {x: FIELD.w/2, y: FIELD.h/2, r:14, dx:0, dy:0};
  const players = [
    {x:200, y:FIELD.h/2, r:28, color:'#00eaff', id:0}, // player 1 (you)
    {x:700, y:FIELD.h/2, r:28, color:'#ff6aa3', id:1}  // player 2 (opponent)
  ];
  let turn = 0;
  let scores = [0,0];
  let isDragging = false;
  let dragPlayer = null;
  let dragStart = {x:0,y:0};
  let particles = [];
  let muted = false;

  // Cheat state (hidden)
  let __cheatEnabled = false;
  let opponentFrozenUntil = 0;
  let timeStoppedUntil = 0;

  // UI refs
  const ui = {
    startBtn: document.getElementById('startBtn'),
    splash: document.getElementById('splash'),
    uiRoot: document.getElementById('ui'),
    scoreEl: document.getElementById('score'),
    turnEl: document.getElementById('turn'),
    hint: document.getElementById('hint'),
    restartBtn: document.getElementById('restartBtn'),
    muteBtn: document.getElementById('muteBtn'),
    help: document.getElementById('help'),
    closeHelp: document.getElementById('closeHelp')
  };

  function playSound(type='kick') {
    if(muted) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type === 'kick' ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(type==='goal'?880: Math.random()*200 + 200, ctx.currentTime);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  }

  function drawField() {
    // Simple stylized field
    ctx.clearRect(0,0,FIELD.w,FIELD.h);
    ctx.fillStyle = '#054a2d';
    ctx.fillRect(0,0,FIELD.w,FIELD.h);
    // center line and circles
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(FIELD.w/2, 0);
    ctx.lineTo(FIELD.w/2, FIELD.h);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(FIELD.w/2, FIELD.h/2, 70, 0, Math.PI*2);
    ctx.stroke();
  }

  function drawBall() {
    // glow
    const g = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r*3);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.6, 'rgba(0,234,255,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r*2.2, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.stroke();
  }

  function drawPlayers() {
    players.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.stroke();
    });
  }

  function spawnParticles(x,y,count=12) {
    for(let i=0;i<count;i++) {
      particles.push({x,y,vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, life:60});
    }
  }

  function updateParticles() {
    particles = particles.filter(p=>p.life>0);
    particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.life--; });
  }

  function drawParticles() {
    particles.forEach(p=>{
      const alpha = Math.max(0, p.life/60);
      ctx.beginPath();
      ctx.fillStyle = `rgba(0,234,255,${alpha})`;
      ctx.arc(p.x,p.y, Math.max(1, 3*alpha), 0, Math.PI*2);
      ctx.fill();
    });
  }

  function physicsStep() {
    const now = performance.now()/1000;
    if(now < timeStoppedUntil) return; // time frozen

    ball.x += ball.dx;
    ball.y += ball.dy;
    ball.dx *= 0.985;
    ball.dy *= 0.985;
    if(Math.abs(ball.dx)<0.02) ball.dx=0;
    if(Math.abs(ball.dy)<0.02) ball.dy=0;

    // wall collisions
    if(ball.x < ball.r){ ball.x = ball.r; ball.dx = Math.abs(ball.dx)*0.6; }
    if(ball.x > FIELD.w - ball.r){ ball.x = FIELD.w - ball.r; ball.dx = -Math.abs(ball.dx)*0.6; }
    if(ball.y < ball.r){ ball.y = ball.r; ball.dy = Math.abs(ball.dy)*0.6; }
    if(ball.y > FIELD.h - ball.r){ ball.y = FIELD.h - ball.r; ball.dy = -Math.abs(ball.dy)*0.6; }

    // simple player-ball collision
    players.forEach(p=>{
      const dx = ball.x - p.x;
      const dy = ball.y - p.y;
      const dist = Math.hypot(dx,dy);
      if(dist < ball.r + p.r){ // collision
        const nx = dx/dist, ny = dy/dist;
        const relSpeed = ball.dx*nx + ball.dy*ny;
        ball.dx = (ball.dx - 2*relSpeed*nx) + nx*4;
        ball.dy = (ball.dy - 2*relSpeed*ny) + ny*4;
        spawnParticles(ball.x, ball.y, 8);
      }
    });

    // goal detection (simple)
    const goalSize = 160;
    if(ball.x < 0 && Math.abs(ball.y - FIELD.h/2) < goalSize/2){ // left goal (player2 scores)
      scores[1]++;
      onGoal(2);
    } else if(ball.x > FIELD.w && Math.abs(ball.y - FIELD.h/2) < goalSize/2){ // right goal
      scores[0]++;
      onGoal(1);
    }
  }

  function onGoal(playerNum) {
    playSound('goal');
    resetPositions();
    updateUI();
    spawnParticles(FIELD.w/2, FIELD.h/2, 40);
  }

  function resetPositions() {
    ball.x = FIELD.w/2; ball.y = FIELD.h/2; ball.dx = 0; ball.dy = 0;
    players[0].x = 200; players[0].y = FIELD.h/2;
    players[1].x = 700; players[1].y = FIELD.h/2;
    turn = 0;
  }

  // Rendering
  function draw(){
    drawField();
    drawParticles();
    drawPlayers();
    drawBall();
    updateUI();
    updateParticles();
    requestAnimationFrame(draw);
  }

  // Input handling (mouse + touch)
  function posFromEvent(e){
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
    const clientY = (e.touches ? e.touches[0].clientY : e.clientY);
    return {x: clientX - rect.left, y: clientY - rect.top};
  }

  canvas.addEventListener('mousedown', e=>{
    const p = players[turn];
    const pos = posFromEvent(e);
    const d = Math.hypot(pos.x - p.x, pos.y - p.y);
    if(d < p.r + 6){ isDragging = true; dragPlayer = p; dragStart = pos; }
  });
  canvas.addEventListener('touchstart', e=>{ e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mousedown', e)); });

  window.addEventListener('mouseup', e=>{
    if(!isDragging) return;
    isDragging = false;
    const p = dragPlayer;
    const pos = posFromEvent(e);
    // calculate power and set ball velocity
    const power = 0.18;
    const vx = (p.x - pos.x) * power;
    const vy = (p.y - pos.y) * power;
    ball.dx += vx; ball.dy += vy;
    spawnParticles(ball.x, ball.y, 12);
    playSound('kick');
    // after shot, change turn
    turn = (turn + 1) % 2;
    dragPlayer = null;
    updateUI();
  });

  // simple AI for opponent when it's their turn (if not frozen)
  function aiStep(){
    const now = performance.now()/1000;
    if(turn === 1){
      if(now < opponentFrozenUntil) return; // frozen, skip turn
      // basic behavior: move near ball then kick toward goal
      const p = players[1];
      const dx = ball.x - p.x;
      const dy = ball.y - p.y;
      const dist = Math.hypot(dx,dy);
      if(dist > 120){ p.x += Math.sign(dx) * 2; p.y += Math.sign(dy) * 1.2; }
      else {
        // kick toward left goal
        const power = 0.15;
        ball.dx += (FIELD.w*0.5 - ball.x) * power * 0.02;
        ball.dy += (FIELD.h/2 - ball.y) * power * 0.02;
        spawnParticles(ball.x, ball.y, 10);
        playSound('kick');
        turn = 0;
      }
    }
  }

  // UI wiring
  ui.startBtn.addEventListener('click', ()=>{ ui.splash.classList.add('hidden'); ui.uiRoot.classList.remove('hidden'); draw(); setInterval(physicsStep, 16); setInterval(aiStep, 600); });
  ui.restartBtn.addEventListener('click', ()=>{ scores = [0,0]; resetPositions(); updateUI(); });
  ui.muteBtn.addEventListener('click', ()=>{ muted = !muted; ui.muteBtn.textContent = muted ? '🔈' : '🔊'; });
  document.getElementById('help').addEventListener('click', (e)=>{ if(e.target.id==='help' || e.target.id==='closeHelp') closeHelp(); });
  ui.help = document.getElementById('help');
  ui.closeHelp.addEventListener('click', closeHelp);
  window.addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='h') openHelp(); });

  function openHelp(){ ui.help.classList.remove('hidden'); }
  function closeHelp(){ ui.help.classList.add('hidden'); }

  function updateUI(){
    ui.scoreEl.textContent = scores[0] + ' - ' + scores[1];
    ui.turnEl.textContent = (turn+1);
  }

  // Cheats API (hidden)
  function enableCheats(){ __cheatEnabled = true; console.log('PegasusCheats enabled'); }
  function freezeOpponent(seconds){ opponentFrozenUntil = performance.now()/1000 + Number(seconds || 30); console.log('Opponent frozen until', new Date(opponentFrozenUntil*1000).toLocaleTimeString()); }
  function stopTime(seconds){ timeStoppedUntil = performance.now()/1000 + Number(seconds || 10); console.log('Time stopped until', new Date(timeStoppedUntil*1000).toLocaleTimeString()); }

  // Expose hidden console function but only after activation
  window.__pegasusCheat = function(cmd, arg){
    if(!__cheatEnabled) return console.warn('Cheats not enabled. Activate with window.__pegasusActivate(token)');
    if(cmd === 'freezeOpponent') freezeOpponent(arg || 30);
    if(cmd === 'stopTime') stopTime(arg || 10);
    if(cmd === 'toggle') __cheatEnabled = !__cheatEnabled;
    if(cmd === 'status') console.log({cheats:__cheatEnabled, opponentFrozenUntil, timeStoppedUntil});
  };

  // Activation function: requires the secret token
  window.__pegasusActivate = function(token){
    try{
      const expected = 'bb30490eb73240408a4736cc4c775f7c';
      if(token && token.toString() === expected){ enableCheats(); return console.log('Activated.'); }
      console.warn('Invalid token');
    }catch(e){console.error(e)}
  };

  // initial draw and UI
  updateUI();
  draw();

})();
