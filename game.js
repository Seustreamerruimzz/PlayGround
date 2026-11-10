(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 1280, H = 720, ground = 570;
  const ui = {
    intro: document.getElementById('intro'), ending: document.getElementById('ending'), endingTitle: document.getElementById('endingTitle'), endingText: document.getElementById('endingText'),
    start: document.getElementById('startButton'), restart: document.getElementById('restartButton'), hud: document.getElementById('hud'), healthFill: document.getElementById('healthFill'), healthText: document.getElementById('healthText'), staminaFill: document.getElementById('staminaFill'), level: document.getElementById('level'), kills: document.getElementById('killCount'), objective: document.getElementById('objectiveText'),
    bossHud: document.getElementById('bossHud'), bossFill: document.getElementById('bossFill'), toast: document.getElementById('waveToast'), pause: document.getElementById('pauseIndicator'), flash: document.getElementById('damageFlash'), sound: document.getElementById('soundToggle'), soundLabel: document.getElementById('soundLabel')
  };
  const keys = new Set();
  const pointer = { left:false, right:false, attack:false, jump:false, dodge:false };
  let game, last = 0, audioCtx = null, soundOn = false;
  const rand = (a,b) => a + Math.random() * (b-a);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const smooth = (a,b,t) => a + (b-a)*t;

  function reset() {
    game = { running:true, paused:false, over:false, won:false, time:0, camera:0, kills:0, wave:0, waveKills:0, waveTarget:3, spawnClock:1.2, enemies:[], particles:[], projectiles:[], shake:0, toastTimer:0, world:4400, bossSpawned:false,
      hero:{x:140,y:ground,vx:0,vy:0,health:100,maxHealth:100,stamina:100,facing:1,onGround:true,attack:0,attackCooldown:0,dodge:0,invuln:0,anim:0,hurt:0,potions:2} };
    ui.intro.hidden = true; ui.ending.hidden = true; ui.hud.hidden = false; ui.pause.hidden = true; ui.bossHud.hidden = true;
    toast('A ESTRADA DOS OSSOS','A noite reclama sua dívida'); updateHud();
  }
  function toast(title, subtitle) {
    ui.toast.innerHTML = `${title}<small>${subtitle}</small>`; ui.toast.classList.add('show'); game.toastTimer = 2.8;
  }
  function updateHud() {
    const h=game.hero; ui.healthFill.style.width=(h.health/h.maxHealth*100)+'%'; ui.healthText.textContent=`${Math.ceil(h.health)} / ${h.maxHealth}`; ui.staminaFill.style.width=h.stamina+'%'; ui.kills.textContent=String(game.kills).padStart(2,'0');
    ui.level.textContent=String(Math.min(3,1+Math.floor(game.kills/4))).padStart(2,'0');
    ui.objective.textContent=game.bossSpawned ? 'Derrote o Pavor sem Rosto' : game.wave===0 ? 'Atravesse a estrada dos ossos' : `Sobreviva à noite · ${game.waveKills} / ${game.waveTarget}`;
  }
  function startGame(){ reset(); last=performance.now(); requestAnimationFrame(loop); }
  ui.start.addEventListener('click', startGame);
  ui.restart.addEventListener('click', startGame);
  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase(); if([' ','arrowleft','arrowright','arrowup'].includes(k)) e.preventDefault(); keys.add(k);
    if(k==='escape' && game?.running && !game.over){game.paused=!game.paused;ui.pause.hidden=!game.paused;last=performance.now();}
    if(k==='j' || k===' '){} if(k==='e' && game?.running && !game.paused) usePotion();
  });
  window.addEventListener('keyup', e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('[data-control]').forEach(button=>{
    const name=button.dataset.control;
    const down=e=>{e.preventDefault();pointer[name]=true;}; const up=e=>{e.preventDefault();pointer[name]=false;};
    button.addEventListener('pointerdown',down); button.addEventListener('pointerup',up); button.addEventListener('pointerleave',up); button.addEventListener('pointercancel',up);
  });
  ui.sound.addEventListener('click',()=>{soundOn=!soundOn;ui.soundLabel.textContent=soundOn?'ON':'OFF';ui.soundLabel.style.color=soundOn?'#d9b36f':'#b84b42';if(soundOn) startAudio();});
  function startAudio(){ try { audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); audioCtx.resume(); } catch {} }
  function tone(freq,duration,volume,type='sine') { if(!soundOn||!audioCtx)return;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(volume,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration); }
  function usePotion(){ const h=game.hero;if(h.potions>0&&h.health<90){h.potions--;h.health=Math.min(100,h.health+36);burst(h.x,h.y-30,'#a8443d',15);tone(180,.4,.06);updateHud();} }

  function loop(now){ if(!game?.running)return; const dt=Math.min(.034,(now-last)/1000||0); last=now; if(!game.paused&&!game.over){update(dt);draw();} else if(game.paused)draw(); requestAnimationFrame(loop); }
  function update(dt){
    game.time+=dt; const h=game.hero; h.anim+=dt*8; h.attack=Math.max(0,h.attack-dt);h.attackCooldown=Math.max(0,h.attackCooldown-dt);h.dodge=Math.max(0,h.dodge-dt);h.invuln=Math.max(0,h.invuln-dt);h.hurt=Math.max(0,h.hurt-dt);h.stamina=Math.min(100,h.stamina+dt*19);
    const left=keys.has('a')||keys.has('arrowleft')||pointer.left, right=keys.has('d')||keys.has('arrowright')||pointer.right;
    if(left){h.vx=smooth(h.vx,-220,Math.min(1,dt*10));h.facing=-1;} else if(right){h.vx=smooth(h.vx,220,Math.min(1,dt*10));h.facing=1;} else h.vx=smooth(h.vx,0,Math.min(1,dt*8));
    if((keys.has(' ')||keys.has('w')||keys.has('arrowup')||pointer.jump)&&h.onGround){h.vy=-470;h.onGround=false;tone(115,.08,.025);}
    if((keys.has('j')||pointer.attack)&&h.attackCooldown<=0){h.attack=.28;h.attackCooldown=.42;tone(105,.14,.08,'sawtooth');}
    if((keys.has('k')||pointer.dodge)&&h.dodge<=0&&h.stamina>=25){h.dodge=.32;h.invuln=.39;h.stamina-=25;h.vx=h.facing*490;burst(h.x,h.y-18,'#b99b6f',5);}
    h.x=clamp(h.x+h.vx*dt,45,game.world-90); h.y+=h.vy*dt; h.vy+=1050*dt;
    if(h.y>=ground){h.y=ground;h.vy=0;h.onGround=true;}
    game.camera=smooth(game.camera,clamp(h.x-W*.42,0,game.world-W),Math.min(1,dt*3));
    if(game.toastTimer>0){game.toastTimer-=dt;if(game.toastTimer<=0)ui.toast.classList.remove('show');}
    if(game.shake>0)game.shake=Math.max(0,game.shake-dt*28);
    maybeSpawn(dt); updateEnemies(dt); updateProjectiles(dt); updateParticles(dt); checkHits();
    if(game.bossSpawned){const boss=game.enemies.find(e=>e.boss);if(boss)ui.bossFill.style.width=(boss.hp/boss.maxHp*100)+'%';else if(!game.over)finish(true);}
    updateHud();
  }
  function maybeSpawn(dt){
    if(game.bossSpawned)return;
    game.spawnClock-=dt;
    if(game.spawnClock>0)return;
    if(game.wave===0){game.wave=1;game.waveKills=0;game.waveTarget=3;toast('PRIMEIRA MARÉ','O fogo sempre encontra o caminho');}
    if(game.wave===4){spawnBoss();game.bossSpawned=true;game.spawnClock=999;ui.bossHud.hidden=false;toast('O PAVOR SEM ROSTO','A noite tem um rosto. Agora ele vê você.');return;}
    const remaining=game.waveTarget-game.waveKills-game.enemies.filter(e=>!e.boss&&!e.dead).length;
    if(remaining>0){spawnEnemy();game.spawnClock=rand(1.6,2.4);}
    else if(game.waveKills>=game.waveTarget){
      game.wave++;game.waveKills=0;
      if(game.wave===2){game.waveTarget=4;toast('SEGUNDA MARÉ','Algo rasteja sob a pele da terra');game.spawnClock=1.6;}
      else if(game.wave===3){game.waveTarget=5;toast('TERCEIRA MARÉ','Não olhe para trás');game.spawnClock=1.6;}
      else if(game.wave===4){game.waveTarget=1;game.spawnClock=2.2;}
    }
  }
  function spawnEnemy(){
    const choices=game.wave===1?['fire','fire','wraith']:game.wave===2?['snake','fire','snake','wraith']:['wraith','snake','fire','wraith','snake'];
    const type=choices[Math.floor(Math.random()*choices.length)], side=Math.random()<.5?-1:1, x=clamp(game.hero.x+side*rand(370,590),55,game.world-60);
    const specs={fire:{hp:42,speed:47,damage:13,r:25,color:'#d45b35'},snake:{hp:54,speed:67,damage:15,r:36,color:'#718250'},wraith:{hp:38,speed:76,damage:12,r:26,color:'#92839c'}}[type];
    game.enemies.push({type,x,y:ground,vx:0,vy:0,hp:specs.hp,maxHp:specs.hp,speed:specs.speed,damage:specs.damage,r:specs.r,color:specs.color,facing:side>0?-1:1,attack:0,cooldown:rand(.8,1.8),anim:rand(0,10),hurt:0,dead:false,phase:rand(0,8)});
  }
  function spawnBoss(){const x=clamp(game.hero.x+540,game.hero.x+390,game.world-90);game.enemies.push({type:'boss',boss:true,x,y:ground,vx:0,vy:0,hp:310,maxHp:310,speed:39,damage:23,r:65,color:'#3b2b36',facing:-1,attack:0,cooldown:1.4,anim:0,hurt:0,dead:false,phase:0});}
  function updateEnemies(dt){
    const h=game.hero;
    for(const e of game.enemies){if(e.dead)continue;e.anim+=dt*5;e.attack=Math.max(0,e.attack-dt);e.cooldown-=dt;e.hurt=Math.max(0,e.hurt-dt);
      const dx=h.x-e.x, dist=Math.abs(dx);e.facing=dx<0?-1:1;
      if(e.type==='snake'&&!e.boss)e.y=ground-4+Math.sin(e.anim*1.3)*8;
      if(e.type==='wraith'&&!e.boss)e.y=ground-26+Math.sin(e.anim*.7+e.phase)*19;
      if(dist>(e.boss?112:70)){e.vx=e.facing*e.speed; e.x+=e.vx*dt;}
      else {e.vx=0;if(e.cooldown<=0){e.attack=e.boss?.72:.5;e.cooldown=e.boss?2.05:rand(1.2,1.8);if(e.type==='fire'&&dist>105){game.projectiles.push({x:e.x,y:e.y-43,vx:e.facing*210,life:2,r:12,type:'ember'});} else if(e.boss){game.projectiles.push({x:e.x,y:e.y-106,vx:e.facing*265,life:2.4,r:19,type:'orb'});}
        else if(dist<95&&h.invuln<=0&&h.dodge<=0){damageHero(e.damage,e.facing);}}}
      e.x=clamp(e.x,35,game.world-30);
    }
    game.enemies=game.enemies.filter(e=>!e.dead||e.deathTimer>0);
    for(const e of game.enemies)if(e.dead){e.deathTimer-=dt;if(e.deathTimer<=0)game.enemies.splice(game.enemies.indexOf(e),1);}
  }
  function damageHero(amount,direction){const h=game.hero;if(h.invuln>0)return;h.health=Math.max(0,h.health-amount);h.hurt=.25;h.invuln=.7;h.vx=direction*155;game.shake=8;ui.flash.style.opacity='.6';setTimeout(()=>ui.flash.style.opacity='0',100);tone(75,.2,.08,'square');burst(h.x,h.y-30,'#9b3933',7);if(h.health<=0)finish(false);}
  function updateProjectiles(dt){const h=game.hero;for(const p of game.projectiles){p.x+=p.vx*dt;p.life-=dt;if(Math.abs(p.x-h.x)<p.r+18&&Math.abs(p.y-(h.y-40))<p.r+29&&h.invuln<=0){p.life=0;damageHero(p.type==='orb'?19:12,Math.sign(p.vx));}if(p.life<=0)p.dead=true;}game.projectiles=game.projectiles.filter(p=>!p.dead);}
  function checkHits(){const h=game.hero;if(h.attack<=0)return;for(const e of game.enemies){if(e.dead||e.hurt>0)continue;const dx=e.x-h.x;if(Math.abs(dx)<(e.boss?105:82)&&Math.sign(dx||1)===h.facing){const dmg=e.boss?20:30;e.hp-=dmg;e.hurt=.17;e.vx=h.facing*100;game.shake=e.boss?5:3;burst(e.x,e.y-35,e.type==='fire'?'#ff8b40':'#d9c3a0',9);tone(155,.09,.04,'triangle');if(e.hp<=0){e.dead=true;e.deathTimer=.45;game.kills++;game.waveKills++;burst(e.x,e.y-30,e.color,19);if(e.boss)game.enemies=game.enemies.filter(x=>x!==e);updateHud();}}}}
  function finish(win){game.over=true;game.won=win;ui.ending.hidden=false;ui.endingTitle.innerHTML=win?'A NOITE<br><em>RECUA</em>':'A ESTRADA<br><em>TE ENGOLIU</em>';ui.endingText.textContent=win?'O Pavor caiu. Mas, além da colina, outra lua começa a sangrar.':'O silêncio toma a estrada. Até mesmo os mortos esquecem seu nome.';ui.restart.textContent=win?'CAÇAR OUTRA VEZ →':'TENTAR DE NOVO →';ui.bossHud.hidden=true;}
  function burst(x,y,color,n){for(let i=0;i<n;i++)game.particles.push({x,y,vx:rand(-155,155),vy:rand(-210,60),life:rand(.25,.8),max:.8,color,size:rand(2,6)});}
  function updateParticles(dt){for(const p of game.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=360*dt;p.life-=dt;}game.particles=game.particles.filter(p=>p.life>0);}

  function draw(){
    const shake=game.shake?rand(-game.shake,game.shake):0;
    ctx.save();ctx.translate(shake,0);drawSky();ctx.save();ctx.translate(-game.camera,0);drawScenery();drawGround();for(const p of game.projectiles)drawProjectile(p);for(const e of game.enemies)drawEnemy(e);drawHero(game.hero);drawParticles();ctx.restore();drawGrain();ctx.restore();
  }
  function drawSky(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#11131b');g.addColorStop(.48,'#29202a');g.addColorStop(1,'#46302b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const moonX=865-game.camera*.035, moonY=172;ctx.save();ctx.shadowColor='#9d4544';ctx.shadowBlur=42;ctx.fillStyle='#b66b59';ctx.beginPath();ctx.arc(moonX,moonY,89,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.fillStyle='#562e35';for(let i=0;i<20;i++){const x=moonX+Math.sin(i*37)*65,y=moonY+Math.cos(i*21)*63,r=2+(i*17%7);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    // Cloud veils drifting across the eclipsed moon.
    ctx.fillStyle='#17151d88';for(let i=0;i<8;i++){const x=((i*224-game.time*13)%(W+300)+W+300)%(W+300)-150,y=80+i*47;ctx.beginPath();ctx.ellipse(x,y,85+(i*29%85),7+(i*7%13),-.05,0,Math.PI*2);ctx.fill();}
    mountainLayer('#29252d',390,62,game.camera*.12,21);mountainLayer('#211e26',456,46,game.camera*.21,43);
    // Distant spires and a broken abbey.
    for(let i=0;i<7;i++){const x=i*243-((game.camera*.24)%243);const ht=rand(78,160);ctx.fillStyle='#17171f';ctx.beginPath();ctx.moveTo(x-22,438);ctx.lineTo(x-17,438-ht*.7);ctx.lineTo(x,438-ht);ctx.lineTo(x+7,438-ht*.62);ctx.lineTo(x+28,438);ctx.fill();ctx.fillRect(x-13,438-ht*.7,27,ht*.7);ctx.fillStyle='#301d25';ctx.fillRect(x-3,438-ht*.52,6,20);}
    // Low drifting fog.
    for(let i=0;i<6;i++){const x=((i*280-game.time*18)%(W+400)+W+400)%(W+400)-200;const fog=ctx.createRadialGradient(x,505,4,x,505,195);fog.addColorStop(0,'#c7a69a19');fog.addColorStop(1,'#c7a69a00');ctx.fillStyle=fog;ctx.fillRect(x-200,400,400,200);}
  }
  function mountainLayer(color,base,height,offset,seed){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-20,H);ctx.lineTo(-20,base);for(let x=-20;x<=W+40;x+=9){const n=Math.sin((x+offset+seed)*.014)*height*.47+Math.sin((x+offset)*.039+seed)*height*.22+Math.sin((x+offset)*.003)*height*.2;ctx.lineTo(x,base-height*.38-n);}ctx.lineTo(W+20,H);ctx.closePath();ctx.fill();}
  function drawScenery(){
    // Gnarled silhouettes are repeated across the long, cursed road.
    for(let n=-1;n<20;n++){const x=n*240+110;drawDeadTree(x,ground-6,1+((n+8)%3)*.17);}
    for(let n=-1;n<27;n++){const x=n*180+65;drawRuin(x,ground-12,((n+20)%3)*.2);}
    // A distant procession of nameless stones.
    for(let n=-2;n<26;n++){const x=n*164+23;ctx.fillStyle='#252027';ctx.fillRect(x,ground-34-(n%3)*8,14,34+(n%3)*8);ctx.fillStyle='#493936';ctx.fillRect(x+4,ground-40-(n%3)*8,2,7);}
  }
  function drawDeadTree(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#151419';ctx.strokeStyle='#151419';ctx.lineWidth=8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-3,-96);ctx.lineTo(-33,-136);ctx.moveTo(-3,-91);ctx.lineTo(27,-118);ctx.lineTo(43,-152);ctx.moveTo(-25,-126);ctx.lineTo(-60,-143);ctx.moveTo(18,-112);ctx.lineTo(46,-125);ctx.stroke();ctx.fillRect(-6,-18,12,24);ctx.restore();}
  function drawRuin(x,y,v){ctx.save();ctx.translate(x,y);ctx.fillStyle='#19181f';ctx.fillRect(-20,-88,40,88);ctx.beginPath();ctx.moveTo(-28,-83);ctx.lineTo(0,-126-v*50);ctx.lineTo(28,-83);ctx.closePath();ctx.fill();ctx.fillStyle='#43282a';ctx.fillRect(-4,-58,8,24);ctx.fillStyle='#19181f';ctx.fillRect(-42,-17,84,17);ctx.restore();}
  function drawGround(){
    const g=ctx.createLinearGradient(0,ground,0,H);g.addColorStop(0,'#292327');g.addColorStop(.25,'#211d21');g.addColorStop(1,'#100f14');ctx.fillStyle=g;ctx.fillRect(game.camera,ground,game.world,H-ground);
    ctx.fillStyle='#79604a';ctx.fillRect(game.camera,ground,game.world,2);
    // Mud ruts, scattered bones and old blood marks.
    for(let i=0;i<100;i++){const x=((i*197+11)%game.world);const y=ground+13+(i*47)%132;ctx.fillStyle=i%8===0?'#69363166':i%3===0?'#746b5c55':'#090a0d66';ctx.beginPath();ctx.ellipse(x,y,7+(i%7)*3,1+(i%3),-.12,0,Math.PI*2);ctx.fill();}
    for(let i=0;i<35;i++){const x=(i*311+130)%game.world,y=ground+10+(i*29)%80;ctx.strokeStyle='#b7a48c44';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y-2);ctx.moveTo(x,y-5);ctx.lineTo(x+2,y+5);ctx.stroke();}
  }
  function drawHero(h){
    const x=h.x,y=h.y;ctx.save();ctx.translate(x,y);ctx.scale(h.facing,1);const bob=h.onGround?Math.sin(h.anim)*1.5:0;ctx.translate(0,bob);
    if(h.invuln>0&&Math.floor(game.time*18)%2===0)ctx.globalAlpha=.48;
    // Ground shadow and ragged cloak.
    ctx.fillStyle='#08090bb0';ctx.beginPath();ctx.ellipse(0,0,29,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=h.hurt>0?'#693631':'#17161b';ctx.beginPath();ctx.moveTo(-12,-62);ctx.quadraticCurveTo(-31,-39,-25,-7);ctx.lineTo(-34,-2);ctx.lineTo(-17,-6);ctx.lineTo(-8,-2);ctx.lineTo(1,-6);ctx.lineTo(18,-2);ctx.lineTo(14,-31);ctx.lineTo(8,-56);ctx.closePath();ctx.fill();
    ctx.fillStyle='#30282a';ctx.beginPath();ctx.moveTo(-12,-56);ctx.lineTo(-23,-17);ctx.lineTo(-10,-24);ctx.lineTo(-4,-6);ctx.lineTo(2,-28);ctx.lineTo(8,-57);ctx.closePath();ctx.fill();
    // Legs and heavy boots.
    ctx.strokeStyle='#29262a';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-8,-28);ctx.lineTo(-13,-7);ctx.lineTo(-20,-3);ctx.moveTo(6,-27);ctx.lineTo(12,-7);ctx.lineTo(20,-3);ctx.stroke();
    ctx.fillStyle='#605143';ctx.fillRect(-25,-5,13,5);ctx.fillRect(12,-5,13,5);
    // Torso, leather straps, pauldron.
    ctx.fillStyle='#393236';ctx.beginPath();ctx.moveTo(-12,-60);ctx.lineTo(9,-61);ctx.lineTo(14,-30);ctx.lineTo(-10,-27);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#9c7951';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-9,-54);ctx.lineTo(9,-32);ctx.stroke();ctx.fillStyle='#8c7358';ctx.fillRect(-13,-59,13,10);ctx.fillStyle='#b58c5e';ctx.fillRect(-8,-44,4,4);
    // Head, swept dark hair and scarf.
    ctx.fillStyle='#c2a887';ctx.beginPath();ctx.ellipse(1,-70,9,11,-.1,0,Math.PI*2);ctx.fill();ctx.fillStyle='#17171c';ctx.beginPath();ctx.moveTo(-9,-72);ctx.lineTo(-16,-83);ctx.lineTo(-3,-78);ctx.lineTo(5,-88);ctx.lineTo(8,-77);ctx.lineTo(13,-81);ctx.lineTo(10,-68);ctx.closePath();ctx.fill();
    ctx.fillStyle='#9c4138';ctx.beginPath();ctx.moveTo(-8,-63);ctx.lineTo(12,-61);ctx.lineTo(22,-56);ctx.lineTo(9,-55);ctx.lineTo(-9,-58);ctx.closePath();ctx.fill();
    // Greatsword, raised during the slash.
    const slash=h.attack>0;ctx.save();if(slash)ctx.rotate(-.8);else ctx.rotate(-.18);
    ctx.strokeStyle='#5e4d3e';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(9,-42);ctx.lineTo(21,-47);ctx.stroke();ctx.strokeStyle='#b49870';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(7,-40);ctx.lineTo(14,-47);ctx.stroke();
    ctx.fillStyle='#a9a39a';ctx.beginPath();ctx.moveTo(17,-49);ctx.lineTo(29,-125);ctx.lineTo(35,-130);ctx.lineTo(31,-53);ctx.closePath();ctx.fill();ctx.fillStyle='#4b4547';ctx.beginPath();ctx.moveTo(17,-49);ctx.lineTo(29,-125);ctx.lineTo(30,-53);ctx.closePath();ctx.fill();ctx.fillStyle='#c7bca9';ctx.fillRect(13,-49,14,3);ctx.restore();
    if(slash){ctx.strokeStyle='#e7d2ab77';ctx.lineWidth=4;ctx.beginPath();ctx.arc(4,-51,65,-.95,.72);ctx.stroke();}
    ctx.restore();
  }
  function drawEnemy(e){
    ctx.save();ctx.translate(e.x,e.y);ctx.scale(e.facing,1);ctx.globalAlpha=e.dead?clamp(e.deathTimer/.45,0,1):1;
    if(e.hurt>0)ctx.filter='brightness(2.4)';
    ctx.fillStyle='#09090bb0';ctx.beginPath();ctx.ellipse(0,0,e.boss?60:34,7,0,0,Math.PI*2);ctx.fill();
    if(e.type==='fire')drawFireDemon(e);else if(e.type==='snake')drawSerpent(e);else if(e.type==='wraith')drawWraith(e);else drawBoss(e);
    if(!e.boss&&!e.dead){ctx.fillStyle='#120e12';ctx.fillRect(-22,-(e.type==='wraith'?98:88),44,4);ctx.fillStyle='#a84039';ctx.fillRect(-22,-(e.type==='wraith'?98:88),44*e.hp/e.maxHp,4);}
    ctx.restore();
  }
  function drawFireDemon(e){
    const t=e.anim;ctx.fillStyle='#471e21';ctx.beginPath();ctx.moveTo(-20,-8);ctx.lineTo(-18,-45);ctx.lineTo(-11,-68);ctx.lineTo(3,-74);ctx.lineTo(18,-60);ctx.lineTo(22,-28);ctx.lineTo(15,-7);ctx.closePath();ctx.fill();
    ctx.fillStyle='#8e3128';ctx.beginPath();ctx.ellipse(1,-65,15,20,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d7793d';ctx.beginPath();ctx.moveTo(-12,-69);ctx.lineTo(-14,-83);ctx.lineTo(-3,-75);ctx.lineTo(4,-89);ctx.lineTo(8,-76);ctx.lineTo(18,-81);ctx.lineTo(12,-66);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffcb73';ctx.fillRect(4,-69,5,3);ctx.fillStyle='#25151a';ctx.fillRect(5,-70,2,2);
    ctx.strokeStyle='#6b2623';ctx.lineWidth=8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-13,-47);ctx.lineTo(-25,-29+Math.sin(t)*3);ctx.lineTo(-18,-17);ctx.moveTo(13,-47);ctx.lineTo(24,-36);ctx.lineTo(20,-23);ctx.stroke();
    ctx.fillStyle='#e46a31';ctx.beginPath();ctx.moveTo(-15,-4);ctx.quadraticCurveTo(-27,-27+Math.sin(t)*9,-11,-40);ctx.quadraticCurveTo(-12,-23,0,-12);ctx.quadraticCurveTo(10,-32,19,-34);ctx.quadraticCurveTo(14,-13,8,-3);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffc15d';ctx.beginPath();ctx.moveTo(-3,-4);ctx.quadraticCurveTo(-12,-24,-1,-31);ctx.quadraticCurveTo(-2,-18,8,-10);ctx.closePath();ctx.fill();
    ctx.fillStyle='#49221d';ctx.fillRect(-14,-13,10,11);ctx.fillRect(8,-15,10,13);
  }
  function drawSerpent(e){
    const t=e.anim, sway=Math.sin(t*.8)*9;ctx.strokeStyle='#46533b';ctx.lineWidth=18;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-29,-6);ctx.bezierCurveTo(-37,-28+sway,-7,-45,-18,-63);ctx.bezierCurveTo(-27,-81,14,-78+sway,10,-98);ctx.stroke();
    ctx.strokeStyle='#83915b';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-30,-9);ctx.bezierCurveTo(-32,-32+sway,-8,-43,-18,-62);ctx.bezierCurveTo(-24,-80,10,-78+sway,11,-94);ctx.stroke();
    ctx.fillStyle='#73844e';ctx.beginPath();ctx.moveTo(2,-100);ctx.lineTo(20,-115);ctx.lineTo(34,-108);ctx.lineTo(27,-93);ctx.lineTo(12,-90);ctx.closePath();ctx.fill();ctx.fillStyle='#d4a84e';ctx.fillRect(22,-108,4,3);ctx.fillStyle='#16171a';ctx.fillRect(24,-108,1,3);
    ctx.strokeStyle='#cbbd91';ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(24+i*2,-96);ctx.lineTo(25+i*2,-91);ctx.stroke();}
    ctx.strokeStyle='#384230';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-24,-42);ctx.lineTo(-40,-53);ctx.moveTo(-11,-60);ctx.lineTo(-2,-73);ctx.stroke();
  }
  function drawWraith(e){
    const t=e.anim;ctx.fillStyle='#3b3546';ctx.beginPath();ctx.moveTo(-20,-15);ctx.quadraticCurveTo(-42,-53,-20,-93);ctx.quadraticCurveTo(-3,-114,18,-89);ctx.quadraticCurveTo(34,-58,17,-20);ctx.lineTo(29,-7);ctx.lineTo(13,-14);ctx.lineTo(1,-4);ctx.lineTo(-12,-14);ctx.lineTo(-29,-5);ctx.closePath();ctx.fill();
    ctx.fillStyle='#827386';ctx.beginPath();ctx.ellipse(1,-88,15,18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#27232e';ctx.beginPath();ctx.moveTo(-13,-88);ctx.quadraticCurveTo(0,-111,15,-88);ctx.lineTo(11,-78);ctx.lineTo(-12,-78);ctx.closePath();ctx.fill();
    ctx.fillStyle='#da483f';ctx.shadowColor='#d13c35';ctx.shadowBlur=10;ctx.fillRect(-8,-91,5,3);ctx.fillRect(5,-91,5,3);ctx.shadowBlur=0;
    ctx.strokeStyle='#706178';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(17,-56);ctx.lineTo(30,-35);ctx.lineTo(19,-23);ctx.moveTo(-16,-58);ctx.lineTo(-29,-42);ctx.lineTo(-24,-27);ctx.stroke();
    ctx.fillStyle='#b3a5bb22';ctx.beginPath();ctx.ellipse(-2,-8,24,7+Math.sin(t)*3,0,0,Math.PI*2);ctx.fill();
  }
  function drawBoss(e){
    const t=e.anim, sway=Math.sin(t*.8)*3;ctx.fillStyle='#211c28';ctx.beginPath();ctx.moveTo(-43,-9);ctx.lineTo(-52,-56);ctx.lineTo(-42,-121);ctx.lineTo(-27,-167);ctx.lineTo(25,-174);ctx.lineTo(48,-129);ctx.lineTo(55,-64);ctx.lineTo(41,-9);ctx.closePath();ctx.fill();
    // torn, many-layered mantle
    ctx.fillStyle='#382a36';ctx.beginPath();ctx.moveTo(-34,-137);ctx.lineTo(-76,-99);ctx.lineTo(-82,-18);ctx.lineTo(-64,-5);ctx.lineTo(-50,-22);ctx.lineTo(-35,-4);ctx.lineTo(-21,-25);ctx.lineTo(3,-4);ctx.lineTo(20,-25);ctx.lineTo(39,-7);ctx.lineTo(69,-25);ctx.lineTo(62,-108);ctx.lineTo(34,-147);ctx.closePath();ctx.fill();
    ctx.fillStyle='#51404c';ctx.beginPath();ctx.moveTo(-20,-164);ctx.quadraticCurveTo(-5,-194,20,-170);ctx.lineTo(24,-140);ctx.quadraticCurveTo(3,-123,-22,-143);ctx.closePath();ctx.fill();
    // Blank pale face: the unsettling focal point.
    ctx.fillStyle='#b0a090';ctx.beginPath();ctx.moveTo(-14,-160);ctx.quadraticCurveTo(-9,-180,6,-176);ctx.quadraticCurveTo(21,-167,15,-145);ctx.lineTo(7,-133);ctx.lineTo(-8,-139);ctx.closePath();ctx.fill();
    ctx.fillStyle='#302630';ctx.beginPath();ctx.ellipse(-4,-157,3,7,-.12,0,Math.PI*2);ctx.ellipse(9,-158,3,7,.12,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#3c2832';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-3,-139);ctx.lineTo(1,-148);ctx.lineTo(5,-138);ctx.stroke();
    // Crown of broken antlers.
    ctx.strokeStyle='#756454';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-12,-170);ctx.lineTo(-22,-200);ctx.lineTo(-42,-215);ctx.moveTo(-25,-203);ctx.lineTo(-25,-220);ctx.moveTo(14,-170);ctx.lineTo(25,-203);ctx.lineTo(44,-218);ctx.moveTo(26,-204);ctx.lineTo(30,-222);ctx.stroke();
    // Long arms and bone claws.
    ctx.strokeStyle='#6b5861';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(-42,-116);ctx.lineTo(-64,-83+sway);ctx.lineTo(-75,-41);ctx.moveTo(40,-115);ctx.lineTo(58,-84-sway);ctx.lineTo(72,-43);ctx.stroke();
    ctx.strokeStyle='#c2b49d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-75,-41);ctx.lineTo(-88,-28);ctx.moveTo(-75,-41);ctx.lineTo(-76,-22);ctx.moveTo(72,-43);ctx.lineTo(85,-29);ctx.moveTo(72,-43);ctx.lineTo(72,-24);ctx.stroke();
    ctx.fillStyle='#8c3333';ctx.shadowColor='#8c3333';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(0,-113,7+Math.sin(t*2)*2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  function drawProjectile(p){ctx.save();ctx.translate(p.x,p.y);const fire=p.type==='ember';ctx.shadowColor=fire?'#ff572b':'#9a3938';ctx.shadowBlur=24;ctx.fillStyle=fire?'#ed7137':'#9a4547';ctx.beginPath();ctx.arc(0,0,p.r*(.75+Math.sin(game.time*13)*.12),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=fire?'#ffd27d':'#d99b82';ctx.beginPath();ctx.arc(-3,-3,p.r*.34,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawParticles(){for(const p of game.particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size); }ctx.globalAlpha=1;}
  function drawGrain(){ctx.fillStyle='#e3c9a508';for(let i=0;i<70;i++){const x=(i*173+game.time*11)%W,y=(i*97)%H;ctx.fillRect(x,y,1,1);}}
  // Keep the game area fitted to any viewport while retaining the hand-painted 16:9 composition.
  function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
  window.addEventListener('resize',resize);resize();
  drawTitleScreen();
  function drawTitleScreen(){game={time:0,camera:0,world:W,hero:{x:W*.42,y:ground,facing:1,anim:0,onGround:true,invuln:0,attack:0},enemies:[],projectiles:[],particles:[],shake:0};draw();}
})();
