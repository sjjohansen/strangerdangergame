import './style.css';
import './hands.css';
import {
  Engine, Scene, UniversalCamera, Vector3, Color3, Color4, HemisphericLight,
  PointLight, MeshBuilder, StandardMaterial, TransformNode, Animation,
  GlowLayer, ParticleSystem, Texture
} from '@babylonjs/core';

const canvas = document.querySelector('#game');
const engine = new Engine(canvas, true, { stencil: true });
const ui = {
  menu: document.querySelector('#menu'), hud: document.querySelector('#hud'),
  ending: document.querySelector('#ending'), objective: document.querySelector('#objective'),
  health: document.querySelector('#health'), souls: document.querySelector('#souls'),
  prompt: document.querySelector('#prompt'), hands: document.querySelector('.hands'),
  mission: document.querySelector('#mission'),
  boss: document.querySelector('#boss'), bossFill: document.querySelector('#boss-fill'),
  endingKicker: document.querySelector('#ending-kicker'), endingTitle: document.querySelector('#ending-title'),
  endingCopy: document.querySelector('#ending-copy')
};

let scene, camera, state;
const mat = (name, color, emissive = null) => {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(color);
  m.specularColor = new Color3(.08, .08, .08);
  if (emissive) m.emissiveColor = Color3.FromHexString(emissive);
  return m;
};

function box(name, size, pos, material) {
  const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(...pos); mesh.material = material; mesh.checkCollisions = true; return mesh;
}

function buildHumanoid(name, position, palette, scale = 1) {
  const root = new TransformNode(name, scene); root.position.copyFrom(position); root.scaling.setAll(scale);
  const bodyMat = mat(`${name}-cloth`, palette.body); const skinMat = mat(`${name}-skin`, palette.skin);
  const body = MeshBuilder.CreateCapsule(`${name}-body`, { height: 1.4, radius: .38 }, scene);
  body.parent = root; body.position.y = 1.15; body.material = bodyMat;
  const head = MeshBuilder.CreateSphere(`${name}-head`, { diameter: .62, segments: 10 }, scene);
  head.parent = root; head.position.y = 2.05; head.material = skinMat;
  for (const side of [-1, 1]) {
    const arm = MeshBuilder.CreateCapsule(`${name}-arm`, { height: 1.15, radius: .13 }, scene);
    arm.parent = root; arm.position.set(side * .48, 1.2, 0); arm.rotation.z = side * -.16; arm.material = skinMat;
  }
  return root;
}

function makeGhost(position, index) {
  const root = new TransformNode(`ghost-${index}`, scene); root.position.copyFrom(position);
  const ghostMat = mat(`ghost-mat-${index}`, '#48676d', '#274d55'); ghostMat.alpha = .64;
  const innerMat = mat(`ghost-inner-${index}`, '#152429', '#17383f'); innerMat.alpha = .8;
  const shroud = MeshBuilder.CreateCylinder(`ghost-body-${index}`, { height: 1.8, diameterTop: .68, diameterBottom: 1.25, tessellation: 18 }, scene);
  shroud.parent = root; shroud.position.y = 1.15; shroud.material = ghostMat;
  const ribs = MeshBuilder.CreateCapsule(`ghost-torso-${index}`, { height: 1.25, radius: .3, tessellation: 12 }, scene);
  ribs.parent = root; ribs.position.y = 1.45; ribs.material = innerMat;
  const head = MeshBuilder.CreateSphere(`ghost-head-${index}`, { diameterX: .68, diameterY: .86, diameterZ: .62, segments: 18 }, scene);
  head.parent = root; head.position.y = 2.25; head.material = ghostMat;
  for (const side of [-1, 1]) {
    const arm = MeshBuilder.CreateCapsule(`ghost-arm-${index}`, { height: 1.45, radius: .105, tessellation: 10 }, scene);
    arm.parent = root; arm.position.set(side * .47, 1.35, -.12); arm.rotation.z = side * -.2; arm.rotation.x = -.22; arm.material = ghostMat;
    const claw = MeshBuilder.CreateSphere(`ghost-claw-${index}`, { diameterX: .2, diameterY: .34, diameterZ: .16, segments: 8 }, scene);
    claw.parent = root; claw.position.set(side * .6, .68, -.3); claw.material = innerMat;
  }
  const socketMat = mat(`socket-${index}`, '#020303', '#080c0d');
  const eyeMat = mat(`eye-${index}`, '#ff301f', '#ff1b0a');
  for (const x of [-.15, .15]) {
    const socket = MeshBuilder.CreateSphere('hollow-eye', { diameterX: .2, diameterY: .25, diameterZ: .08, segments: 10 }, scene); socket.parent = root; socket.position.set(x, 2.3, -.305); socket.material = socketMat;
    const eye = MeshBuilder.CreateSphere('eye', { diameter: .055, segments: 8 }, scene); eye.parent = root; eye.position.set(x, 2.3, -.355); eye.material = eyeMat;
  }
  const mouth = MeshBuilder.CreateSphere('hollow-mouth', { diameterX: .22, diameterY: .3, diameterZ: .07, segments: 10 }, scene); mouth.parent = root; mouth.position.set(0, 2.05, -.31); mouth.material = socketMat;
  state.enemies.push({ root, hp: 2, speed: 1.25, damage: 10, cooldown: 0, alive: true, boss: false });
}

