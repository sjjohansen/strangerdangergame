import './style.css';
import './hands.css';
import './combat-feedback.css';
import {
  Engine, Scene, UniversalCamera, Vector3, Color3, Color4, HemisphericLight,
  PointLight, MeshBuilder, StandardMaterial, TransformNode, Animation,
  GlowLayer, ParticleSystem, Texture
} from '@babylonjs/core';

const canvas = document.querySelector('#game');
const engine = new Engine(canvas, true, { stencil: true });
const ui = {
  menu: document.querySelector('#menu'), hud: document.querySelector('#hud'),
  levelPicker: document.querySelector('#level-picker'),
  chapterLabel: document.querySelector('#chapter-label'), bossName: document.querySelector('#boss-name'),
  ending: document.querySelector('#ending'), objective: document.querySelector('#objective'),
  health: document.querySelector('#health'), souls: document.querySelector('#souls'),
  prompt: document.querySelector('#prompt'), hands: document.querySelector('.hands'),
  hitMarker: document.querySelector('#hit-marker'),
  mission: document.querySelector('#mission'),
  boss: document.querySelector('#boss'), bossFill: document.querySelector('#boss-fill'), bossBar2: document.querySelector('#boss-bar-2'), bossFill2: document.querySelector('#boss-fill-2'),
  endingKicker: document.querySelector('#ending-kicker'), endingTitle: document.querySelector('#ending-title'),
  endingCopy: document.querySelector('#ending-copy')
};

let scene, camera, state, nextChapter = 1, chapterCountdown, pickerWasRunning = false;
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

function makePrincipal() {
  const root = buildHumanoid('evil-principal', new Vector3(0, 0, 22), { body: '#171a24', skin: '#857067' }, 1.42);
  const suitMat = mat('principal-suit', '#11151e');
  const tieMat = mat('principal-tie', '#6f090d', '#310306');
  const hairMat = mat('principal-hair', '#171313');
  const jacket = MeshBuilder.CreateBox('principal-jacket', { width: .82, height: 1.25, depth: .5 }, scene); jacket.parent = root; jacket.position.set(0, 1.25, 0); jacket.material = suitMat;
  const tie = MeshBuilder.CreateBox('principal-tie', { width: .12, height: .72, depth: .04 }, scene); tie.parent = root; tie.position.set(0, 1.42, -.29); tie.material = tieMat;
  const hair = MeshBuilder.CreateSphere('principal-hair', { diameterX: .66, diameterY: .32, diameterZ: .62, segments: 12 }, scene); hair.parent = root; hair.position.set(0, 2.34, .02); hair.material = hairMat;
  const rulerMat = mat('ruler', '#6e4a28');
  const ruler = MeshBuilder.CreateBox('punishment-ruler', { width: .12, height: 1.45, depth: .08 }, scene); ruler.parent = root; ruler.position.set(.8, 1.05, -.25); ruler.rotation.z = -.35; ruler.material = rulerMat;
  const eyeMat = mat('principal-eyes', '#ef1a16', '#ef0808');
  for (const x of [-.14, .14]) { const eye = MeshBuilder.CreateSphere('principal-eye', { diameter: .07 }, scene); eye.parent=root; eye.position.set(x,2.18,-.31); eye.material=eyeMat; }
  state.enemies.push({ root, hp: 16, maxHp: 16, speed: 1.7, damage: 20, cooldown: 0, alive: true, boss: true });
  state.bossSpawned = true; ui.mission.classList.add('hidden'); ui.boss.classList.remove('hidden'); ui.objective.textContent = 'Defeat the Evil Principal';
}

