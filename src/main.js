import * as THREE from 'three';
import { World, SPAWN, WATER_LEVEL } from './world.js';
import { createHumanoid, createGoblin } from './character.js';
import { UI } from './ui.js';
import { SoundEngine } from './audio.js';
import { ITEMS, HOTBAR, SKILLS } from './items.js';
import {
  clamp, lerp, damp, rand, randInt, choice, dist2, makeTextSprite,
  makeBarSprite, makeGlowTexture, setSeed,
} from './utils.js';

setSeed(1337);

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'grab';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc8d0b4, 0.0058);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 700);
camera.position.set(8, 9, 28);

const sunDir = new THREE.Vector3(-0.48, 0.4, -0.78).normalize();
const hemi = new THREE.HemisphereLight(0xcfe4f7, 0x3e4b31, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdfab, 2.75);
sun.position.copy(sunDir).multiplyScalar(90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -62;
sun.shadow.camera.right = 62;
sun.shadow.camera.top = 62;
sun.shadow.camera.bottom = -62;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 230;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.035;
sun.target.position.set(0, 0, -12);
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0x9dbcdb, 0.5);
fill.position.set(30, 30, 45);
scene.add(fill);
scene.add(new THREE.AmbientLight(0x33402f, 0.28));

function createEnvironment() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#5b91c4');
  grad.addColorStop(0.44, '#a7c7d8');
  grad.addColorStop(0.54, '#f2d8ab');
  grad.addColorStop(0.56, '#7a8664');
  grad.addColorStop(1, '#38452f');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 512);
  const sx = 512 - 0.48 * 420;
  const sy = 256 - 0.4 * 180;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 160);
  glow.addColorStop(0, 'rgba(255,246,213,1)');
  glow.addColorStop(0.1, 'rgba(255,225,160,.9)');
  glow.addColorStop(0.5, 'rgba(255,196,110,.18)');
  glow.addColorStop(1, 'rgba(255,190,100,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1024, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.62;
  tex.dispose();
  pmrem.dispose();
}
createEnvironment();

const world = new World(scene, renderer);

const audio = new SoundEngine();

const player = {
  x: SPAWN.x, z: SPAWN.z, y: 0,
  hp: 82, maxHp: 99, run: 100, maxRun: 100,
  coins: 25, melee: 12, defence: 10,
  facing: Math.PI, vx: 0, vz: 0, speed: 0,
  dead: false, dodgeTime: 0, dodgeCooldown: 0, invuln: 0,
};
player.y = world.heightAt(player.x, player.z);

const playerModel = createHumanoid({
  shirt: 0x385a7e, pants: 0x3a3a42, hair: 0x3a2618,
  cape: true, shield: true, scale: 0.98,
});
playerModel.root.position.set(player.x, player.y, player.z);
playerModel.root.rotation.y = player.facing;
playerModel.setTool('sword');
scene.add(playerModel.root);

const contactTexture = makeGlowTexture('rgba(0,0,0,.6)', 'rgba(0,0,0,0)');
const contactShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.4, 2.4),
  new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, opacity: 0.34, depthWrite: false, color: 0x000000 })
);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.renderOrder = 1;
scene.add(contactShadow);

const inventory = [
  { id: 'bronze_sword', count: 1 },
  { id: 'oak_shield', count: 1 },
  { id: 'iron_axe', count: 1 },
  { id: 'iron_pickaxe', count: 1 },
  { id: 'trout', count: 3 },
  { id: 'prayer_potion', count: 1 },
  { id: 'oak_logs', count: 2 },
  { id: 'iron_ore', count: 1 },
  null, null, null, null, null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
];
let equippedId = 'bronze_sword';
let selectedId = 'bronze_sword';
let activeSkill = 'attack';
const skills = SKILLS.map((s) => ({ ...s }));
const quest = { status: 'unstarted', kills: 0, required: 5 };

const ui = new UI(world, {
  onHotbarClick: (i) => { audio.ensure(); audio.click(); useHotbar(i); },
  onInventoryClick: (i) => { audio.ensure(); audio.click(); useInventory(i); },
  onSoundToggle: () => {
    audio.ensure();
    const muted = audio.toggle();
    ui.setSoundMuted(muted);
    ui.toast(muted ? 'Ambient sound muted' : 'Ambient sound enabled', '', muted ? '♪' : '♫');
  },
  onChat: (text) => handleChat(text),
  onWaypoint: (x, z) => setWaypoint(x, z),
  onDialogOpen: () => { moveTarget = null; },
  onDialogClose: () => {},
});

// ----- NPCs ----------------------------------------------------------------
const npcOptions = {
  elder: { shirt: 0x3d4a63, pants: 0x333840, hair: 0xcac1ad, beard: true, hood: true, robe: true, staff: true, scale: 1.01 },
  merchant: { shirt: 0x743b3f, pants: 0x393137, hair: 0x5b3b23, apron: true, female: true, scale: 0.93 },
  smith: { shirt: 0x4a3b2d, pants: 0x39342b, hair: 0x2b2118, apron: true, bulky: true, scale: 1.06 },
  villager: { shirt: 0x4f6b55, pants: 0x3b3a42, hair: 0x70462a, scale: 0.92 },
  villager2: { shirt: 0x6a593b, pants: 0x3b3b40, hair: 0x332318, scale: 0.94 },
};
const npcs = [];
const npcNames = new Set();
for (const spot of world.npcSpots) {
  const opts = npcOptions[spot.role] || npcOptions.villager;
  const model = createHumanoid(opts);
  const y = world.heightAt(spot.x, spot.z);
  model.root.position.set(spot.x, y, spot.z);
  model.root.rotation.y = spot.rot;
  model.state.phase = rand(0, 8);
  scene.add(model.root);
  if (spot.role === 'smith') model.setAction('mine');
  const npc = {
    ...spot, model, homeX: spot.x, homeZ: spot.z,
    baseY: y, facing: spot.rot, phase: rand(0, 8),
    quest: spot.quest || false,
  };
  const nameplate = makeTextSprite(spot.name, {
    font: '600 34px Inter, sans-serif', color: '#f3dda6', stroke: 'rgba(9,13,10,.95)', scale: 0.53, depthTest: true,
  });
  nameplate.position.set(0, model.height + 0.34, 0);
  model.root.add(nameplate);
  npc.nameplate = nameplate;
  npcs.push(npc);
  npcNames.add(spot.id);
}
const rowan = npcs.find((n) => n.id === 'rowan');