function makeSurvivor(position, index) {
  const root = buildHumanoid(`soul-${index}`, position, { body: '#45364c', skin: '#a98070' }, .85);
  const beaconMat = mat(`beacon-mat-${index}`, '#35ccff', '#35ccff'); beaconMat.alpha = .34; beaconMat.disableLighting = true;
  const beam = MeshBuilder.CreateCylinder(`rescue-beacon-${index}`, { height: 7, diameterTop: .22, diameterBottom: 1.8, tessellation: 18 }, scene);
  beam.parent = root; beam.position.y = 3.5; beam.material = beaconMat; beam.isPickable = false;
  const ring = MeshBuilder.CreateTorus(`rescue-ring-${index}`, { diameter: 2.6, thickness: .09, tessellation: 32 }, scene);
  ring.parent = root; ring.position.y = .12; ring.material = beaconMat; ring.isPickable = false;
  const light = new PointLight(`soul-light-${index}`, position.add(new Vector3(0, 1.6, 0)), scene); light.diffuse = new Color3(.15, .8, 1); light.intensity = 7; light.range = 11;
  state.survivors.push({ root, light, saved: false });
}

function makeChef() {
  const root = buildHumanoid('butcher-chef', new Vector3(0, 0, 22), { body: '#d2c5ad', skin: '#8e5542' }, 1.35);
  const hatMat = mat('hat', '#d8d0bd');
  const hat = MeshBuilder.CreateCylinder('chef-hat', { height: .65, diameterTop: .72, diameterBottom: .5, tessellation: 12 }, scene); hat.parent = root; hat.position.y = 2.72; hat.material = hatMat;
  const bladeMat = mat('blade', '#8b9391', '#252c2b');
  for (const x of [-.82, .82]) { const blade = MeshBuilder.CreateBox('cleaver', { width: .42, height: .72, depth: .07 }, scene); blade.parent = root; blade.position.set(x, 1.05, -.28); blade.rotation.z = x > 0 ? -.25 : .25; blade.material = bladeMat; }
  state.enemies.push({ root, hp: 12, maxHp: 12, speed: 1.55, damage: 18, cooldown: 0, alive: true, boss: true });
  state.bossSpawned = true; ui.mission.classList.add('hidden'); ui.boss.classList.remove('hidden'); ui.objective.textContent = 'Defeat the Butcher Chef';
}