function makeStranger() {
  const root = new TransformNode('the-stranger',scene);root.position.set(0,0,22);root.scaling.setAll(1.38);
  const hoodieMat = mat('hoodie-fabric', '#121722', '#090d18');
  const seamMat = mat('hoodie-seams', '#252d3b');
  const voidMat = mat('stranger-void', '#010103', '#020207');
  const shoeMat = mat('stranger-shoes','#06070a');
  const torso=MeshBuilder.CreateBox('hoodie-torso',{width:1.05,height:1.35,depth:.62},scene);torso.parent=root;torso.position.set(0,1.35,0);torso.material=hoodieMat;
  const shoulders=MeshBuilder.CreateCapsule('hoodie-shoulders',{height:1.15,radius:.32,tessellation:16},scene);shoulders.parent=root;shoulders.position.set(0,1.78,0);shoulders.rotation.z=Math.PI/2;shoulders.material=hoodieMat;
  for(const side of [-1,1]){
    const sleeve=MeshBuilder.CreateCapsule('hoodie-sleeve',{height:1.35,radius:.2,tessellation:14},scene);sleeve.parent=root;sleeve.position.set(side*.68,1.2,-.03);sleeve.rotation.z=side*-.11;sleeve.material=hoodieMat;
    const hand=MeshBuilder.CreateSphere('stranger-hand',{diameterX:.28,diameterY:.38,diameterZ:.25,segments:10},scene);hand.parent=root;hand.position.set(side*.76,.55,-.04);hand.material=voidMat;
    const leg=MeshBuilder.CreateCapsule('stranger-leg',{height:1.45,radius:.22,tessellation:14},scene);leg.parent=root;leg.position.set(side*.27,.3,0);leg.material=hoodieMat;
    const shoe=MeshBuilder.CreateBox('stranger-shoe',{width:.42,height:.22,depth:.72},scene);shoe.parent=root;shoe.position.set(side*.27,-.37,-.16);shoe.material=shoeMat;
  }
  const pocket=MeshBuilder.CreateBox('hoodie-pocket',{width:.65,height:.34,depth:.07},scene);pocket.parent=root;pocket.position.set(0,1.04,-.35);pocket.material=seamMat;
  const hood=MeshBuilder.CreateSphere('hood-fabric',{diameterX:1.02,diameterY:1.12,diameterZ:.86,segments:20},scene);hood.parent=root;hood.position.set(0,2.34,.02);hood.material=hoodieMat;
  const opening=MeshBuilder.CreateSphere('hood-shadow',{diameterX:.64,diameterY:.78,diameterZ:.16,segments:18},scene);opening.parent=root;opening.position.set(0,2.31,-.44);opening.material=voidMat;
  const hoodRim=MeshBuilder.CreateTorus('hood-rim',{diameter:.74,thickness:.1,tessellation:32},scene);hoodRim.parent=root;hoodRim.position.set(0,2.31,-.52);hoodRim.rotation.x=Math.PI/2;hoodRim.scaling.y=1.13;hoodRim.material=seamMat;
  for(const x of [-.18,.18]){const cord=MeshBuilder.CreateCylinder('hood-drawstring',{height:.58,diameter:.035,tessellation:8},scene);cord.parent=root;cord.position.set(x,1.83,-.39);cord.material=seamMat;const tip=MeshBuilder.CreateSphere('cord-tip',{diameter:.07,segments:7},scene);tip.parent=root;tip.position.set(x,1.53,-.39);tip.material=seamMat;}
  const eyeMat=mat('stranger-eyes','#f4f5ff','#b5c8ff');
  for(const x of [-.13,.13]){const eye=MeshBuilder.CreateSphere('stranger-eye',{diameterX:.08,diameterY:.045,diameterZ:.035,segments:8},scene);eye.parent=root;eye.position.set(x,2.35,-.55);eye.material=eyeMat;}
  const auraMat=mat('stranger-aura','#18203b','#243566');auraMat.alpha=.18;
  const aura=MeshBuilder.CreateTorus('stranger-aura',{diameter:2.5,thickness:.08,tessellation:40},scene);aura.parent=root;aura.position.y=.12;aura.material=auraMat;
  for(const mesh of root.getChildMeshes())if(mesh!==aura)mesh.position.y+=.52;
  state.enemies.push({ root, hp: 32, maxHp: 32, phaseHp: 16, speed: 1.8, damage: 22, cooldown: 0, alive: true, boss: true, twoBars: true });
  state.bossSpawned=true;ui.mission.classList.add('hidden');ui.boss.classList.remove('hidden');ui.bossBar2.classList.remove('hidden');ui.bossFill.style.width='100%';ui.bossFill2.style.width='100%';ui.objective.textContent='Defeat the Stranger';
}

function spawnBoss() { state.chapter === 1 ? makeChef() : state.chapter === 2 ? makePrincipal() : makeStranger(); }