function makeQuestMarker(glyph) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
  g.addColorStop(0, 'rgba(255,240,190,.95)');
  g.addColorStop(0.28, 'rgba(231,190,95,.35)');
  g.addColorStop(1, 'rgba(231,190,95,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  ctx.font = '700 86px Cinzel, Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(55,31,8,.9)';
  ctx.strokeText(glyph, 64, 66);
  const grad = ctx.createLinearGradient(0, 20, 0, 105);
  grad.addColorStop(0, '#fff1bd'); grad.addColorStop(1, '#d29d3d');
  ctx.fillStyle = grad; ctx.fillText(glyph, 64, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(0.9, 0.9, 1);
  sprite.renderOrder = 22;
  return sprite;
}
const markerExclaim = makeQuestMarker('!');
const markerQuestion = makeQuestMarker('?');
markerExclaim.position.set(rowan.x, rowan.baseY + 2.55, rowan.z);
markerQuestion.position.copy(markerExclaim.position);
markerQuestion.visible = false;
scene.add(markerExclaim, markerQuestion);

// ----- Goblins -------------------------------------------------------------
const enemies = [];
for (const [index, spot] of world.goblinSpots.entries()) {
  const model = createGoblin();
  const y = world.heightAt(spot.x, spot.z);
  model.root.position.set(spot.x, y, spot.z);
  const home = { x: spot.x, z: spot.z };
  const enemy = {
    id: index, name: 'Goblin', levelText: 'Combat 3', level: 3,
    x: spot.x, z: spot.z, baseY: y, hp: 30, maxHp: 30,
    alive: true, home, patrol: spot.patrol, model,
    facing: rand(0, Math.PI * 2), attackCooldown: rand(0, 1.5),
    deathT: 0, respawnT: 0, hurtT: 0, speed: 0,
    target: false, wanderAngle: rand(0, Math.PI * 2), wanderT: rand(0, 3),
  };
  model.root.rotation.y = enemy.facing;
  model.root.traverse((o) => { o.userData.enemyRef = enemy; });
  const plate = makeTextSprite('Goblin', {
    font: '600 30px Inter, sans-serif', color: '#efb0a4', stroke: 'rgba(12,8,7,.95)', scale: 0.42, depthTest: true,
  });
  plate.position.set(0, model.height + 0.28, 0);
  model.root.add(plate);
  enemy.plate = plate;
  const bar = makeBarSprite(0.95, 0.11);
  bar.material.depthTest = true;
  bar.position.set(0, model.height + 0.05, 0);
  bar.visible = false;
  model.root.add(bar);
  enemy.bar = bar;
  enemies.push(enemy);
}

// ----- Quest UI ------------------------------------------------------------
function refreshQuest() {
  if (quest.status === 'unstarted') {
    ui.setQuest({ title: 'The Goblin Menace', text: 'Speak with <b>Elder Rowan</b> by the fire in the village square.', objective: null });
    rowan.quest = true;
  } else if (quest.status === 'active') {
    ui.setQuest({
      title: 'The Goblin Menace',
      text: 'Elder Rowan asked you to drive the goblins from the western woods.',
      objective: { current: quest.kills, total: quest.required, label: 'goblins slain' },
    });
    rowan.quest = quest.kills >= quest.required;
  } else {
    ui.setQuest({ title: 'The Goblin Menace', text: 'The Vale is safer thanks to you. Speak with Elder Rowan if you wish to hear his thanks again.', objective: null });
    rowan.quest = false;
  }
  updateMarker();
}
function updateMarker() {
  const showExclaim = quest.status === 'unstarted';
  const showQuestion = quest.status === 'active' && quest.kills >= quest.required;
  markerExclaim.visible = showExclaim;
  markerQuestion.visible = showQuestion;
}

// ----- Chat / toasts / effects --------------------------------------------
function addChat(text, type = 'game', speaker = '') { ui.chat(text, type, speaker); }

function floatText(text, color, position, scale = 0.85) {
  const sprite = makeTextSprite(text, {
    font: '700 42px Inter, sans-serif', color, stroke: 'rgba(8,10,8,.95)', scale,
  });
  sprite.position.copy(position);
  scene.add(sprite);
  floaters.push({ sprite, life: 1.15, maxLife: 1.15, vy: 1.45, baseScale: sprite.scale.clone() });
}
const floaters = [];

function burst(position, color = 0xffcb70, count = 14, speed = 3.2, size = 0.18) {
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x + rand(-0.18, 0.18);
    positions[i * 3 + 1] = position.y + rand(-0.1, 0.3);
    positions[i * 3 + 2] = position.z + rand(-0.18, 0.18);
    const a = rand(0, Math.PI * 2), b = rand(0.2, 1);
    velocities.push(new THREE.Vector3(Math.cos(a) * speed * b, rand(0.6, 1.8) * speed * 0.5, Math.sin(a) * speed * b));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: makeGlowTexture(), color, size, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  effects.push({ points, velocities, life: 0.85, maxLife: 0.85 });
}
const effects = [];

// ----- Inventory -----------------------------------------------------------
function countItem(id) {
  return inventory.reduce((sum, item) => item && item.id === id ? sum + item.count : sum, 0);
}
function addItem(id, count = 1) {
  const def = ITEMS[id];
  if (!def) return false;
  if (def.stack || count > 1) {
    const existing = inventory.find((item) => item && item.id === id);
    if (existing) { existing.count += count; return true; }
  }
  const empty = inventory.findIndex((item) => !item);
  if (empty === -1) {
    ui.toast('Your inventory is full.', 'bad', '!');
    return false;
  }
  inventory[empty] = { id, count };
  return true;
}
function removeItem(id, count = 1) {
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (!item || item.id !== id) continue;
    item.count -= count;
    if (item.count <= 0) inventory[i] = null;
    return true;
  }
  return false;
}
function useInventory(index) {
  const item = inventory[index];
  if (!item) return;
  useItem(item.id);
}
function useHotbar(index) {
  const slot = HOTBAR[index];
  if (!slot) return;
  if (slot.special === 'teleport') {
    teleportHome();
    return;
  }
  useItem(slot.id);
}
function useItem(id) {
  const def = ITEMS[id];
  if (!def) return;
  if (id === 'home_rune') { teleportHome(); return; }
  if (def.tool) {
    if (!countItem(id)) { ui.toast('You no longer carry that tool.', 'bad', '!'); return; }
    equippedId = id;
    selectedId = id;
    playerModel.setTool(def.tool);
    audio.ensure(); audio.click();
    ui.toast(`${def.name} equipped`, '', '⚔');
    renderInventoryUI();
    return;
  }
  if (def.heal) {
    if (!countItem(id)) { ui.toast(`You have no ${def.name.toLowerCase()} left.`, 'bad', '!'); return; }
    if (player.hp >= player.maxHp) { ui.toast('You are already at full health.', '', '♥'); return; }
    removeItem(id, 1);
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + def.heal);
    audio.ensure(); audio.eat();
    floatText(`+${Math.round(player.hp - before)}`, '#84e0a1', new THREE.Vector3(player.x, player.y + 2.15, player.z));
    ui.toast(`${def.name} restores ${Math.round(player.hp - before)} hitpoints.`, 'good', '♥');
    addChat(`You eat a ${def.name.toLowerCase()}. It restores ${Math.round(player.hp - before)} hitpoints.`, 'good');
    renderInventoryUI();
    return;
  }
  if (def.run) {
    if (!countItem(id)) { ui.toast(`You have no ${def.name.toLowerCase()} left.`, 'bad', '!'); return; }
    removeItem(id, 1);
    player.run = Math.min(player.maxRun, player.run + def.run);
    audio.ensure(); audio.tone(440, 0.35, { type: 'sine', volume: 0.06, slide: 660 });
    floatText(`+${def.run} run`, '#8fd8a8', new THREE.Vector3(player.x, player.y + 2.15, player.z));
    ui.toast('Your run energy is restored.', 'good', '✦');
    renderInventoryUI();
    return;
  }
  if (id === 'oak_shield') {
    equippedId = id;
    ui.toast('Oak shield equipped', '', '🛡');
    renderInventoryUI();
    return;
  }
  if (id === 'rune_stone') {
    ui.toast('The rune stone hums softly in your hand.', '', '✦');
    addChat('The rune stone is cold, yet it hums like a struck bell.', 'game');
    return;
  }
  if (def.type === 'Resource' || def.type === 'Trophy') {
    addChat(`${def.name}: ${def.desc}`, 'game');
    ui.toast(def.name, '', '◆');
  }
}

function renderInventoryUI() {
  ui.renderInventory(inventory, equippedId, selectedId);
  ui.renderHotbar(selectedId, inventory);
  ui.renderSkills(skills, activeSkill);
}

// ----- XP and levels -------------------------------------------------------
function gainXp(skillId, amount) {
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) return;
  skill.xp += amount;
  activeSkill = skillId;
  floatText(`+${amount} ${skill.name}`, '#e6cf87', new THREE.Vector3(player.x, player.y + 2.3, player.z), 0.7);
  while (skill.xp >= skill.next) {
    skill.prev = skill.next;
    skill.level += 1;
    skill.next = Math.round(skill.next + 120 + skill.level * 22);
    ui.showLevelUp(skill.name, skill.level);
    ui.toast(`Level ${skill.level} ${skill.name}!`, 'level', '★');
    addChat(`Congratulations, you have reached level <b>${skill.level}</b> in ${skill.name}.`, 'exp');
    audio.ensure();
    audio.levelUp();
    burst(new THREE.Vector3(player.x, player.y + 1.2, player.z), 0xffdb8a, 30, 4.2, 0.24);
  }
}

