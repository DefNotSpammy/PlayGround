import * as THREE from 'three';
import { makeCapeTexture, makeBannerTexture, clamp, lerp, damp } from './utils.js';

const SKIN = 0xd8a578;
const skinMat = (color = SKIN) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 });
const clothMat = (color, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });

const steelMat = new THREE.MeshStandardMaterial({ color: 0xb9c3cb, roughness: 0.28, metalness: 0.92 });
const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x68727a, roughness: 0.38, metalness: 0.85 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xd6ad57, roughness: 0.32, metalness: 0.8 });
const leatherMat = new THREE.MeshStandardMaterial({ color: 0x5c3a23, roughness: 0.92 });
const chainMat = new THREE.MeshStandardMaterial({ color: 0x747f89, roughness: 0.52, metalness: 0.62 });

let capeTexture;
let shieldTexture;

function rigPart(geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCape() {
  capeTexture ||= makeCapeTexture();
  const geo = new THREE.PlaneGeometry(0.82, 1.22, 8, 12);
  geo.translate(0, -0.61, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = clamp(-y / 1.22, 0, 1);
    pos.setX(i, pos.getX(i) * (1 + t * 0.22));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: capeTexture, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.set(0, 0.57, -0.19);
  mesh.userData.base = Float32Array.from(pos.array);
  return mesh;
}

function makeShield() {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.045, 20), leatherMat);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  group.add(disc);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.052, 20), new THREE.MeshStandardMaterial({ color: 0x6d4b2f, roughness: 0.8 }));
  face.rotation.x = Math.PI / 2;
  face.position.z = 0.004;
  group.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 6, 24), darkSteelMat);
  rim.position.z = 0.01;
  group.add(rim);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = 0.035;
  group.add(boss);
  for (let i = 0; i < 8; i++) {
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), goldMat);
    const a = (i / 8) * Math.PI * 2;
    stud.position.set(Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0.04);
    group.add(stud);
  }
  return group;
}

function makeSword() {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.9, 0.026), steelMat);
  blade.position.y = 0.56;
  blade.castShadow = true;
  group.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.053, 0.17, 4), steelMat);
  tip.position.y = 1.09;
  tip.rotation.y = Math.PI / 4;
  group.add(tip);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.72, 0.03), new THREE.MeshStandardMaterial({ color: 0x8e99a3, roughness: 0.3, metalness: 0.9 }));
  fuller.position.set(0, 0.54, 0.002);
  group.add(fuller);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.055, 0.075), goldMat);
  guard.position.y = 0.085;
  group.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 8), leatherMat);
  grip.position.y = -0.07;
  group.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), goldMat);
  pommel.position.y = -0.22;
  group.add(pommel);
  group.position.set(0, -0.07, 0);
  group.rotation.set(0.28, 0, -0.1);
  return group;
}

function makeAxe() {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.92, 7), leatherMat);
  handle.position.y = 0.38;
  handle.castShadow = true;
  group.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.3), steelMat);
  head.position.set(0, 0.78, 0.07);
  head.rotation.z = 0.04;
  group.add(head);
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 8, 1, false, -Math.PI / 2, Math.PI), steelMat);
  edge.rotation.z = Math.PI / 2;
  edge.rotation.y = Math.PI / 2;
  edge.scale.set(0.55, 1, 1);
  edge.position.set(0, 0.77, 0.21);
  group.add(edge);
  const bind = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 8), goldMat);
  bind.position.y = 0.78;
  group.add(bind);
  group.position.set(0, -0.07, 0);
  group.rotation.set(0.32, 0, -0.12);
  return group;
}

function makePickaxe() {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.92, 7), leatherMat);
  handle.position.y = 0.38;
  group.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.075, 0.09), steelMat);
  head.position.y = 0.78;
  head.rotation.z = 0.16;
  group.add(head);
  const tipA = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 4), steelMat);
  tipA.position.set(-0.32, 0.75, 0);
  tipA.rotation.z = Math.PI / 2;
  group.add(tipA);
  const tipB = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 4), steelMat);
  tipB.position.set(0.32, 0.79, 0);
  tipB.rotation.z = -Math.PI / 2;
  group.add(tipB);
  group.position.set(0, -0.07, 0);
  group.rotation.set(0.3, 0, -0.1);
  return group;
}