function createScene(chapter = 1) {
  scene = new Scene(engine); scene.clearColor = new Color4(.018, .014, .012, 1); scene.collisionsEnabled = true;
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = .025; scene.fogColor = new Color3(.045, .03, .026);
  state = { chapter, health: 100, saved: 0, enemies: [], survivors: [], keys: {}, ySpeed: 0, grounded: true, punching: false, bossSpawned: false, over: false, started: false, time: 0 };
  camera = new UniversalCamera('player', new Vector3(0, 1.75, -21), scene); camera.minZ = .05; camera.fov = 1.05;
  camera.attachControl(canvas, true); camera.angularSensibility = 3400; camera.inputs.removeByType('FreeCameraKeyboardMoveInput');
  const hemi = new HemisphericLight('moon', new Vector3(.2, 1, .1), scene); hemi.diffuse = new Color3(.18, .2, .22); hemi.groundColor = new Color3(.06, .02, .018); hemi.intensity = .55;
  const playerLight = new PointLight('flicker', Vector3.Zero(), scene); playerLight.parent = camera; playerLight.position.set(0, .1, .2); playerLight.diffuse = new Color3(.65, .38, .25); playerLight.intensity = 1.4; playerLight.range = 12;
  const glow = new GlowLayer('glow', scene); glow.intensity = .45;
  const school = chapter === 2, rooftop = chapter === 3;
  scene.clearColor = rooftop ? new Color4(.003,.006,.02,1) : school ? new Color4(.012,.018,.025,1) : new Color4(.018,.014,.012,1);
  scene.fogColor = rooftop ? new Color3(.008,.012,.035) : school ? new Color3(.025,.04,.055) : new Color3(.045,.03,.026);
  scene.fogDensity = rooftop ? .012 : .025;
  const floorMat = mat('floor', rooftop ? '#191d29' : school ? '#26303a' : '#221b18'); const wallMat = mat('walls', rooftop ? '#303646' : school ? '#34414a' : '#312421'); const tileMat = mat('fixtures', rooftop ? '#515a6a' : school ? '#6d795f' : '#59463f'); const redMat = mat('blood', '#4c0b07');
  box('floor', [18, .4, 52], [0, -.2, 1], floorMat);
  if(rooftop){
    box('left-parapet',[.6,1.4,52],[-9,.7,1],wallMat);box('right-parapet',[.6,1.4,52],[9,.7,1],wallMat);box('back-parapet',[18,1.4,.6],[0,.7,-25],wallMat);box('far-parapet',[18,1.4,.6],[0,.7,27],wallMat);
  }else{
    box('ceiling', [18, .3, 52], [0, 5.2, 1], wallMat);box('left-wall', [.5, 5.4, 52], [-9, 2.5, 1], wallMat);box('right-wall', [.5, 5.4, 52], [9, 2.5, 1], wallMat);box('back-wall', [18, 5.4, .5], [0, 2.5, -25], wallMat);box('boss-wall', [18, 5.4, .5], [0, 2.5, 27], wallMat);
  }
  if (rooftop) {
    const starMat=mat('stars','#ffffff','#b9d2ff');starMat.disableLighting=true;
    for(let i=0;i<90;i++){const star=MeshBuilder.CreateSphere('star',{diameter:.035+(i%4)*.012,segments:4},scene);const angle=(i*2.399)%6.283;const radius=35+(i%7);star.position.set(Math.cos(angle)*radius,7+(i%13)*1.6,-2+Math.sin(angle)*radius);star.material=starMat;}
    const moonMat=mat('moon-disc','#dce6f2','#9eb9dc');moonMat.disableLighting=true;const moon=MeshBuilder.CreateSphere('moon',{diameter:3.2,segments:24},scene);moon.position.set(-18,16,18);moon.material=moonMat;
    for(let z=-17;z<20;z+=9){box('vent',[2.2,1.2,1.6],[z%18===0?-4.8:4.8,.6,z],tileMat);const pipe=MeshBuilder.CreateCylinder('roof-pipe',{height:2.4,diameter:.45,tessellation:12},scene);pipe.position.set(z%18===0?3.8:-3.8,1.2,z+3);pipe.material=wallMat;}
    const tankMat=mat('water-tank','#232a39');const tank=MeshBuilder.CreateCylinder('water-tank',{height:3.4,diameter:3,tessellation:18},scene);tank.position.set(-5.5,2,18);tank.material=tankMat;
    for(let z=-20;z<24;z+=10){const lamp=new PointLight('roof-warning-light',new Vector3(z%20===0?-7:7,2,z),scene);lamp.diffuse=new Color3(.55,.05,.08);lamp.intensity=2.2;lamp.range=8;}
    makeSurvivor(new Vector3(-5.8,0,-10),30);makeSurvivor(new Vector3(5.7,0,3),31);makeSurvivor(new Vector3(-4.8,0,15),32);
    [[2,-14],[-3,-4],[3,8],[-1,17],[5,20],[-5,7]].forEach(([x,z],i)=>makeGhost(new Vector3(x,0,z),40+i));
  } else if (school) {
    const lockerMat = mat('lockers', '#354b57'); const boardMat = mat('blackboards', '#142d27');
    for (let z=-20;z<22;z+=4) for (const x of [-8.55,8.55]) {
      const locker=box('dented-locker',[.28,2.3,1.2],[x,1.25,z],lockerMat); locker.rotation.y=x<0?Math.PI/2:-Math.PI/2;
    }
    for (let z=-16;z<20;z+=9) {
      for (const x of [-3.8,0,3.8]) { box('school-desk',[1.6,.16,.85],[x,.9,z],tileMat); box('desk-leg',[.12,.9,.12],[x-.55,.45,z],wallMat); box('desk-leg',[.12,.9,.12],[x+.55,.45,z],wallMat); }
    }
    box('nightmare-blackboard',[7,.12,2.1],[0,2.7,26.65],boardMat);
    for (let z=-21;z<24;z+=7) { const lamp=new PointLight('failing-fluorescent',new Vector3(0,4.65,z),scene);lamp.diffuse=new Color3(.35,.58,.7);lamp.intensity=1.5;lamp.range=9; box('light-fixture',[3,.08,.35],[0,4.75,z],mat(`lamp-${z}`,'#a8bbc0','#667f86')); }
    makeSurvivor(new Vector3(-5.8,0,-11),10); makeSurvivor(new Vector3(5.7,0,1),11); makeSurvivor(new Vector3(-5.5,0,15),12);
    [[2,-14],[-3,-5],[2,7],[4,17],[-2,20]].forEach(([x,z],i)=>makeGhost(new Vector3(x,0,z),20+i));
  } else {
    for (let z = -20; z < 22; z += 7) { box('table', [4.4, .22, 1.5], [z % 14 === 0 ? -4.8 : 4.8, 1.1, z], tileMat); for (const x of [-1.8, 1.8]) box('leg', [.18, 1.1, .18], [(z % 14 === 0 ? -4.8 : 4.8) + x, .55, z], wallMat); }
    for (let z = -18; z <= 18; z += 9) { const stain = MeshBuilder.CreateDisc('stain', { radius: .7 + Math.random() * .8, tessellation: 13 }, scene); stain.position.set((Math.random()-.5)*10,.015,z); stain.rotation.x=Math.PI/2; stain.material=redMat; }
    for (let z = -20; z < 24; z += 8) { const bulb = new PointLight('bulb', new Vector3((z%16)-4,4.5,z),scene); bulb.diffuse=new Color3(.5,.18,.1); bulb.intensity=1.2; bulb.range=8; }
    makeSurvivor(new Vector3(-5.7, 0, -10), 0); makeSurvivor(new Vector3(5.8, 0, 2), 1); makeSurvivor(new Vector3(-5.4, 0, 14), 2);
    [[2,-13],[-3,-4],[1,8],[4,17]].forEach(([x,z],i)=>makeGhost(new Vector3(x,0,z),i));
  }
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
  target.provoked=true;facePlayer(target);
  showHitFeedback(target);
  target.hp--; target.root.scaling.scaleInPlace(.88); setTimeout(()=>target.alive && target.root.scaling.scaleInPlace(1/.88),100);
  if (target.boss) updateBossHealth(target);
  if (target.hp <= 0) { target.alive=false; target.root.dispose(); if(target.boss) win(); }
}