// ----- Interactions --------------------------------------------------------
let currentInteraction = null;
let gather = null;
let moveTarget = null;
let pendingNpc = null;
let targetEnemy = null;
let pendingHit = null;
let attackCooldown = 0;
let teleportCooldown = 0;
let fireCooldown = 0;
let altarCooldown = 0;
let cameraShake = 0;
let cameraYaw = 0.16;
let cameraPitch = 0.28;
let cameraDistance = 8.6;
let lastUiUpdate = 0;
let elapsed = 0;

const moveMarker = new THREE.Group();
const markerRing = new THREE.Mesh(
  new THREE.RingGeometry(0.32, 0.48, 24),
  new THREE.MeshBasicMaterial({ color: 0xf0d48a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
);
markerRing.rotation.x = -Math.PI / 2;
moveMarker.add(markerRing);
const markerDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.1, 12),
  new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.9, depthWrite: false })
);
markerDot.rotation.x = -Math.PI / 2;
moveMarker.add(markerDot);
moveMarker.visible = false;
scene.add(moveMarker);

const waypointMarker = new THREE.Group();
const waypointRing = new THREE.Mesh(
  new THREE.RingGeometry(0.55, 0.72, 28),
  new THREE.MeshBasicMaterial({ color: 0xf0d48a, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
);
waypointRing.rotation.x = -Math.PI / 2;
waypointMarker.add(waypointRing);
const waypointGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture('rgba(255,233,176,1)', 'rgba(255,200,90,0)'),
  color: 0xffdd93, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
}));
waypointGlow.position.y = 1.4;
waypointGlow.scale.set(1.8, 1.8, 1);
waypointMarker.add(waypointGlow);
waypointMarker.visible = false;
scene.add(waypointMarker);

function setWaypoint(x, z) {
  waypointMarker.position.set(x, world.heightAt(x, z) + 0.1, z);
  waypointMarker.visible = true;
  audio.ensure(); audio.tone(680, 0.25, { type: 'sine', volume: 0.04, slide: 920 });
  ui.toast('Waypoint marked on the world map.', '', '◆');
}

function nearestInteractable() {
  if (player.dead || ui.isDialogOpen() || gather) return null;
  const list = [];
  for (const npc of npcs) {
    const d = dist2(player.x, player.z, npc.x, npc.z);
    if (d < 3.15) list.push({ type: 'npc', npc, dist: d, label: npc.id === 'rowan' ? 'Talk to Elder Rowan' : `Talk to ${npc.name}` });
  }
  for (const tree of world.trees) {
    if (tree.userData.cooldown > 0) continue;
    const d = dist2(player.x, player.z, tree.position.x, tree.position.z);
    if (d < 2.7) {
      const kind = tree.userData.treeType;
      list.push({ type: 'tree', target: tree, dist: d, label: `Chop ${kind === 'pine' ? 'pine' : kind === 'birch' ? 'birch' : 'oak'} tree` });
    }
  }
  for (const rock of world.rocks) {
    if (rock.userData.cooldown > 0) continue;
    const d = dist2(player.x, player.z, rock.position.x, rock.position.z);
    if (d < 2.8) {
      const ore = rock.userData.ore;
      list.push({ type: 'rock', target: rock, dist: d, label: ore === 'gold' ? 'Mine gold vein' : ore === 'iron' ? 'Mine iron vein' : 'Mine rock' });
    }
  }
  for (const obj of world.interactables) {
    const d = dist2(player.x, player.z, obj.x, obj.z);
    if (d < obj.radius) {
      if (obj.type === 'altar') list.push({ type: 'altar', obj, dist: d, label: 'Touch the Ancient Altar' });
      if (obj.type === 'dock') list.push({ type: 'dock', obj, dist: d, label: 'Look out over Mirror Lake' });
    }
  }
  if (world.fire) {
    const d = dist2(player.x, player.z, world.fire.position.x, world.fire.position.z);
    if (d < 2.6) list.push({ type: 'fire', dist: d, label: 'Warm yourself at the fire' });
  }
  list.sort((a, b) => a.dist - b.dist);
  return list[0] || null;
}

function interact() {
  if (!currentInteraction || player.dead) return;
  audio.ensure();
  const int = currentInteraction;
  if (int.type === 'npc') { talkTo(int.npc); return; }
  if (int.type === 'tree') { startGather('tree', int.target); return; }
  if (int.type === 'rock') { startGather('rock', int.target); return; }
  if (int.type === 'altar') { touchAltar(); return; }
  if (int.type === 'dock') {
    addChat('Mirror Lake lies still beneath the evening sky. Somewhere out there, a fish leaps.', 'game');
    ui.toast('Mirror Lake', '', '✦');
    return;
  }
  if (int.type === 'fire') {
    if (fireCooldown > 0) { ui.toast('The fire is warm, but you need a moment.', '', '♥'); return; }
    const healed = Math.min(player.maxHp - player.hp, 10);
    player.hp += healed;
    fireCooldown = 12;
    if (healed > 0) floatText(`+${healed}`, '#84e0a1', new THREE.Vector3(player.x, player.y + 2.1, player.z));
    ui.toast(healed > 0 ? `The fire restores ${healed} hitpoints.` : 'You soak in the warmth of the fire.', 'good', '♥');
    addChat('You warm your hands at the village fire.', 'game');
  }
}

function startGather(type, target) {
  if (gather) return;
  const needed = type === 'tree' ? { tool: 'axe', id: 'iron_axe', skill: 'Woodcutting' } : { tool: 'pickaxe', id: 'iron_pickaxe', skill: 'Mining' };
  if (!countItem(needed.id)) {
    ui.toast(`You need an ${needed.tool} to do that.`, 'bad', '!');
    audio.error();
    return;
  }
  if (selectedId !== needed.id) {
    selectedId = needed.id; equippedId = needed.id;
    playerModel.setTool(needed.tool);
    renderInventoryUI();
  }
  const dx = target.position.x - player.x, dz = target.position.z - player.z;
  player.facing = Math.atan2(dx, dz);
  moveTarget = null;
  targetEnemy = null;
  ui.setTarget(null);
  const label = type === 'tree' ? 'Chopping...' : 'Mining...';
  gather = {
    type, target, time: 0, duration: 1.45,
    label: type === 'tree'
      ? `Chopping ${target.userData.treeType === 'pine' ? 'pine' : target.userData.treeType === 'birch' ? 'birch' : 'oak'}...`
      : `Mining ${target.userData.ore || 'rock'}...`,
    soundT: 0,
  };
  playerModel.setAction(type === 'tree' ? 'chop' : 'mine');
  ui.setHarvest(gather.label, 0);
}

function completeGather() {
  if (!gather) return;
  const { type, target } = gather;
  if (type === 'tree') {
    const amount = randInt(1, 2);
    addItem('oak_logs', amount);
    gainXp('woodcutting', 24 + amount * 4);
    target.userData.highCooldown = 16;
    target.userData.cooldown = 16;
    if (target.userData.canopy) target.userData.canopy.visible = false;
    burst(new THREE.Vector3(target.position.x, target.position.y + 3, target.position.z), 0x7fb45c, 15, 2.4, 0.16);
    addChat(`You chop ${amount} oak log${amount > 1 ? 's' : ''}.`, 'good');
    ui.toast(`+${amount} Oak logs`, 'good', '◆');
    audio.chop();
  } else {
    const ore = target.userData.ore;
    const itemId = ore === 'gold' ? 'gold_ore' : ore === 'iron' ? 'iron_ore' : 'iron_ore';
    const amount = randInt(1, ore ? 2 : 1);
    addItem(itemId, amount);
    gainXp('mining', 26 + amount * 4);
    target.userData.cooldown = 15;
    for (const child of target.children) {
      if (child.isMesh && child.geometry && child.geometry.type === 'IcosahedronGeometry') child.visible = false;
    }
    burst(new THREE.Vector3(target.position.x, target.position.y + 1, target.position.z), ore === 'gold' ? 0xffcc55 : 0xbfc9cc, 16, 2.8, 0.15);
    addChat(`You mine ${amount} ${itemId === 'gold_ore' ? 'gold' : 'iron'} ore${amount > 1 ? 's' : ''}.`, 'good');
    ui.toast(`+${amount} ${itemId === 'gold_ore' ? 'Gold' : 'Iron'} ore`, 'good', '◆');
    audio.mine();
  }
  gather = null;
  playerModel.setAction(null);
  ui.setHarvest(null, 0);
  renderInventoryUI();
}