function createScene() {
  scene = new Scene(engine); scene.clearColor = new Color4(.018, .014, .012, 1); scene.collisionsEnabled = true;
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = .025; scene.fogColor = new Color3(.045, .03, .026);
  state = { health: 100, saved: 0, enemies: [], survivors: [], keys: {}, ySpeed: 0, grounded: true, punching: false, bossSpawned: false, over: false, started: false, time: 0 };
  camera = new UniversalCamera('player', new Vector3(0, 1.75, -21), scene); camera.minZ = .05; camera.fov = 1.05;
  camera.attachControl(canvas, true); camera.angularSensibility = 3400; camera.inputs.removeByType('FreeCameraKeyboardMoveInput');
  const hemi = new HemisphericLight('moon', new Vector3(.2, 1, .1), scene); hemi.diffuse = new Color3(.18, .2, .22); hemi.groundColor = new Color3(.06, .02, .018); hemi.intensity = .55;
  const playerLight = new PointLight('flicker', Vector3.Zero(), scene); playerLight.parent = camera; playerLight.position.set(0, .1, .2); playerLight.diffuse = new Color3(.65, .38, .25); playerLight.intensity = 1.4; playerLight.range = 12;
  const glow = new GlowLayer('glow', scene); glow.intensity = .45;
  const floorMat = mat('floor', '#221b18'); const wallMat = mat('walls', '#312421'); const tileMat = mat('tile', '#59463f'); const redMat = mat('blood', '#4c0b07');
  box('floor', [18, .4, 52], [0, -.2, 1], floorMat); box('ceiling', [18, .3, 52], [0, 5.2, 1], wallMat);
  box('left-wall', [.5, 5.4, 52], [-9, 2.5, 1], wallMat); box('right-wall', [.5, 5.4, 52], [9, 2.5, 1], wallMat);
  box('back-wall', [18, 5.4, .5], [0, 2.5, -25], wallMat); box('boss-wall', [18, 5.4, .5], [0, 2.5, 27], wallMat);
  for (let z = -20; z < 22; z += 7) {
    box('table', [4.4, .22, 1.5], [z % 14 === 0 ? -4.8 : 4.8, 1.1, z], tileMat);
    for (const x of [-1.8, 1.8]) box('leg', [.18, 1.1, .18], [(z % 14 === 0 ? -4.8 : 4.8) + x, .55, z], wallMat);
  }
  for (let z = -18; z <= 18; z += 9) { const stain = MeshBuilder.CreateDisc('stain', { radius: .7 + Math.random() * .8, tessellation: 13 }, scene); stain.position.set((Math.random()-.5)*10,.015,z); stain.rotation.x=Math.PI/2; stain.material=redMat; }
  for (let z = -20; z < 24; z += 8) { const bulb = new PointLight('bulb', new Vector3((z%16)-4,4.5,z),scene); bulb.diffuse=new Color3(.5,.18,.1); bulb.intensity=1.2; bulb.range=8; }
  makeSurvivor(new Vector3(-5.7, 0, -10), 0); makeSurvivor(new Vector3(5.8, 0, 2), 1); makeSurvivor(new Vector3(-5.4, 0, 14), 2);
  [[2,-13],[-3,-4],[1,8],[4,17]].forEach(([x,z],i)=>makeGhost(new Vector3(x,0,z),i));
  return scene;
}

function attack() {
  if (state.over || state.punching || document.pointerLockElement !== canvas) return;
  state.punching = true; ui.hands.classList.add('punch'); setTimeout(()=>{ state.punching=false; ui.hands.classList.remove('punch'); }, 230);
  const forward = camera.getForwardRay().direction; let target = null, best = 3.1;
  for (const enemy of state.enemies) if (enemy.alive) {
    const delta = enemy.root.position.subtract(camera.position); const dist = delta.length();
    if (dist < best && Vector3.Dot(delta.normalize(), forward) > .72) { target = enemy; best = dist; }
  }
  if (!target) return;
  target.hp--; target.root.scaling.scaleInPlace(.9); setTimeout(()=>target.alive && target.root.scaling.scaleInPlace(1/.9),100);
  if (target.boss) ui.bossFill.style.width = `${Math.max(0,target.hp/target.maxHp*100)}%`;
  if (target.hp <= 0) { target.alive=false; target.root.dispose(); if(target.boss) win(); }
}

function hurt(amount) {
  state.health = Math.max(0, state.health - amount); ui.health.textContent = `♥ ${state.health}`;
  document.querySelector('#vignette').animate([{background:'#8c130000'},{background:'#8c130088'},{background:'#8c130000'}],{duration:300});
  if (state.health <= 0) end(false);
}
function win(){ end(true); }
function end(won){ state.over=true; document.exitPointerLock?.(); ui.hud.classList.add('hidden'); ui.ending.classList.remove('hidden'); ui.endingKicker.textContent=won?'YOU SURVIVED':'THE NIGHTMARE WON'; ui.endingTitle.innerHTML=won?'DAWN<br>CAN WAIT':'SLEEP<br>FOREVER'; ui.endingCopy.textContent=won?'The haunted souls are free. But the nightmare has only begun.':'The Butcher Chef is still waiting in the dark.'; }