function facePlayer(enemy){
  enemy.root.lookAt(new Vector3(camera.position.x,enemy.root.position.y+1.2,camera.position.z));
  enemy.root.rotation.y+=Math.PI;
}

function updateBossHealth(target){
  if(!target.twoBars){ui.bossFill.style.width=`${Math.max(0,target.hp/target.maxHp*100)}%`;return;}
  const firstPhase=Math.max(0,target.hp-target.phaseHp)/target.phaseHp*100;
  const finalPhase=Math.min(target.hp,target.phaseHp)/target.phaseHp*100;
  ui.bossFill.style.width=`${firstPhase}%`;ui.bossFill2.style.width=`${finalPhase}%`;
  if(target.hp===target.phaseHp){ui.bossName.textContent='THE STRANGER · FINAL PHASE';target.speed=2.15;target.damage=26;document.querySelector('#vignette').animate([{background:'#243da000'},{background:'#243da099'},{background:'#243da000'}],{duration:800});}
}

function showHitFeedback(target) {
  ui.hitMarker.classList.remove('confirm'); ui.hud.classList.remove('impact');
  void ui.hitMarker.offsetWidth;
  ui.hitMarker.classList.add('confirm'); ui.hud.classList.add('impact');
  for (const mesh of target.root.getChildMeshes()) {
    mesh.renderOverlay = true; mesh.overlayColor = new Color3(1, .05, .015); mesh.overlayAlpha = .82;
  }
  const impact = new PointLight('punch-impact', target.root.position.add(new Vector3(0,1.3,0)), scene);
  impact.diffuse = new Color3(1,.08,.02); impact.intensity = 12; impact.range = 4;
  setTimeout(() => {
    if (target.alive) for (const mesh of target.root.getChildMeshes()) mesh.renderOverlay = false;
    impact.dispose(); ui.hud.classList.remove('impact');
  }, 120);
}