function touchAltar() {
  if (altarCooldown > 0) {
    ui.toast('The old stones are quiet. Give them time.', '', '✦');
    return;
  }
  altarCooldown = 60;
  player.hp = player.maxHp;
  player.run = player.maxRun;
  if (addItem('rune_stone', 1)) ui.toast('A rune stone hums into your pack.', 'good', '✦');
  burst(new THREE.Vector3(player.x, player.y + 1.2, player.z), 0x7bf0e4, 28, 3.8, 0.2);
  audio.ensure();
  audio.quest();
  ui.showLevelUp('Blessing of the Stones', '✦');
  addChat('The ancient stones pulse with pale light. You feel restored.', 'exp');
  setWaypoint(rowan.x, rowan.z);
}

function talkTo(npc) {
  moveTarget = null;
  const dx = player.x - npc.x, dz = player.z - npc.z;
  npc.facing = Math.atan2(dx, dz);
  npc.model.root.rotation.y = npc.facing;
  if (npc.id === 'rowan') {
    if (quest.status === 'unstarted') {
      ui.openDialog({
        name: 'Elder Rowan',
        portrait: 'R',
        text: 'You have the look of someone who has not yet found their place in the world, Aeron. Good. Mistwood has need of such folk.<br><br>The goblins of the western wood have grown bold. They harry Marta\'s cart, steal from the shrine, and frighten the children. <b>Five goblins</b> must be driven off. Will you take up the task?',
        actions: [
          { label: 'Not yet', close: true },
          {
            label: 'I will help', primary: true,
            onClick: () => {
              quest.status = 'active';
              refreshQuest();
              audio.quest();
              ui.toast('Quest accepted: The Goblin Menace', 'level', '✦');
              addChat('Quest accepted: <b>The Goblin Menace</b>. Slay five goblins in the western woods.', 'exp');
              ui.openDialog({
                name: 'Elder Rowan',
                portrait: 'R',
                text: 'Good. The goblins lair among the trees west of the path. Their ears are proof enough—but I care less for trophies than for the safety of the Vale.<br><br>Return when five have fallen. May the old stones watch over you.',
                actions: [{ label: 'I will return', primary: true }],
              });
            },
          },
        ],
      });
    } else if (quest.status === 'active' && quest.kills < quest.required) {
      ui.openDialog({
        name: 'Elder Rowan',
        portrait: 'R',
        text: `The wood is quieter than it was, but not quiet enough. <b>${quest.required - quest.kills}</b> more goblin${quest.required - quest.kills === 1 ? '' : 's'} must be dealt with.<br><br>They gather near the old trail, west of the village. Keep your blade close.`,
        actions: [{ label: 'I understand', primary: true }],
      });
    } else if (quest.status === 'active' && quest.kills >= quest.required) {
      ui.openDialog({
        name: 'Elder Rowan',
        portrait: 'R',
        text: 'You return bloodied but whole—and the Vale is the better for it. The goblins will think twice before creeping down from the hills again.<br><br>Take this. It is not much, but it is given freely, and with the thanks of every soul in Mistwood.',
        actions: [
          {
            label: 'Claim reward', primary: true,
            onClick: () => {
              quest.status = 'complete';
              player.coins += 250;
              addItem('trout', 2);
              gainXp('attack', 120);
              refreshQuest();
              renderInventoryUI();
              audio.ensure(); audio.coin();
              burst(new THREE.Vector3(player.x, player.y + 1.3, player.z), 0xffd77e, 24, 3.6, 0.2);
              ui.toast('Quest complete: The Goblin Menace', 'level', '★');
              addChat('Quest complete! You receive <b>250 coins</b> and <b>120 Attack XP</b>.', 'exp');
              setTimeout(() => {
                ui.openDialog({
                  name: 'Elder Rowan',
                  portrait: 'R',
                  text: 'There is more work to be done, of course. There always is. But tonight, rest. You have earned it.',
                  actions: [{ label: 'Farewell', primary: true }],
                });
              }, 900);
            },
          },
          { label: 'Not yet' },
        ],
      });
    } else {
      ui.openDialog({
        name: 'Elder Rowan',
        portrait: 'R',
        text: 'The fire is warm, the Vale is quiet, and the old stones keep their watch. You have done well, Aeron.<br><br>If you seek more work, speak with Marta or Bran. They are always in need of a pair of willing hands.',
        actions: [{ label: 'Farewell', primary: true }],
      });
    }
    return;
  }
  const lines = {
    marta: 'Fresh trout! Warm bread! Apples from the Vale!<br><br>Things have been difficult since the goblins came down from the hills. If you clear them out, I might even offer you a discount.',
    bran: 'Mind the sparks, friend. The forge is hot and my patience is short.<br><br>Bring me iron ore if you find any. A blade forged here will outlast anything the goblins carry.',
    lyra: 'Have you seen the standing stones to the west? They hum when the sun goes down. My mother says they remember a time before the village—before the castle, even.',
    tomas: 'I saw a goblin at the edge of the wood last night. Big ears, crooked teeth, and a club the size of my leg. I did not stay to introduce myself.',
  };
  const line = lines[npc.id] || 'A fine evening, adventurer. The Vale is peaceful—for now.';
  ui.openDialog({
    name: npc.name,
    portrait: npc.name.charAt(0),
    text: line,
    actions: [{ label: 'Farewell', primary: true }],
  });
  addChat(`You speak with ${npc.name}.`, 'game');
}

// ----- Player attacks ------------------------------------------------------
function selectEnemy(enemy) {
  if (!enemy || !enemy.alive) return;
  targetEnemy = enemy;
  audio.ensure(); audio.click();
  ui.setTarget(enemy);
  const d = dist2(player.x, player.z, enemy.x, enemy.z);
  if (d > 2.45) {
    moveTarget = { x: enemy.x, z: enemy.z, enemy };
    pendingNpc = null;
  } else {
    attackEnemy();
  }
}

function attackEnemy() {
  if (!targetEnemy || !targetEnemy.alive || attackCooldown > 0 || gather || player.dead || ui.isDialogOpen()) return;
  const d = dist2(player.x, player.z, targetEnemy.x, targetEnemy.z);
  if (d > 2.8) {
    moveTarget = { x: targetEnemy.x, z: targetEnemy.z, enemy: targetEnemy };
    return;
  }
  attackCooldown = 0.68;
  moveTarget = null;
  playerModel.attack();
  audio.ensure(); audio.swing();
  player.facing = Math.atan2(targetEnemy.x - player.x, targetEnemy.z - player.z);
  const tool = ITEMS[selectedId]?.tool || 'sword';
  const base = tool === 'sword' ? 9 : tool === 'axe' ? 6 : 5;
  const damage = base + randInt(0, 5) + Math.floor(player.melee / 6);
  pendingHit = {
    time: 0.22, enemy: targetEnemy, damage,
    position: new THREE.Vector3(targetEnemy.x, targetEnemy.baseY + 1.15, targetEnemy.z),
  };
}