function makeStaff() {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 1.85, 7), new THREE.MeshStandardMaterial({ color: 0x5f4228, roughness: 0.9 }));
  shaft.position.y = 0.7;
  shaft.castShadow = true;
  group.add(shaft);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ color: 0x8cd8ff, emissive: 0x3fa6d6, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.95 }));
  crystal.position.y = 1.66;
  group.add(crystal);
  group.userData.crystal = crystal;
  return group;
}

function createTool(type) {
  let tool;
  if (type === 'sword') tool = makeSword();
  else if (type === 'axe') tool = makeAxe();
  else if (type === 'pickaxe') tool = makePickaxe();
  else if (type === 'staff') tool = makeStaff();
  else tool = new THREE.Group();
  return tool;
}

export function createHumanoid(options = {}) {
  const {
    skin = SKIN, hair = 0x3a2418, shirt = 0x455a6d, pants = 0x3c3c44, boots = 0x31241b,
    cape = false, scale = 0.94, hat = false, hood = false, robe = false, apron = false,
    beard = false, female = false, staff = false, shield = false, bulky = false,
  } = options;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.9;
  body.add(hips);

  const pelvis = rigPart(new THREE.CapsuleGeometry(0.2, 0.12, 4, 10), clothMat(pants), [0, 0.02, 0]);
  pelvis.scale.x = 1.18;
  hips.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 0.04;
  hips.add(torso);

  const chestMat = robe ? clothMat(shirt) : chainMat;
  const chest = rigPart(new THREE.CapsuleGeometry(bulky ? 0.28 : 0.235, bulky ? 0.42 : 0.35, 4, 12), chestMat, [0, 0.34, 0]);
  chest.scale.set(bulky ? 1.24 : 1.12, 1, bulky ? 0.86 : 0.8);
  torso.add(chest);

  if (!robe) {
    const tunic = rigPart(new THREE.BoxGeometry(0.5, 0.42, 0.06), clothMat(shirt), [0, 0.32, 0.2]);
    tunic.scale.x = 0.94;
    torso.add(tunic);
    const belt = rigPart(new THREE.BoxGeometry(0.52, 0.1, 0.1), leatherMat, [0, 0.06, 0.16]);
    torso.add(belt);
    const buckle = rigPart(new THREE.BoxGeometry(0.09, 0.09, 0.03), goldMat, [0, 0.06, 0.23]);
    torso.add(buckle);
    const collar = rigPart(new THREE.TorusGeometry(0.2, 0.04, 5, 14), clothMat(shirt, 0.7), [0, 0.59, 0]);
    collar.rotation.x = Math.PI / 2;
    collar.scale.z = 0.8;
    torso.add(collar);
  }

  if (robe) {
    const skirt = rigPart(new THREE.CylinderGeometry(0.27, 0.43, 0.85, 12, 1, true), clothMat(shirt), [0, -0.22, 0]);
    skirt.material.side = THREE.DoubleSide;
    torso.add(skirt);
    const trim = rigPart(new THREE.TorusGeometry(0.4, 0.025, 5, 16), goldMat, [0, -0.62, 0]);
    trim.rotation.x = Math.PI / 2;
    torso.add(trim);
    const sash = rigPart(new THREE.BoxGeometry(0.12, 0.92, 0.03), goldMat, [0.1, 0.1, 0.25]);
    sash.rotation.z = 0.34;
    torso.add(sash);
  }

  if (apron) {
    const apronMesh = rigPart(new THREE.BoxGeometry(0.42, 0.6, 0.025), clothMat(0x8a6b45), [0, 0.17, 0.215]);
    torso.add(apronMesh);
    const neck = rigPart(new THREE.BoxGeometry(0.03, 0.25, 0.02), clothMat(0x8a6b45), [-0.14, 0.5, 0.215]);
    torso.add(neck);
    const neck2 = neck.clone(); neck2.position.x = 0.14; torso.add(neck2);
  }

  if (bulky) {
    const p1 = rigPart(new THREE.SphereGeometry(0.145, 10, 8), darkSteelMat, [-0.3, 0.54, 0]);
    p1.scale.set(1.35, 0.8, 1);
    torso.add(p1);
    const p2 = p1.clone(); p2.position.x = 0.3; torso.add(p2);
  }

  const neck = rigPart(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 8), skinMat(skin), [0, 0.64, 0]);
  torso.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.77, 0);
  torso.add(head);
  const skull = rigPart(new THREE.SphereGeometry(0.17, 14, 12), skinMat(skin), [0, 0, 0]);
  skull.scale.set(0.9, 1.04, 0.92);
  head.add(skull);

  const nose = rigPart(new THREE.ConeGeometry(0.035, 0.09, 5), skinMat(skin), [0, -0.005, 0.165]);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);
  for (const side of [-1, 1]) {
    const eyeWhite = rigPart(new THREE.SphereGeometry(0.026, 6, 5), new THREE.MeshStandardMaterial({ color: 0xeee8db, roughness: 0.5 }), [side * 0.062, 0.04, 0.145]);
    eyeWhite.scale.z = 0.55;
    head.add(eyeWhite);
    const eye = rigPart(new THREE.SphereGeometry(0.013, 6, 5), new THREE.MeshStandardMaterial({ color: 0x2d3a3a, roughness: 0.4 }), [side * 0.062, 0.04, 0.164]);
    head.add(eye);
    const brow = rigPart(new THREE.BoxGeometry(0.06, 0.014, 0.02), new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 }), [side * 0.063, 0.078, 0.156]);
    brow.rotation.z = side * -0.16;
    head.add(brow);
    const ear = rigPart(new THREE.SphereGeometry(0.035, 6, 5), skinMat(skin), [side * 0.155, 0.005, 0]);
    ear.scale.set(0.6, 1.1, 0.8);
    head.add(ear);
  }

  if (female) {
    const hairBack = rigPart(new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.72), new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 }), [0, 0.03, -0.035]);
    hairBack.scale.set(0.98, 1.12, 1.02);
    head.add(hairBack);
    const braid = rigPart(new THREE.CapsuleGeometry(0.035, 0.34, 3, 6), new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 }), [0, -0.2, -0.13]);
    head.add(braid);
  } else {
    const hairMesh = rigPart(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 }), [0, 0.025, -0.012]);
    hairMesh.scale.set(0.95, 1.12, 0.98);
    head.add(hairMesh);
    const fringe = rigPart(new THREE.BoxGeometry(0.24, 0.06, 0.07), new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 }), [0, 0.105, 0.135]);
    fringe.rotation.x = -0.18;
    head.add(fringe);
  }

  if (beard) {
    const beardMesh = rigPart(new THREE.ConeGeometry(0.15, 0.36, 7), new THREE.MeshStandardMaterial({ color: 0xcfc7b6, roughness: 1 }), [0, -0.19, 0.09]);
    beardMesh.rotation.x = Math.PI;
    head.add(beardMesh);
    const mustache = rigPart(new THREE.BoxGeometry(0.17, 0.035, 0.04), new THREE.MeshStandardMaterial({ color: 0xcfc7b6, roughness: 1 }), [0, -0.045, 0.145]);
    head.add(mustache);
  }

  if (hood) {
    const hoodMesh = rigPart(new THREE.SphereGeometry(0.225, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.66), clothMat(shirt, 0.95), [0, 0.035, -0.03]);
    head.add(hoodMesh);
    const shoulderHood = rigPart(new THREE.CylinderGeometry(0.2, 0.32, 0.22, 10, 1, true), clothMat(shirt, 0.95), [0, -0.08, -0.03]);
    shoulderHood.material.side = THREE.DoubleSide;
    head.add(shoulderHood);
  }

  if (hat) {
    const brim = rigPart(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 14), leatherMat, [0, 0.19, 0]);
    head.add(brim);
    const crown = rigPart(new THREE.CylinderGeometry(0.16, 0.19, 0.18, 12), leatherMat, [0, 0.28, 0]);
    head.add(crown);
  }

  const shoulders = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (bulky ? 0.37 : 0.3), 0.53, 0);
    shoulder.rotation.z = side * 0.08;
    torso.add(shoulder);
    const upper = rigPart(new THREE.CapsuleGeometry(0.075, 0.26, 4, 8), robe ? clothMat(shirt) : skinMat(skin), [0, -0.18, 0]);
    upper.scale.x = bulky ? 1.35 : 1;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.36;
    shoulder.add(elbow);
    const forearm = rigPart(new THREE.CapsuleGeometry(0.062, 0.23, 4, 8), robe ? clothMat(shirt) : skinMat(skin), [0, -0.16, 0]);
    forearm.scale.x = bulky ? 1.2 : 1;
    elbow.add(forearm);
    const hand = new THREE.Group();
    hand.position.y = -0.32;
    elbow.add(hand);
    const palm = rigPart(new THREE.SphereGeometry(0.062, 8, 6), skinMat(skin), [0, 0, 0]);
    palm.scale.set(0.82, 1.05, 0.72);
    hand.add(palm);
    if (!robe) {
      const bracer = rigPart(new THREE.CylinderGeometry(0.066, 0.072, 0.12, 8), leatherMat, [0, -0.06, 0]);
      hand.add(bracer);
    }
    const shoulderPad = rigPart(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), darkSteelMat, [0, 0.03, 0]);
    shoulderPad.scale.set(1.1, 0.7, 1.1);
    if (bulky) shoulder.add(shoulderPad);
    shoulders.push(shoulder);
    arms.push({ shoulder, elbow, hand });
  }

  const legParts = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, -0.03, 0);
    hips.add(hip);
    const thigh = rigPart(new THREE.CapsuleGeometry(0.082, 0.32, 4, 8), clothMat(pants), [0, -0.22, 0]);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    const shin = rigPart(new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), clothMat(pants), [0, -0.17, 0]);
    knee.add(shin);
    const boot = rigPart(new THREE.BoxGeometry(0.14, 0.14, 0.27), new THREE.MeshStandardMaterial({ color: boots, roughness: 0.95 }), [0, -0.36, 0.06]);
    knee.add(boot);
    legParts.push({ hip, knee });
  }

  const back = new THREE.Group();
  torso.add(back);

  let capeMesh = null;
  if (cape) {
    capeMesh = makeCape();
    torso.add(capeMesh);
  }

  if (shield) {
    const shieldMesh = makeShield();
    shieldMesh.position.set(0.06, 0.34, -0.3);
    shieldMesh.rotation.set(0.08, Math.PI + 0.2, 0.12);
    shieldMesh.scale.setScalar(0.96);
    torso.add(shieldMesh);
  }

  const weapons = {};
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.03, 0.02);
  arms[1].hand.add(weaponMount);

  const defaultTool = staff ? 'staff' : 'sword';
  for (const type of ['sword', 'axe', 'pickaxe', 'staff']) {
    const tool = createTool(type);
    if (type !== defaultTool) tool.visible = false;
    weapons[type] = tool;
    weaponMount.add(tool);
  }

  root.scale.setScalar(scale);

  const state = {
    phase: Math.random() * 10,
    speed: 0,
    running: false,
    attacking: false,
    attackTime: 0,
    action: null,
    actionTime: 0,
    hit: 0,
  };

  const base = {
    torsoY: torso.position.y,
    torsoX: torso.rotation.x,
    armL: arms[0].shoulder.rotation.x,
    armR: arms[1].shoulder.rotation.x,
    lean: 0,
  };

  function setTool(type) {
    for (const [key, tool] of Object.entries(weapons)) tool.visible = key === type;
  }

  function attack() {
    if (state.attacking) return;
    state.attacking = true;
    state.attackTime = 0;
  }

  function setAction(action) {
    state.action = action;
    state.actionTime = 0;
  }

  function update(dt, time) {
    state.phase += dt * (2.6 + state.speed * 1.8);
    const phase = state.phase;
    const moving = state.speed > 0.15;
    const pace = state.running ? 1.5 : 1;
    const swing = moving ? Math.sin(phase * 2 * pace) : 0;
    const swing2 = moving ? Math.sin(phase * 2 * pace + Math.PI) : 0;

    let armLTarget = base.armL + swing * (state.running ? 0.72 : 0.46);
    let armRTarget = base.armR + swing2 * (state.running ? 0.72 : 0.46);
    let torsoTwist = moving ? swing * 0.07 : Math.sin(time * 1.2) * 0.018;
    let lean = state.running ? -0.16 : (moving ? -0.07 : 0);
    let torsoY = base.torsoY + (moving ? Math.abs(Math.sin(phase * 2 * pace)) * 0.035 : Math.sin(time * 2) * 0.012);
    let armSpreadL = 0.08, armSpreadR = 0.08;

    if (state.action === 'chop' || state.action === 'mine') {
      const p = Math.sin(time * 9) * 0.5 + 0.5;
      armRTarget = -1.35 - p * 1.25;
      armLTarget = -0.55 - p * 0.25;
      torsoTwist = -0.12 + p * 0.32;
      lean = -0.06;
    }

    if (state.attacking) {
      state.attackTime += dt;
      const dur = 0.62;
      const t = clamp(state.attackTime / dur, 0, 1);
      const wind = Math.min(t / 0.28, 1);
      const strike = t > 0.28 ? Math.min((t - 0.28) / 0.24, 1) : 0;
      const recover = t > 0.52 ? (t - 0.52) / 0.48 : 0;
      const armAngle = t < 0.28 ? lerp(0, 0.75, wind) : t < 0.52 ? lerp(0.75, -2.35, strike) : lerp(-2.35, 0, recover);
      armRTarget = armAngle;
      armLTarget = t < 0.52 ? lerp(0, -0.65, Math.min(t / 0.4, 1)) : lerp(-0.65, 0, recover);
      torsoTwist = t < 0.52 ? lerp(0, -0.55, Math.min(t / 0.36, 1)) : lerp(-0.55, 0, recover);
      lean = t < 0.52 ? -0.12 : 0;
      torsoY = base.torsoY - 0.02;
      if (t >= 1) { state.attacking = false; state.attackTime = 0; }
    }

    if (state.hit > 0) {
      state.hit = Math.max(0, state.hit - dt * 4);
      lean += Math.sin(state.hit * 20) * 0.04 * state.hit;
      torsoTwist += Math.sin(time * 34) * 0.05 * state.hit;
    }

    arms[0].shoulder.rotation.x = damp(arms[0].shoulder.rotation.x, armLTarget, 18, dt);
    arms[1].shoulder.rotation.x = damp(arms[1].shoulder.rotation.x, armRTarget, 22, dt);
    arms[0].shoulder.rotation.z = damp(arms[0].shoulder.rotation.z, -armSpreadL, 10, dt);
    arms[1].shoulder.rotation.z = damp(arms[1].shoulder.rotation.z, armSpreadR, 10, dt);
    arms[0].elbow.rotation.x = damp(arms[0].elbow.rotation.x, moving ? 0.18 : 0.06, 8, dt);
    arms[1].elbow.rotation.x = damp(arms[1].elbow.rotation.x, state.attacking || state.action ? 0.28 : 0.06, 8, dt);

    legParts[0].hip.rotation.x = damp(legParts[0].hip.rotation.x, moving ? swing * 0.72 * pace : 0, 16, dt);
    legParts[1].hip.rotation.x = damp(legParts[1].hip.rotation.x, moving ? swing2 * 0.72 * pace : 0, 16, dt);
    legParts[0].knee.rotation.x = damp(legParts[0].knee.rotation.x, moving ? Math.max(0, -swing) * 0.5 : 0, 14, dt);
    legParts[1].knee.rotation.x = damp(legParts[1].knee.rotation.x, moving ? Math.max(0, -swing2) * 0.5 : 0, 14, dt);

    torso.rotation.y = damp(torso.rotation.y, torsoTwist, 12, dt);
    torso.rotation.x = damp(torso.rotation.x, lean, 8, dt);
    torso.position.y = damp(torso.position.y, torsoY, 10, dt);
    head.rotation.y = damp(head.rotation.y, moving ? 0 : Math.sin(time * 0.7) * 0.12, 3, dt);
    head.rotation.x = damp(head.rotation.x, state.attacking ? 0.1 : 0, 6, dt);

    if (capeMesh) {
      const pos = capeMesh.geometry.attributes.position;
      const basePos = capeMesh.userData.base;
      const strength = 0.055 + state.speed * 0.018 + (state.running ? 0.12 : 0);
      for (let i = 0; i < pos.count; i++) {
        const x = basePos[i * 3];
        const y = basePos[i * 3 + 1];
        const z = basePos[i * 3 + 2];
        const tt = -y / 1.22;
        pos.setZ(i, z - Math.abs(x) * 0.12 + Math.sin(time * (2.2 + state.speed * 0.55) + y * 4 + x * 3) * strength * tt - state.speed * 0.018 * tt);
        pos.setX(i, x + Math.sin(time * 1.7 + y * 3) * 0.025 * tt);
      }
      pos.needsUpdate = true;
      capeMesh.geometry.computeVertexNormals();
    }

    if (weapons.staff) {
      const crystal = weapons.staff.userData.crystal;
      if (crystal) {
        crystal.rotation.y += dt * 0.9;
        crystal.position.y = 1.66 + Math.sin(time * 2) * 0.02;
      }
    }
  }

  return { root, body, torso, head, hips, arms, legs: legParts, weapons, weaponMount, state, attack, setTool, setAction, update, scale, height: 1.85 * scale };
}