function hurt(amount) {
  state.health = Math.max(0, state.health - amount); ui.health.textContent = `♥ ${state.health}`;
  document.querySelector('#vignette').animate([{background:'#8c130000'},{background:'#8c130088'},{background:'#8c130000'}],{duration:300});
  if (state.health <= 0) end(false);
}
function win(){
  if(state.chapter===3){end(true);return;}
  state.over=true;nextChapter=state.chapter+1;document.exitPointerLock?.();ui.hud.classList.add('hidden');ui.ending.classList.remove('hidden');
  ui.endingKicker.textContent=`CHAPTER ${state.chapter} COMPLETE`;
  ui.endingTitle.innerHTML=state.chapter===1?'THE KITCHEN<br>IS CLEARED':'SCHOOL<br>IS OUT';
  ui.endingCopy.textContent=state.chapter===1?'The Butcher Chef is defeated and the trapped souls are safe. But a school bell is ringing deeper in the nightmare.':'The Evil Principal is defeated. Above the silent school, a hooded figure is waiting on the roof.';
  const continueButton=document.querySelector('#restart');let seconds=5;continueButton.disabled=true;continueButton.textContent=`CHAPTER ${nextChapter} UNLOCKS IN ${seconds}`;
  clearInterval(chapterCountdown);chapterCountdown=setInterval(()=>{seconds--;if(seconds>0){continueButton.textContent=`CHAPTER ${nextChapter} UNLOCKS IN ${seconds}`;}else{clearInterval(chapterCountdown);continueButton.disabled=false;continueButton.textContent=`START CHAPTER ${nextChapter}`;}},1000);
}
function end(won){ state.over=true; clearInterval(chapterCountdown); nextChapter=won?1:state.chapter; document.exitPointerLock?.(); ui.hud.classList.add('hidden'); ui.ending.classList.remove('hidden'); ui.endingKicker.textContent=won?'CHAPTER 3 COMPLETE':'THE NIGHTMARE WON'; ui.endingTitle.innerHTML=won?'THE STRANGER<br>IS GONE':'SLEEP<br>FOREVER'; const defeatCopy=['','The Butcher Chef is still waiting in the dark.','The Evil Principal has trapped every soul in detention.','The Stranger has claimed the rooftop.'];ui.endingCopy.textContent=won?'The hooded Stranger is defeated. For now, the nightmare has released its hold.':defeatCopy[state.chapter]; const restartButton=document.querySelector('#restart');restartButton.disabled=false;restartButton.textContent=won?'PLAY AGAIN':`RETRY CHAPTER ${state.chapter}`; }