function resolveHit(hit) {
  const enemy = hit.enemy;
  if (!enemy || !enemy.alive) return;
  if (dist2(player.x, player.z, enemy.x, enemy.z) > 3.2) return;
  const crit = Math.random() < 0.16;
  const damage = Math.round(hit.damage * (crit ? 1.65 : 1));
  enemy.hp -= damage;
  enemy.hurtT = 1.6;
  cameraShake = Math.min(0.18, cameraShake + 0.06);
  audio.hit();
  burst(new THREE.Vector3(enemy.x, enemy.baseY + 1, enemy.z), crit ? 0xffe08a : 0xd9825d, crit ? 12 : 8, 2.4, 0.14);
  floatText(`${damage}${crit ? '!' : ''}`, crit ? '#ffd97f' : '#f2e4c4', new THREE.Vector3(enemy.x, enemy.baseY + 1.9, enemy.z), crit ? 0.78 : 0.62);
  enemy.model.state.hit = 1;
  ui.setTarget(enemy);
  if (enemy.hp <= 0) killEnemy(enemy);
  else if (quest.status === 'active' && quest.kills >= quest.required && !markerQuestion.visible) {
    refreshQuest();
    ui.toast('Return to Elder Rowan with the news.', 'good', '!');
  }
}

function killEnemy(enemy) {
  enemy.hp = 0;
  enemy.alive = false;
  enemy.deathT = 0;
  enemy.respawnT = 16;
  enemy.plate.visible = false;
  enemy.bar.visible = false;
  enemy.target = false;
  audio.hit();
  burst(new THREE.Vector3(enemy.x, enemy.baseY + 0.9, enemy.z), 0x9fca68, 18, 2.8, 0.16);
  gainXp('attack', 55);
  gainXp('defence', 18);
  const coins = randInt(8, 19);
  player.coins += coins;
  addItem('goblin_ear', 1);
  floatText(`+${coins} coins`, '#f0cf7d', new THREE.Vector3(enemy.x, enemy.baseY + 2.2, enemy.z), 0.62);
  addChat(`The goblin falls. You loot <b>${coins} coins</b> and a goblin ear.`, 'good');
  if (quest.status === 'active' && quest.kills < quest.required) {
    quest.kills += 1;
    if (quest.kills === quest.required) {
      ui.toast('Quest objective complete! Return to Elder Rowan.', 'level', '!');
      addChat('You have slain five goblins. Return to <b>Elder Rowan</b> for your reward.', 'exp');
      audio.quest();
    } else {
      addChat(`Goblins slain: <b>${quest.kills} / ${quest.required}</b>.`, 'game');
    }
    refreshQuest();
  }
  ui.setTarget(null);
  targetEnemy = null;
  renderInventoryUI();
  if (quest.status === 'active' && quest.kills >= quest.required) {
    markerQuestion.visible = true;
    markerExclaim.visible = false;
  }
}

// ----- Chat ----------------------------------------------------------------
function handleChat(text) {
  audio.ensure();
  if (text.startsWith('/')) {
    const cmd = text.slice(1).toLowerCase();
    if (cmd === 'dance' || cmd === 'wave' || cmd === 'cheer') {
      addChat(`Aeron ${cmd}s for the village. A few onlookers laugh and clap.`, 'game');
      ui.toast(`You ${cmd}!`, '', '✦');
    } else if (cmd === 'home') {
      teleportHome();
    } else if (cmd === 'help') {
      document.getElementById('helpOverlay').hidden = false;
    } else if (cmd === 'map') {
      ui.openMap();
    } else {
      addChat('Commands: /dance, /wave, /cheer, /home, /map, /help', 'game');
    }
    return;
  }
  addChat(text, 'all', 'Aeron');
  if (Math.random() < 0.5) {
    const replies = [
      ['Marta', 'A kind word travels further than a sharp blade, friend.'],
      ['Tomas', 'Careful in the western wood. The goblins are quicker than they look.'],
      ['Lyra', 'The stones are humming again. Can you hear them?'],
      ['Bran', 'Steel and patience. That is all a blade needs.'],
    ];
    const [speaker, line] = choice(replies);
    setTimeout(() => addChat(line, 'all', speaker), 1400 + Math.random() * 1200);
  }
}

function teleportHome() {
  if (teleportCooldown > 0) {
    ui.toast(`The rune is still recovering (${Math.ceil(teleportCooldown)}s).`, 'bad', '!');
    return;
  }
  if (player.dead) return;
  teleportCooldown = 9;
  burst(new THREE.Vector3(player.x, player.y + 1, player.z), 0x86e8dc, 24, 3.2, 0.2);
  player.x = SPAWN.x + rand(-1.2, 1.2);
  player.z = SPAWN.z + rand(0.5, 1.8);
  player.y = world.heightAt(player.x, player.z);
  player.vx = player.vz = 0;
  playerModel.root.position.set(player.x, player.y, player.z);
  burst(new THREE.Vector3(player.x, player.y + 1, player.z), 0x86e8dc, 30, 3.6, 0.22);
  audio.ensure(); audio.teleport();
  addChat('You are drawn home by the old magic of the shrine.', 'exp');
  ui.toast('Home teleport', '', '✦');
  moveTarget = null;
}

// ----- Input ---------------------------------------------------------------
const keys = new Set();
let dragging = false;
let dragMoved = 0;
let dragStart = { x: 0, y: 0 };
let dragLast = { x: 0, y: 0 };
let pointerDownTime = 0;
const pointer = new THREE.Vector2();

window.addEventListener('keydown', (e) => {
  if (ui.isChatFocused()) {
    if (e.key === 'Escape') ui.el.chatInput.blur();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    ui.focusChat();
    return;
  }
  if (ui.isDialogOpen()) {
    if (e.key === 'Escape') ui.closeDialog();
    return;
  }
  const code = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
  if (code === 'Space') {
    if (!player.dead && player.dodgeCooldown <= 0 && player.run >= 18 && !gather) {
      const dir = movementDirection();
      const fallback = new THREE.Vector2(Math.sin(player.facing), Math.cos(player.facing));
      const d = dir.lengthSq() > 0 ? dir : fallback;
      player.vx = d.x * 13;
      player.vz = d.y * 13;
      player.dodgeTime = 0.23;
      player.dodgeCooldown = 0.9;
      player.invuln = 0.45;
      player.run -= 18;
      audio.ensure(); audio.noise(0.18, { volume: 0.08, freq: 700, type: 'bandpass' });
    }
    return;
  }
  if (code === 'KeyE') { interact(); return; }
  if (code === 'KeyF') { if (targetEnemy) attackEnemy(); return; }
  if (code === 'KeyM') { ui.openMap(); return; }
  if (code === 'KeyH') { document.getElementById('helpOverlay').hidden = false; return; }
  if (code === 'KeyO') { ui.openMap(); return; }
  if (/^Digit[1-6]$/.test(code)) {
    const i = Number(code.slice(5)) - 1;
    if (i < HOTBAR.length) { audio.ensure(); audio.click(); useHotbar(i); }
    return;
  }
  keys.add(code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function movementDirection() {
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (!x && !z) return new THREE.Vector2(0, 0);
  const forward = new THREE.Vector2(-Math.sin(cameraYaw), -Math.cos(cameraYaw));
  const right = new THREE.Vector2(Math.cos(cameraYaw), -Math.sin(cameraYaw));
  const dir = new THREE.Vector2(forward.x * z + right.x * x, forward.y * z + right.y * x);
  return dir.normalize();
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  audio.ensure();
  if (e.button !== 0 && e.button !== 2) return;
  dragging = true;
  dragMoved = 0;
  dragStart = { x: e.clientX, y: e.clientY };
  dragLast = { x: e.clientX, y: e.clientY };
  pointerDownTime = performance.now();
  renderer.domElement.style.cursor = 'grabbing';
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragLast.x;
  const dy = e.clientY - dragLast.y;
  dragLast = { x: e.clientX, y: e.clientY };
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (dragMoved > 3) {
    cameraYaw -= dx * 0.0048;
    cameraPitch = clamp(cameraPitch + dy * 0.0034, -0.06, 0.92);
  }
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  renderer.domElement.style.cursor = 'grab';
  const elapsedClick = performance.now() - pointerDownTime;
  if (dragMoved < 6 && elapsedClick < 550 && e.button === 0) handleClick(e);
});
renderer.domElement.addEventListener('pointercancel', () => { dragging = false; renderer.domElement.style.cursor = 'grab'; });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  cameraDistance = clamp(cameraDistance + e.deltaY * 0.0055, 4.4, 13.5);
}, { passive: false });