function update(dt) {
  if (state.over || !state.started) return; state.time += dt;
  const f = camera.getDirection(new Vector3(0,0,1)); f.y=0; f.normalize(); const r = new Vector3(f.z,0,-f.x); let move=Vector3.Zero();
  if(state.keys.KeyW)move.addInPlace(f); if(state.keys.KeyS)move.subtractInPlace(f); if(state.keys.KeyD)move.addInPlace(r); if(state.keys.KeyA)move.subtractInPlace(r);
  if(move.lengthSquared()>0){move.normalize().scaleInPlace(4.5*dt); const next=camera.position.add(move); if(Math.abs(next.x)<8.35&&next.z>-24.2&&next.z<26.2)camera.position.addInPlace(move);}
  state.ySpeed -= 17*dt; camera.position.y += state.ySpeed*dt; if(camera.position.y<=1.75){camera.position.y=1.75;state.ySpeed=0;state.grounded=true;}
  let nearestSoul = Infinity;
  for(const soul of state.survivors) if(!soul.saved){ soul.root.position.y=Math.sin(state.time*2)*.08; const d=Vector3.Distance(camera.position,soul.root.position); nearestSoul=Math.min(nearestSoul,d); if(d<2.3){soul.saved=true;soul.root.dispose();soul.light.dispose();state.saved++;ui.souls.textContent=`SOULS ${state.saved} / 3`;ui.objective.textContent=state.saved<3?'Find the remaining souls':'Prepare for the Butcher Chef'; if(state.saved===3)setTimeout(makeChef,800);} }
  let danger=false;
  for(const e of state.enemies) if(e.alive){ const delta=camera.position.subtract(e.root.position);delta.y=0;const dist=delta.length(); if(dist<12){danger=true;e.root.lookAt(new Vector3(camera.position.x,e.root.position.y+1.2,camera.position.z)); if(dist>1.55)e.root.position.addInPlace(delta.normalize().scale(e.speed*dt)); else {e.cooldown-=dt;if(e.cooldown<=0){hurt(e.damage);e.cooldown=e.boss ? 0.8 : 1.15;}}} e.root.position.y=Math.sin(state.time*2+(e.boss?0:2))* (e.boss?0:.12); }
  ui.prompt.textContent=danger?'CLICK  •  WHACK':state.saved<3?`FOLLOW THE BLUE BEACON  •  ${Math.ceil(nearestSoul)}m\nWALK CLOSE TO THE PERSON TO RESCUE THEM`:'';
}

function startGame(){ ui.menu.classList.add('hidden');ui.ending.classList.add('hidden');ui.hud.classList.remove('hidden');ui.mission.classList.remove('hidden');ui.boss.classList.add('hidden');ui.bossFill.style.width='100%';ui.health.textContent='♥ 100';ui.souls.textContent='SOULS 0 / 3';ui.objective.textContent='Rescue 3 haunted souls'; if(scene)scene.dispose();createScene();state.started=true;canvas.requestPointerLock(); }
document.querySelector('#start').addEventListener('click',startGame);document.querySelector('#restart').addEventListener('click',startGame);
window.addEventListener('keydown',e=>{if(!state)return;state.keys[e.code]=true;if(e.code==='Space'&&state.grounded&&!state.over){state.ySpeed=6.5;state.grounded=false;e.preventDefault();}});
window.addEventListener('keyup',e=>state&&(state.keys[e.code]=false));window.addEventListener('mousedown',e=>e.button===0&&attack());canvas.addEventListener('click',()=>!state?.over&&document.pointerLockElement!==canvas&&canvas.requestPointerLock());
createScene();engine.runRenderLoop(()=>{const dt=Math.min(engine.getDeltaTime()/1000,.05);update(dt);scene.render();});window.addEventListener('resize',()=>engine.resize());