function update(dt) {
  if (state.over || !state.started) return; state.time += dt;
  const f = camera.getDirection(new Vector3(0,0,1)); f.y=0; f.normalize(); const r = new Vector3(f.z,0,-f.x); let move=Vector3.Zero();
  if(state.keys.KeyW)move.addInPlace(f); if(state.keys.KeyS)move.subtractInPlace(f); if(state.keys.KeyD)move.addInPlace(r); if(state.keys.KeyA)move.subtractInPlace(r);
  if(move.lengthSquared()>0){move.normalize().scaleInPlace(4.5*dt); const next=camera.position.add(move); if(Math.abs(next.x)<8.35&&next.z>-24.2&&next.z<26.2)camera.position.addInPlace(move);}
  state.ySpeed -= 17*dt; camera.position.y += state.ySpeed*dt; if(camera.position.y<=1.75){camera.position.y=1.75;state.ySpeed=0;state.grounded=true;}
  let nearestSoul = Infinity;
  for(const soul of state.survivors) if(!soul.saved){ soul.root.position.y=Math.sin(state.time*2)*.08; const d=Vector3.Distance(camera.position,soul.root.position); nearestSoul=Math.min(nearestSoul,d); if(d<2.3){soul.saved=true;soul.root.dispose();soul.light.dispose();state.saved++;ui.souls.textContent=`SOULS ${state.saved} / 3`;const bossObjectives=['','Prepare for the Butcher Chef','Report to the Principal’s office','Something is waiting beneath the moon'];ui.objective.textContent=state.saved<3?'Find the remaining souls':bossObjectives[state.chapter]; if(state.saved===3)setTimeout(spawnBoss,800);} }
  let danger=false;
  for(const e of state.enemies) if(e.alive){ const delta=camera.position.subtract(e.root.position);delta.y=0;const dist=delta.length(); if(dist<12||e.provoked){danger=true;facePlayer(e); if(dist>1.55)e.root.position.addInPlace(delta.normalize().scale(e.speed*dt)); else {e.cooldown-=dt;if(e.cooldown<=0){hurt(e.damage);e.cooldown=e.boss ? 0.8 : 1.15;}}} e.root.position.y=Math.sin(state.time*2+(e.boss?0:2))* (e.boss?0:.12); }
  ui.prompt.textContent=danger?'CLICK  •  WHACK':state.saved<3?`FOLLOW THE BLUE BEACON  •  ${Math.ceil(nearestSoul)}m\nWALK CLOSE TO THE PERSON TO RESCUE THEM`:'';
}

function startGame(chapter=1){ clearInterval(chapterCountdown);ui.levelPicker.classList.add('hidden');ui.menu.classList.add('hidden');ui.ending.classList.add('hidden');ui.hud.classList.remove('hidden');ui.mission.classList.remove('hidden');ui.boss.classList.add('hidden');ui.bossBar2.classList.add('hidden');ui.bossFill.style.width='100%';ui.bossFill2.style.width='100%';ui.health.textContent='♥ 100';ui.souls.textContent='SOULS 0 / 3';ui.objective.textContent='Rescue 3 haunted souls';const chapterNames=['',"CHAPTER 1 · THE BUTCHER'S KITCHEN","CHAPTER 2 · NIGHTMARE HIGH","CHAPTER 3 · THE ROOFTOP"];const bossNames=['','THE BUTCHER CHEF','THE EVIL PRINCIPAL','THE STRANGER'];ui.chapterLabel.textContent=chapterNames[chapter];ui.bossName.textContent=bossNames[chapter]; if(scene)scene.dispose();createScene(chapter);state.started=true;canvas.requestPointerLock(); }
function openLevelPicker(){if(!ui.levelPicker.classList.contains('hidden'))return;pickerWasRunning=Boolean(state?.started&&!state.over);if(state)state.started=false;document.exitPointerLock?.();ui.levelPicker.classList.remove('hidden');}
function closeLevelPicker(){ui.levelPicker.classList.add('hidden');if(pickerWasRunning&&state&&!state.over){state.started=true;canvas.requestPointerLock();}}
document.querySelector('#start').addEventListener('click',()=>startGame(1));document.querySelector('#restart').addEventListener('click',()=>startGame(nextChapter));
document.querySelectorAll('[data-chapter]').forEach(button=>button.addEventListener('click',()=>startGame(Number(button.dataset.chapter))));document.querySelector('#close-picker').addEventListener('click',closeLevelPicker);
window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyL'){e.preventDefault();openLevelPicker();return;}if(e.code==='Escape'&&!ui.levelPicker.classList.contains('hidden')){closeLevelPicker();return;}if(!state)return;state.keys[e.code]=true;if(e.code==='Space'&&state.grounded&&!state.over){state.ySpeed=6.5;state.grounded=false;e.preventDefault();}});
window.addEventListener('keyup',e=>state&&(state.keys[e.code]=false));window.addEventListener('mousedown',e=>e.button===0&&attack());canvas.addEventListener('click',()=>!state?.over&&document.pointerLockElement!==canvas&&canvas.requestPointerLock());
createScene();engine.runRenderLoop(()=>{const dt=Math.min(engine.getDeltaTime()/1000,.05);update(dt);scene.render();});window.addEventListener('resize',()=>engine.resize());