const raycaster = new THREE.Raycaster();
function handleClick(e) {
  if (player.dead || ui.isDialogOpen() || gather) return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const enemyHits = raycaster.intersectObjects(enemies.filter((en) => en.alive).map((en) => en.model.root), true);
  if (enemyHits.length) {
    let node = enemyHits[0].object;
    while (node && !node.userData.enemyRef) node = node.parent;
    if (node?.userData.enemyRef) {
      selectEnemy(node.userData.enemyRef);
      return;
    }
  }
  const npcHits = raycaster.intersectObjects(npcs.map((n) => n.model.root), true);
  if (npcHits.length) {
    let node = npcHits[0].object;
    while (node && !node.userData.npcRef) node = node.parent;
    if (node?.userData.npcRef) {
      const npc = node.userData.npcRef;
      const d = dist2(player.x, player.z, npc.x, npc.z);
      if (d < 3.4) talkTo(npc);
      else {
        moveTarget = { x: npc.x, z: npc.z, npc };
        pendingNpc = npc;
        targetEnemy = null;
        ui.setTarget(null);
        ui.toast(`Walking to ${npc.name}...`, '', '◆');
      }
      return;
    }
  }
  const terrainHits = raycaster.intersectObject(world.terrain, false);
  if (terrainHits.length) {
    const p = terrainHits[0].point;
    if (world.heightAt(p.x, p.z) < WATER_LEVEL + 0.15) {
      ui.toast('You cannot walk on water.', 'bad', '!');
      return;
    }
    if (Math.hypot(p.x, p.z) > 68) {
      ui.toast('The mountains are too steep to cross.', 'bad', '!');
      return;
    }
    moveTarget = { x: p.x, z: p.z };
    pendingNpc = null;
    targetEnemy = null;
    ui.setTarget(null);
    moveMarker.position.set(p.x, world.heightAt(p.x, p.z) + 0.08, p.z);
    moveMarker.visible = true;
    audio.ensure(); audio.tone(520, 0.06, { type: 'triangle', volume: 0.025, slide: 480 });
  }
}
for (const npc of npcs) npc.model.root.traverse((o) => { o.userData.npcRef = npc; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----- Initial UI ----------------------------------------------------------
renderInventoryUI();
refreshQuest();
ui.setSoundMuted(false);
addChat('Welcome to <b>Mistwood Vale</b>, Aeron.', 'game');
addChat('Elder Rowan waits by the village fire. He has work for a willing adventurer.', 'game');
addChat('Tip: Hold <b>Shift</b> to sprint, press <b>E</b> near trees or ore to gather, and click a goblin to attack.', 'game');
ui.toast('The Goblin Menace — speak with Elder Rowan', '', '✦');

// ----- Simulation ----------------------------------------------------------
const clock = new THREE.Clock();
let firstFrame = true;
const tempVec = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const smoothTarget = new THREE.Vector3(player.x, player.y + 1.2, player.z - 1.5);

function angleDamp(current, target, lambda, dt) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function movePlayer(dt) {
  if (player.dead || ui.isDialogOpen() || gather) {
    player.vx = damp(player.vx, 0, 9, dt);
    player.vz = damp(player.vz, 0, 9, dt);
    player.speed = Math.hypot(player.vx, player.vz);
    return;
  }
  let dir = movementDirection();
  let usingKeys = dir.lengthSq() > 0;
  if (!usingKeys && moveTarget) {
    const dx = moveTarget.x - player.x, dz = moveTarget.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < (moveTarget.enemy ? 1.8 : 0.55)) {
      if (moveTarget.enemy && moveTarget.enemy.alive) selectEnemy(moveTarget.enemy);
      if (moveTarget.npc && pendingNpc) { const n = pendingNpc; pendingNpc = null; talkTo(n); }
      moveTarget = null;
      moveMarker.visible = false;
    } else {
      dir.set(dx / d, dz / d);
      usingKeys = true;
    }
  }
  if (!usingKeys && moveTarget === null) moveMarker.visible = false;

  const wantRun = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const canRun = wantRun && player.run > 1 && (dir.lengthSq() > 0);
  const speed = canRun ? 7.4 : 4.15;
  if (canRun) player.run = Math.max(0, player.run - dt * 7.2);
  else player.run = Math.min(player.maxRun, player.run + dt * 5.4);

  if (player.dodgeTime > 0) {
    player.dodgeTime -= dt;
  } else {
    player.vx = damp(player.vx, dir.x * speed, 12, dt);
    player.vz = damp(player.vz, dir.y * speed, 12, dt);
  }
  player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  let nx = player.x + player.vx * dt;
  let nz = player.z + player.vz * dt;
  if (world.heightAt(nx, nz) < WATER_LEVEL + 0.08) {
    nx = player.x; nz = player.z;
    player.vx *= 0.2; player.vz *= 0.2;
  }
  const maxR = 68;
  const r = Math.hypot(nx, nz);
  if (r > maxR) { nx = (nx / r) * maxR; nz = (nz / r) * maxR; }
  for (const c of world.colliders) {
    const dx = nx - c.x, dz = nz - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + 0.34;
    if (d < min && d > 0.0001) {
      nx = c.x + (dx / d) * min;
      nz = c.z + (dz / d) * min;
    }
  }
  player.x = nx; player.z = nz;
  player.y = damp(player.y, world.heightAt(nx, nz), 14, dt);
  player.speed = Math.hypot(player.vx, player.vz);
  if (player.speed > 0.35) {
    const targetFacing = Math.atan2(player.vx, player.vz);
    player.facing = angleDamp(player.facing, targetFacing, 12, dt);
  } else if (targetEnemy && targetEnemy.alive) {
    player.facing = angleDamp(player.facing, Math.atan2(targetEnemy.x - player.x, targetEnemy.z - player.z), 8, dt);
  }
  playerModel.root.position.set(player.x, player.y, player.z);
  playerModel.root.rotation.y = player.facing;
  playerModel.state.speed = player.speed;
  playerModel.state.running = canRun && player.speed > 4.5;
}

function cameraCollision(desiredX, desiredZ) {
  const dx = desiredX - player.x, dz = desiredZ - player.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.0001) return { x: desiredX, z: desiredZ, t: 1 };
  let bestT = 1;
  for (const c of world.colliders) {
    if (c.r < 1.2) continue;
    const radius = c.r + 0.42;
    const fx = player.x - c.x, fz = player.z - c.z;
    const b = 2 * (fx * dx + fz * dz);
    const cc = fx * fx + fz * fz - radius * radius;
    const disc = b * b - 4 * lenSq * cc;
    if (disc <= 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * lenSq);
    if (t > 0 && t < bestT) bestT = t;
  }
  if (bestT >= 1) return { x: desiredX, z: desiredZ, t: 1 };
  const t = Math.max(0.16, bestT - 0.05);
  return { x: player.x + dx * t, z: player.z + dz * t, t };
}