export function createGoblin() {
  const goblin = createHumanoid({
    skin: 0x7f9a4e, hair: 0x302f22, shirt: 0x5d4a32, pants: 0x3e3527, boots: 0x2d2318,
    scale: 0.78, bulky: false,
  });
  goblin.root.traverse((o) => {
    if (o.isMesh && o.material && o.material.color) {
      if (o.material.color.getHex() === 0x747f89) o.material.color.setHex(0x4c523f);
    }
  });
  const head = goblin.head;
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.3, 5), skinMat(0x7f9a4e));
    ear.position.set(side * 0.19, 0.03, -0.01);
    ear.rotation.z = side * -1.15;
    ear.rotation.x = -0.12;
    ear.castShadow = true;
    head.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 5), skinMat(0x7f9a4e));
  nose.position.set(0, -0.01, 0.2);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.02), new THREE.MeshStandardMaterial({ color: 0x33261d }));
  mouth.position.set(0, -0.08, 0.155);
  head.add(mouth);
  for (const side of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 4), new THREE.MeshStandardMaterial({ color: 0xe6dfc8 }));
    tusk.position.set(side * 0.05, -0.08, 0.165);
    head.add(tusk);
  }
  const club = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x50341d, roughness: 1 }));
  shaft.position.y = 0.2;
  club.add(shaft);
  const knot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ color: 0x5e3f24, roughness: 1 }));
  knot.position.y = 0.46;
  knot.scale.set(0.9, 1.2, 0.9);
  club.add(knot);
  club.position.set(0, -0.05, 0);
  club.rotation.set(0.5, 0, -0.2);
  club.visible = false;
  goblin.weaponMount.add(club);
  goblin.weapons.club = club;
  goblin.setTool('club');
  goblin.root.scale.setScalar(0.86);
  return goblin;
}