function updateCamera(dt) {
  const cosPitch = Math.cos(cameraPitch);
  let desiredX = player.x + Math.sin(cameraYaw) * cosPitch * cameraDistance;
  let desiredZ = player.z + Math.cos(cameraYaw) * cosPitch * cameraDistance;
  let desiredY = player.y + 1.15 + Math.sin(cameraPitch) * cameraDistance;
  const hit = cameraCollision(desiredX, desiredZ);
  if (hit.t < 1) {
    desiredX = hit.x;
    desiredZ = hit.z;
    const baseY = player.y + 1.5;
    desiredY = baseY + (desiredY - baseY) * Math.max(0.35, hit.t);
  }
  const terrainY = world.heightAt(desiredX, desiredZ);
  if (desiredY < terrainY + 0.7) desiredY = terrainY + 0.7;
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  cameraTarget.set(
    player.x + forwardX * 2.2,
    player.y + 1.35 + (cameraPitch - 0.28) * 1.2,
    player.z + forwardZ * 2.2
  );
  smoothTarget.lerp(cameraTarget, 1 - Math.exp(-9 * dt));
  const lerpAmt = 1 - Math.exp(-8 * dt);
  camera.position.x = lerp(camera.position.x, desiredX, lerpAmt);
  camera.position.y = lerp(camera.position.y, desiredY, lerpAmt);
  camera.position.z = lerp(camera.position.z, desiredZ, lerpAmt);
  if (cameraShake > 0.001) {
    camera.position.x += rand(-cameraShake, cameraShake);
    camera.position.y += rand(-cameraShake, cameraShake);
    cameraShake *= Math.exp(-9 * dt);
  }
  camera.lookAt(smoothTarget);
}

function updateEnemies(dt, time) {
  for (const enemy of enemies) {
    if (!enemy.alive) {
      enemy.respawnT -= dt;
      enemy.deathT += dt;
      const t = clamp(enemy.deathT / 0.6, 0, 1);
      enemy.model.root.rotation.z = lerp(0, Math.PI / 2, t);
      enemy.model.root.position.y = enemy.baseY - Math.sin(t * Math.PI * 0.5) * 0.25;
      if (enemy.deathT > 1.6) enemy.model.root.visible = false;
      enemy.model.state.speed = 0;
      enemy.model.update(dt, time);
      if (enemy.respawnT <= 0) {
        enemy.alive = true;
        enemy.hp = enemy.maxHp;
        enemy.deathT = 0;
        enemy.x = enemy.home.x;
        enemy.z = enemy.home.z;
        enemy.baseY = world.heightAt(enemy.x, enemy.z);
        enemy.model.root.visible = true;
        enemy.model.root.rotation.z = 0;
        enemy.model.root.position.set(enemy.x, enemy.baseY, enemy.z);
        enemy.plate.visible = true;
        enemy.bar.visible = false;
        enemy.attackCooldown = 1.5;
      }
      continue;
    }
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.hurtT = Math.max(0, enemy.hurtT - dt);
    const dPlayer = dist2(player.x, player.z, enemy.x, enemy.z);
    const aggro = !player.dead && (dPlayer < 8.5 || targetEnemy === enemy);
    let dx = 0, dz = 0, speed = 0;
    if (aggro) {
      if (dPlayer > 1.7) {
        dx = (player.x - enemy.x) / dPlayer;
        dz = (player.z - enemy.z) / dPlayer;
        speed = 2.9;
      } else if (enemy.attackCooldown <= 0 && !player.dead) {
        enemy.attackCooldown = 1.75;
        enemy.model.attack();
        audio.ensure();
        setTimeout(() => {
          if (enemy.alive && !player.dead && dist2(player.x, player.z, enemy.x, enemy.z) < 2.3) {
            const damage = randInt(4, 7);
            if (player.invuln <= 0) {
              player.hp = Math.max(0, player.hp - damage);
              playerModel.state.hit = 1;
              cameraShake = 0.22;
              ui.damageFlash();
              audio.hurt();
              floatText(`-${damage}`, '#ef8079', new THREE.Vector3(player.x, player.y + 2.3, player.z), 0.75);
              if (player.hp <= 0) handleDeath();
            }
          }
        }, 260);
      }
    } else {
      enemy.wanderT -= dt;
      if (enemy.wanderT <= 0) {
        enemy.wanderT = rand(2.4, 5.5);
        enemy.wanderAngle = rand(0, Math.PI * 2);
      }
      const hx = enemy.home.x + Math.cos(enemy.wanderAngle) * enemy.patrol;
      const hz = enemy.home.z + Math.sin(enemy.wanderAngle) * enemy.patrol;
      const dHome = dist2(enemy.x, enemy.z, hx, hz);
      if (dHome > 0.5) {
        dx = (hx - enemy.x) / dHome;
        dz = (hz - enemy.z) / dHome;
        speed = 0.95;
      }
    }
    if (speed > 0) {
      enemy.x += dx * speed * dt;
      enemy.z += dz * speed * dt;
      if (world.heightAt(enemy.x, enemy.z) < WATER_LEVEL + 0.1) { enemy.x -= dx * speed * dt; enemy.z -= dz * speed * dt; }
      enemy.facing = angleDamp(enemy.facing, Math.atan2(dx, dz), 7, dt);
    } else if (aggro) {
      enemy.facing = angleDamp(enemy.facing, Math.atan2(player.x - enemy.x, player.z - enemy.z), 7, dt);
    }
    enemy.baseY = damp(enemy.baseY, world.heightAt(enemy.x, enemy.z), 12, dt);
    enemy.model.root.position.set(enemy.x, enemy.baseY, enemy.z);
    enemy.model.root.rotation.y = enemy.facing;
    enemy.model.state.speed = speed;
    enemy.model.state.running = aggro && speed > 2;
    enemy.model.update(dt, time);
    const showBar = targetEnemy === enemy || enemy.hurtT > 0;
    enemy.bar.visible = showBar;
    if (showBar) enemy.bar.userData.draw(enemy.hp / enemy.maxHp);
    enemy.plate.material.opacity = targetEnemy === enemy ? 1 : 0.75;
  }
}

function updateNpcs(dt, time) {
  for (const npc of npcs) {
    let speed = 0;
    if (npc.wander) {
      npc.phase += dt * 0.35;
      const tx = npc.wander.x + Math.cos(npc.phase) * npc.wander.r;
      const tz = npc.wander.z + Math.sin(npc.phase) * npc.wander.r;
      const dx = tx - npc.x, dz = tz - npc.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.12) {
        npc.x += (dx / d) * 0.55 * dt;
        npc.z += (dz / d) * 0.55 * dt;
        speed = 0.55;
        npc.facing = angleDamp(npc.facing, Math.atan2(dx, dz), 4, dt);
      }
    }
    const dPlayer = dist2(player.x, player.z, npc.x, npc.z);
    if (dPlayer < 4.2 && npc.role !== 'smith') {
      npc.facing = angleDamp(npc.facing, Math.atan2(player.x - npc.x, player.z - npc.z), 3.5, dt);
    }
    npc.baseY = damp(npc.baseY, world.heightAt(npc.x, npc.z), 10, dt);
    npc.model.root.position.set(npc.x, npc.baseY, npc.z);
    npc.model.root.rotation.y = npc.facing;
    npc.model.state.speed = speed;
    if (npc.role === 'smith') npc.model.state.action = 'mine';
    npc.model.update(dt, time);
    if (npc.id === 'rowan') {
      npc.nameplate.position.y = npc.model.height + 0.34 + Math.sin(time * 1.6) * 0.01;
    }
  }
}

function handleDeath() {
  if (player.dead) return;
  player.dead = true;
  player.hp = 0;
  targetEnemy = null;
  moveTarget = null;
  gather = null;
  ui.setHarvest(null, 0);
  ui.setTarget(null);
  ui.showDeath();
  addChat('You have fallen. The Vale fades to grey...', 'bad');
  audio.ensure(); audio.tone(90, 1.2, { type: 'sine', volume: 0.12, slide: 50 });
  setTimeout(() => {
    player.dead = false;
    player.hp = Math.round(player.maxHp * 0.6);
    player.run = player.maxRun;
    player.x = SPAWN.x;
    player.z = SPAWN.z + 1;
    player.y = world.heightAt(player.x, player.z);
    player.vx = player.vz = 0;
    player.invuln = 2;
    playerModel.root.position.set(player.x, player.y, player.z);
    playerModel.root.rotation.z = 0;
    ui.hideDeath();
    addChat('You awaken at the village shrine. Your belongings are intact.', 'good');
    ui.toast('You awaken at the village shrine.', 'good', '✦');
    burst(new THREE.Vector3(player.x, player.y + 1, player.z), 0xffd58a, 22, 3, 0.18);
  }, 3200);
}

function updateEffects(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.sprite.position.y += f.vy * dt;
    const t = 1 - f.life / f.maxLife;
    f.sprite.material.opacity = clamp(f.life / f.maxLife, 0, 1);
    const s = 1 + Math.sin(t * Math.PI) * 0.16;
    f.sprite.scale.set(f.baseScale.x * s, f.baseScale.y * s, 1);
    if (f.life <= 0) {
      scene.remove(f.sprite);
      f.sprite.material.map?.dispose();
      f.sprite.material.dispose();
      floaters.splice(i, 1);
    }
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    const pos = e.points.geometry.attributes.position;
    for (let p = 0; p < pos.count; p++) {
      const v = e.velocities[p];
      pos.setXYZ(p, pos.getX(p) + v.x * dt, pos.getY(p) + v.y * dt, pos.getZ(p) + v.z * dt);
      v.y -= 6 * dt;
      v.multiplyScalar(0.985);
    }
    pos.needsUpdate = true;
    e.points.material.opacity = clamp(e.life / e.maxLife, 0, 1) * 0.95;
    if (e.life <= 0) {
      scene.remove(e.points);
      e.points.geometry.dispose();
      e.points.material.map?.dispose();
      e.points.material.dispose();
      effects.splice(i, 1);
    }
  }
}

function updateWorldInteractions(dt, time) {
  for (const tree of world.trees) {
    if (tree.userData.cooldown > 0) {
      tree.userData.cooldown -= dt;
      if (tree.userData.cooldown <= 0 && tree.userData.canopy) {
        tree.userData.canopy.visible = true;
      }
    }
  }
  for (const rock of world.rocks) {
    if (rock.userData.cooldown > 0) {
      rock.userData.cooldown -= dt;
      if (rock.userData.cooldown <= 0) {
        for (const child of rock.children) {
          if (child.isMesh && child.geometry && child.geometry.type === 'IcosahedronGeometry') child.visible = true;
        }
      }
    }
  }
  if (time % 0.25 < dt) {
    currentInteraction = nearestInteractable();
    if (currentInteraction && !gather) ui.setPrompt(currentInteraction.label);
    else ui.setPrompt(null);
  }
  if (time % 0.5 < dt) {
    const near = npcs.filter((n) => dist2(player.x, player.z, n.x, n.z) < 7).map((n) => n.name);
    if (near.length && Math.random() < 0.04) {
      const npc = npcs.find((n) => n.name === choice(near));
      const ambient = {
        marta: 'Fresh trout! Still warm from the smoker!',
        bran: 'A good blade sings. This one is still learning the tune.',
        lyra: 'The stones are humming again...',
        tomas: 'Quiet night. Too quiet, if you ask me.',
        rowan: 'The Vale endures. That is enough.',
      };
      if (ambient[npc.id]) addChat(ambient[npc.id], 'all', npc.name);
    }
  }
}

function updateQuestMarker(dt, time) {
  const marker = markerQuestion.visible ? markerQuestion : markerExclaim;
  markerExclaim.position.y = rowan.baseY + 2.55 + Math.sin(time * 2.2) * 0.08;
  markerQuestion.position.y = markerExclaim.position.y;
  const pulse = 1 + Math.sin(time * 3.4) * 0.05;
  marker.scale.set(0.9 * pulse, 0.9 * pulse, 1);
  if (waypointMarker.visible) {
    waypointRing.rotation.z = time * 0.5;
    waypointGlow.material.opacity = 0.5 + Math.sin(time * 2.4) * 0.14;
    const d = dist2(player.x, player.z, waypointMarker.position.x, waypointMarker.position.z);
    if (d < 2.0) { waypointMarker.visible = false; ui.waypoint = null; }
  }
  if (moveMarker.visible) {
    markerRing.rotation.z = time * 2.4;
    const s = 1 + Math.sin(time * 6) * 0.06;
    markerRing.scale.setScalar(s);
  }
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed += dt;
  const time = elapsed;

  if (!player.dead && !ui.isDialogOpen()) movePlayer(dt);
  else {
    player.vx = damp(player.vx, 0, 9, dt);
    player.vz = damp(player.vz, 0, 9, dt);
    player.speed = 0;
    playerModel.state.speed = 0;
  }
  playerModel.root.position.set(player.x, player.y, player.z);
  playerModel.root.rotation.y = player.facing;
  playerModel.update(dt, time);
  contactShadow.position.set(player.x, player.y + 0.035, player.z);

  if (gather) {
    gather.time += dt;
    gather.soundT -= dt;
    player.facing = Math.atan2(gather.target.position.x - player.x, gather.target.position.z - player.z);
    ui.setHarvest(gather.label, gather.time / gather.duration);
    if (gather.soundT <= 0) {
      gather.soundT = 0.38;
      if (gather.type === 'tree') { audio.chop(); burst(new THREE.Vector3(gather.target.position.x, gather.target.position.y + 2.2, gather.target.position.z), 0x8dbb62, 4, 1.2, 0.1); }
      else { audio.mine(); burst(new THREE.Vector3(gather.target.position.x, gather.target.position.y + 0.9, gather.target.position.z), 0xd7d9c9, 4, 1.4, 0.09); }
    }
    if (gather.time >= gather.duration) completeGather();
  }

  attackCooldown = Math.max(0, attackCooldown - dt);
  teleportCooldown = Math.max(0, teleportCooldown - dt);
  fireCooldown = Math.max(0, fireCooldown - dt);
  altarCooldown = Math.max(0, altarCooldown - dt);

  if (pendingHit) {
    pendingHit.time -= dt;
    if (pendingHit.time <= 0) {
      const hit = pendingHit;
      pendingHit = null;
      resolveHit(hit);
    }
  }

  if (targetEnemy && targetEnemy.alive && !gather && !player.dead && !ui.isDialogOpen()) {
    const d = dist2(player.x, player.z, targetEnemy.x, targetEnemy.z);
    if (d > 30) { targetEnemy = null; ui.setTarget(null); }
    else if (d <= 2.6 && attackCooldown <= 0 && !moveTarget) attackEnemy();
  }

  updateEnemies(dt, time);
  updateNpcs(dt, time);
  updateWorldInteractions(dt, time);
  updateQuestMarker(dt, time);
  updateEffects(dt);
  updateCamera(dt);
  world.update(dt, time, camera);
  ui.updateTime(dt);

  if (time - lastUiUpdate > 0.11) {
    lastUiUpdate = time;
    ui.update({
      player,
      skills,
      activeSkill,
      npcs: npcs.map((n) => ({ x: n.x, z: n.z, quest: n.quest })),
      enemies: enemies.map((e) => ({ x: e.x, z: e.z, alive: e.alive, targeted: targetEnemy === e })),
    });
    if (targetEnemy && targetEnemy.alive) ui.setTarget(targetEnemy);
    if (waypointMarker.visible) ui.waypoint = { x: waypointMarker.position.x, z: waypointMarker.position.z };
  }

  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    ui.setLoading(true);
    drawInitialMinimap();
  }
  requestAnimationFrame(loop);
}

function drawInitialMinimap() {
  ui.update({
    player,
    skills,
    activeSkill,
    npcs: npcs.map((n) => ({ x: n.x, z: n.z, quest: n.quest })),
    enemies: enemies.map((e) => ({ x: e.x, z: e.z, alive: e.alive, targeted: false })),
  });
}

// Set camera immediately so the first frame is composed.
camera.position.set(
  player.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
  player.y + 1.15 + Math.sin(cameraPitch) * cameraDistance,
  player.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance
);
camera.lookAt(smoothTarget);

requestAnimationFrame(loop);
