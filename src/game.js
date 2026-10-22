import * as THREE from "../vendor/three.module.js";
import {
  createMaterials,
  createSky,
  createLights,
  createGround,
  createHouse,
  createWatchtower,
  createGarden,
  createCampfire,
  createFence,
  createCampProps,
  createTree,
  createBush,
  createHuman,
  createZombie,
  createCar,
  createDistantTown,
  createBillboard,
  createTelephonePoles,
  createParticles,
  createStructure,
  createBuildGrid,
} from "./art.js";
import { mergeStatic } from "./merge.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (id) => document.getElementById(id);

const BUILD_TYPES = {
  barricade: {
    name: "BARRICADE",
    tag: "PERIMETER",
    desc: "Sandbags and scrap boards. Blocks walkers at the fence.",
    cost: { wood: 12, scrap: 4 },
    defense: 8,
    hotkey: "1",
    icon: `<svg viewBox="0 0 34 34"><path d="M4 25h26M7 25V12l5-4 5 4v13M17 25V12l5-4 5 4v13"/><path d="M6 18h8M20 18h8M8 21h5M21 21h5"/></svg>`,
  },
  watchtower: {
    name: "WATCHTOWER",
    tag: "DEFENSE",
    desc: "A raised firing position. Watches the north approach.",
    cost: { wood: 30, scrap: 20 },
    defense: 18,
    hotkey: "2",
    icon: `<svg viewBox="0 0 34 34"><path d="M10 29 13 12h8l3 17M11 20h12M8 11h18M9 5h16v6H9zM17 5V2"/><path d="m11 12 6 17 6-17M12 29h10"/></svg>`,
  },
  garden: {
    name: "VEGETABLE PLOT",
    tag: "FOOD",
    desc: "Raised beds and cold-hardy crops. Produces food each day.",
    cost: { wood: 10, scrap: 2 },
    food: 2,
    hotkey: "3",
    icon: `<svg viewBox="0 0 34 34"><path d="M4 26h26M5 29h24M7 26V16h20v10M11 26v-7M17 26v-9M23 26v-6"/><path d="M9 15c-1-4 2-6 4-6 1 3 0 6-4 6ZM16 14c-1-5 3-8 6-8 1 4-1 8-6 8ZM22 15c2-3 5-3 7-2-1 3-4 4-7 2Z"/></svg>`,
  },
  collector: {
    name: "RAIN CATCHER",
    tag: "WATER / FOOD",
    desc: "Gravity-fed tarp and barrels. Adds a little food each day.",
    cost: { wood: 8, scrap: 12 },
    food: 2,
    hotkey: "4",
    icon: `<svg viewBox="0 0 34 34"><path d="M6 13h22L17 4 6 13ZM17 13v6"/><path d="M12 19h10v11H12zM14 22h6M14 26h6"/><path d="M8 9c-1 3-1 5 1 5s2-2 1-5M26 10c-1 2-1 4 1 4s2-1 1-4"/></svg>`,
  },
  turret: {
    name: "SENTRY TURRET",
    tag: "DEFENSE",
    desc: "Salvaged auto-gun. Burns ammo, but tears through a horde.",
    cost: { scrap: 28, ammo: 25 },
    defense: 22,
    hotkey: "5",
    icon: `<svg viewBox="0 0 34 34"><path d="M17 19v8M17 27 9 31M17 27l8 4M17 27v5M7 13h14v6H7zM21 15h9v3h-9zM11 13V9h3v4M12 6l2 3M26 7h3"/></svg>`,
  },
  clinic: {
    name: "FIELD CLINIC",
    tag: "MORALE / HEALTH",
    desc: "Clean cots and a med crate. Lifts morale and tends the wounded.",
    cost: { wood: 14, scrap: 10, meds: 8 },
    morale: 4,
    hotkey: "6",
    icon: `<svg viewBox="0 0 34 34"><path d="m4 27 15-19 11 19H4Z"/><path d="m8 27 11-14 8 14M17 16v8M13 20h8"/><path d="M27 7h3v3M4 9V6h3"/></svg>`,
  },
};

const LOCATIONS = [
  {
    id: "diner",
    name: "ROADSIDE DINER",
    desc: "FOOD / MEDS  •  WALKERS: FEW",
    risk: "LOW",
    className: "diner",
    rewards: { food: [9, 17], meds: [1, 4] },
    danger: 0.16,
  },
  {
    id: "hardware",
    name: "HARDWARE STORE",
    desc: "WOOD / SCRAP  •  WALKERS: MANY",
    risk: "MED",
    className: "",
    rewards: { wood: [18, 32], scrap: [9, 19] },
    danger: 0.34,
  },
  {
    id: "police",
    name: "POLICE STATION",
    desc: "AMMO / MEDS  •  WALKERS: HORDE",
    risk: "HIGH",
    className: "police",
    rewards: { ammo: [18, 34], meds: [4, 9] },
    danger: 0.56,
  },
];

const RES_META = {
  food: { label: "FOOD", short: "F" },
  wood: { label: "WOOD", short: "W" },
  scrap: { label: "SCRAP", short: "S" },
  meds: { label: "MEDS", short: "M" },
  ammo: { label: "AMMO", short: "A" },
};

const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x705441, 0.0095);

const camera = new THREE.PerspectiveCamera(39, window.innerWidth / window.innerHeight, 0.1, 260);
camera.position.set(29, 24, 39);

const mats = createMaterials();
const sky = createSky(scene);
const lights = createLights(scene);
const ground = createGround(scene, mats);
const staticGroup = new THREE.Group();
scene.add(staticGroup);
staticGroup.add(ground.group);

const house = createHouse(mats);
staticGroup.add(house);

const watchtower = createWatchtower(mats);
watchtower.position.set(8.8, 0, 7.7);
watchtower.rotation.y = -0.1;
staticGroup.add(watchtower);

const garden = createGarden(mats);
garden.position.set(-8.8, 0, 1.1);
staticGroup.add(garden);

const campfire = createCampfire(mats);
campfire.group.position.set(-1.2, 0, 4.0);
staticGroup.add(campfire.group);

const fence = createFence(mats);
staticGroup.add(fence);
const campProps = createCampProps(mats);
staticGroup.add(campProps);

const town = createDistantTown(mats, scene);
const billboard = createBillboard(mats, scene);
const poles = createTelephonePoles(mats, scene, ground.roadCurve);
staticGroup.add(town.group, billboard, poles);

const rng = (() => {
  let a = 7719;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const treeSpots = [
  [-20, -16, "pine"], [-26, -4, "dead"], [-21, 10, "pine"], [-27, 23, "pine"],
  [23, -17, "pine"], [27, 1, "dead"], [24, 17, "pine"], [30, 31, "dead"],
  [-18, 30, "dead"], [17, -28, "pine"], [-34, -24, "pine"], [34, -8, "pine"],
  [-31, 13, "dead"], [39, 18, "pine"], [-7, -28, "dead"], [10, -35, "pine"],
  [-39, 31, "dead"], [31, 48, "pine"], [-15, 42, "pine"], [-24, 44, "dead"],
];
for (const [x, z, type] of treeSpots) {
  const tree = createTree(mats, rng, type);
  tree.position.set(x + (rng() - 0.5) * 2, 0, z + (rng() - 0.5) * 2);
  tree.rotation.y = rng() * TAU;
  tree.scale.setScalar(0.8 + rng() * 0.65);
  staticGroup.add(tree);
}
for (let i = 0; i < 22; i++) {
  const a = rng() * TAU;
  const d = 15 + rng() * 28;
  const bush = createBush(mats, rng);
  bush.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
  bush.scale.setScalar(0.55 + rng() * 0.8);
  staticGroup.add(bush);
}

const car1 = createCar(mats, 0x54352b);
car1.position.set(14.5, 0, 29.5);
car1.rotation.y = -0.52;
car1.rotation.z = 0.02;
staticGroup.add(car1);
const car2 = createCar(mats, 0x3f4a42);
car2.position.set(-17.5, 0, 19);
car2.rotation.y = 2.2;
car2.rotation.x = 0.04;
staticGroup.add(car2);

mergeStatic(staticGroup);

const particles = createParticles(scene);
const grid = createBuildGrid(scene);

const state = {
  day: 7,
  minutes: 19 * 60 + 42,
  timeSpeed: 0.5,
  resources: { food: 48, wood: 120, scrap: 75, meds: 12, ammo: 60 },
  defense: 42,
  morale: 68,
  maxSurvivors: 6,
  structures: 3,
  buildCap: 16,
  foodRate: 3,
  woodRate: 3,
  scrapRate: 1,
  buildMode: false,
  selectedBuild: "barricade",
  buildRotation: 0,
  hoverCell: null,
  hoverValid: false,
  ghost: null,
  survivorSelected: null,
  mission: null,
  raid: null,
  raidDone: false,
  raidTimer: 0,
  resourceTimer: 0,
  uiTimer: 0,
  lastTime: 0,
  elapsed: 0,
  pointer: new THREE.Vector2(),
  pointerClient: { x: 0, y: 0 },
  dragging: false,
  dragMoved: false,
  dragButton: 0,
  dragStart: { x: 0, y: 0 },
  lastPointer: { x: 0, y: 0 },
  keys: new Set(),
  target: new THREE.Vector3(0, 2.3, 0.3),
  radius: 52,
  theta: 0.64,
  phi: 1.135,
  zoomTarget: 52,
  userZoomed: false,
  introDone: false,
  objectiveStage: 0,
  hoveredSurvivor: null,
};

const occupancy = new Set();
const cellKey = (col, row) => `${col},${row}`;
const cellCenters = [];
for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 9; col++) {
    cellCenters.push({ col, row, x: -8.8 + col * 2.2, z: -7.7 + row * 2.2 });
  }
}
function markCellAt(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const c of cellCenters) {
    const d = (c.x - x) ** 2 + (c.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best) occupancy.add(cellKey(best.col, best.row));
}
for (let col = 0; col < 9; col++) {
  const x = -8.8 + col * 2.2;
  if (x >= -4.4 && x <= 4.4) {
    for (let row = 0; row < 8; row++) {
      const z = -7.7 + row * 2.2;
      if (z >= -6.6 && z <= -0.2) occupancy.add(cellKey(col, row));
    }
  }
}
markCellAt(-8.8, 1.1);
markCellAt(8.8, 7.7);
markCellAt(-1.2, 4.0);
markCellAt(-8.7, 7.9);
markCellAt(-2.5, 8.3);
markCellAt(6.5, 8.4);
markCellAt(10.6, 2.1);
markCellAt(-10.4, 4.8);

const survivors = [];
const survivorBase = [
  {
    id: "maya",
    name: "MAYA TORRES",
    role: "SCOUT",
    health: 86,
    state: "ON WATCH",
    stateClass: "",
    shirt: 0x77633f,
    pants: 0x343a33,
    skin: 0x936a4f,
    cap: 0x51432f,
    rifle: true,
    scale: 0.78,
    baseY: 4.63,
    x: 8.8,
    z: 7.7,
    route: null,
    face: Math.PI,
    speed: 0,
  },
  {
    id: "dale",
    name: "DALE MERCER",
    role: "BUILDER",
    health: 72,
    state: "FORTIFYING",
    stateClass: "",
    shirt: 0x58634e,
    pants: 0x3d352d,
    skin: 0x6f4c38,
    cap: 0x885a34,
    rifle: false,
    scale: 0.94,
    baseY: 0,
    x: -2.2,
    z: 5.8,
    route: [
      { x: -2.2, z: 5.8 }, { x: 2.2, z: 5.8 }, { x: 2.2, z: 3.4 },
      { x: -3.0, z: 3.4 }, { x: -5.3, z: 5.0 }, { x: -5.3, z: 7.2 },
    ],
    face: Math.PI,
    speed: 0.62,
  },
  {
    id: "june",
    name: "JUNE PARK",
    role: "MEDIC",
    health: 91,
    state: "TENDING",
    stateClass: "busy",
    shirt: 0x526268,
    pants: 0x383c37,
    skin: 0xb18465,
    cap: null,
    rifle: false,
    scale: 0.9,
    baseY: 0,
    x: -6.1,
    z: 1.3,
    route: [
      { x: -6.1, z: 1.3 }, { x: -5.3, z: 3.6 }, { x: -7.1, z: 4.6 }, { x: -7.2, z: 2.5 },
    ],
    face: 0.4,
    speed: 0.4,
  },
  {
    id: "eli",
    name: "ELI WARD",
    role: "SCAVENGER",
    health: 74,
    state: "IDLE",
    stateClass: "idle",
    shirt: 0x6f4d39,
    pants: 0x31332e,
    skin: 0x9c7254,
    cap: 0x3d4037,
    rifle: false,
    scale: 0.92,
    baseY: 0,
    x: -0.9,
    z: 9.1,
    route: [
      { x: -0.9, z: 9.1 }, { x: 2.7, z: 9.0 }, { x: 3.2, z: 6.8 }, { x: 0.2, z: 7.5 },
    ],
    face: Math.PI,
    speed: 0.5,
  },
];

const ringMat = new THREE.MeshBasicMaterial({ color: 0xd7a45e, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
for (const data of survivorBase) {
  const group = createHuman({
    shirt: data.shirt,
    pants: data.pants,
    skin: data.skin,
    cap: data.cap,
    backpack: data.id === "june" || data.id === "eli",
    rifle: data.rifle,
    scale: data.scale,
  });
  group.position.set(data.x, data.baseY, data.z);
  group.rotation.y = data.face;
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.47, 14), new THREE.MeshBasicMaterial({ color: 0x0b0c08, transparent: true, opacity: 0.28, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.018;
  group.add(blob);
  scene.add(group);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.63, 28), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(data.x, data.baseY + 0.025, data.z);
  ring.visible = false;
  scene.add(ring);
  const survivor = {
    ...data,
    group,
    ring,
    routeIndex: 1,
    anim: Math.random() * TAU,
    mission: false,
    selected: false,
    hidden: false,
  };
  group.userData.entity = survivor;
  group.userData.kind = "survivor";
  survivors.push(survivor);
}

const zombies = [];
const ambientZombieCount = 16;
for (let i = 0; i < ambientZombieCount; i++) {
  const z = createZombie(rng, i);
  let a = rng() * TAU;
  let d = 16 + rng() * 18;
  if (i < 5) {
    a = (rng() - 0.5) * 1.2;
    d = 17 + rng() * 10;
  }
  const x = Math.cos(a) * d;
  const zz = Math.sin(a) * d + 1.5;
  z.position.set(x, 0, zz);
  z.rotation.y = Math.atan2(-x, -zz);
  z.scale.setScalar(0.9 + rng() * 0.16);
  z.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const zblob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshBasicMaterial({ color: 0x0b0c08, transparent: true, opacity: 0.25, depthWrite: false }));
  zblob.rotation.x = -Math.PI / 2;
  zblob.position.y = 0.018;
  z.add(zblob);
  z.userData.phase = rng() * TAU;
  z.userData.speed = 0.06 + rng() * 0.12;
  z.userData.base = new THREE.Vector3(x, 0, zz);
  z.userData.radius = 2 + rng() * 5;
  z.userData.anim = rng() * TAU;
  z.userData.raid = false;
  z.userData.kind = "zombie";
  scene.add(z);
  zombies.push(z);
}

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tempVec = new THREE.Vector3();
const clock = new THREE.Clock();

const ui = {
  resources: {
    food: $("res-food"),
    wood: $("res-wood"),
    scrap: $("res-scrap"),
    meds: $("res-meds"),
    ammo: $("res-ammo"),
  },
  rates: {
    food: $("rate-food"),
    wood: $("rate-wood"),
    scrap: $("rate-scrap"),
    meds: $("rate-meds"),
    ammo: $("rate-ammo"),
  },
  clockTime: $("clock-time"),
  clockDay: $("clock-day"),
  clockPhase: $("clock-phase"),
  sunDot: $("sun-dot"),
  nightCountdown: $("night-countdown"),
  survivorList: $("survivor-list"),
  survivorCount: $("survivor-count"),
  defense: $("stat-defense"),
  defenseFill: $("defense-fill"),
  morale: $("stat-morale"),
  moraleFill: $("morale-fill"),
  threat: $("stat-threat"),
  eventLog: $("event-log"),
  scavengeBtn: $("btn-scavenge"),
  scavengeSub: $("scavenge-sub"),
  missionProgress: $("mission-progress"),
  missionName: $("mission-name"),
  missionTime: $("mission-time"),
  missionFill: $("mission-fill"),
  objTitle: $("obj-title"),
  objDesc: $("obj-desc"),
  objProgress: $("obj-progress"),
  objPercent: $("obj-percent"),
  objFill: $("obj-fill"),
  objectivePanel: $("objective-panel"),
  controlStrip: $("control-strip"),
  buildButton: $("btn-build"),
  buildUI: $("build-ui"),
  buildPalette: $("build-palette"),
  buildCount: $("build-count"),
  buildCap: $("build-cap"),
  buildRes: {
    food: $("build-res-food"),
    wood: $("build-res-wood"),
    scrap: $("build-res-scrap"),
    meds: $("build-res-meds"),
    ammo: $("build-res-ammo"),
  },
  buildToast: $("build-toast"),
  sbIcon: $("sb-icon"),
  sbName: $("sb-name"),
  sbTag: $("sb-tag"),
  sbDesc: $("sb-desc"),
  sbCost: $("sb-cost"),
  hoverLabel: $("hover-label"),
  toastStack: $("toast-stack"),
  modal: $("scavenge-modal"),
  locationList: $("location-list"),
  modalClose: $("modal-close"),
  alertBanner: $("alert-banner"),
  alertTag: $("alert-tag"),
  alertText: $("alert-text"),
  alertTimer: $("alert-timer"),
  loading: $("loading"),
};

function renderSurvivorList() {
  ui.survivorList.innerHTML = survivors
    .map((s) => {
      const hp = Math.round(s.health);
      return `
        <div class="survivor-row ${s.selected ? "selected" : ""}" data-survivor="${s.id}">
          <div class="avatar ${s.hidden ? "busy" : s.health < 70 ? "hurt" : ""}">${s.name.split(" ").map((p) => p[0]).join("")}</div>
          <div class="sv-copy">
            <div class="sv-name-row"><span class="sv-name">${s.name}</span><span class="sv-hp">${hp}%</span></div>
            <div class="sv-role">${s.role}</div>
            <div class="sv-mini-meter"><i class="${hp < 70 ? "low" : ""}" style="width:${hp}%"></i></div>
          </div>
          <div class="sv-state ${s.stateClass}"><b>${s.hidden ? "AWAY" : s.state}</b><span>${s.hidden ? "SCAVENGING" : s.health < 70 ? "WOUNDED" : "STABLE"}</span></div>
        </div>`;
    })
    .join("");
  ui.survivorCount.textContent = String(survivors.filter((s) => !s.hidden).length).padStart(2, "0");
  ui.survivorList.querySelectorAll(".survivor-row").forEach((row) => {
    row.addEventListener("click", () => selectSurvivor(row.dataset.survivor));
  });
}

function selectSurvivor(id) {
  const survivor = survivors.find((s) => s.id === id);
  if (!survivor || survivor.hidden) return;
  survivors.forEach((s) => {
    s.selected = s === survivor;
    s.ring.visible = s === survivor;
  });
  state.survivorSelected = survivor.id;
  renderSurvivorList();
  const marker = document.createElement("div");
  marker.className = "toast";
  marker.innerHTML = `<b>${survivor.name}</b> ${survivor.role} // HEALTH ${Math.round(survivor.health)}%`;
  addToastNode(marker, 2600);
}

function renderBuildPalette() {
  ui.buildPalette.innerHTML = Object.entries(BUILD_TYPES)
    .map(([key, type]) => {
      const affordable = canAfford(type.cost);
      return `
        <button class="build-card ${state.selectedBuild === key ? "selected" : ""} ${affordable ? "" : "unaffordable"}" data-build="${key}">
          <span class="card-hotkey">${type.hotkey}</span>
          <span class="card-icon">${type.icon}</span>
          <span class="card-name">${type.name}</span>
          <span class="card-sub">${type.desc.split(".")[0]}</span>
          <span class="card-cost">${costMarkup(type.cost)}</span>
        </button>`;
    })
    .join("");
  ui.buildPalette.querySelectorAll(".build-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      selectBuildType(card.dataset.build);
    });
  });
}

function refreshBuildAffordability() {
  ui.buildPalette.querySelectorAll(".build-card").forEach((card) => {
    const type = BUILD_TYPES[card.dataset.build];
    if (type) card.classList.toggle("unaffordable", !canAfford(type.cost));
  });
}

function costMarkup(cost) {
  return Object.entries(cost)
    .map(([res, amount]) => `<span class="${state.resources[res] < amount ? "insufficient" : ""}"><i>${RES_META[res].short}</i>${amount}</span>`)
    .join("");
}

function costText(cost) {
  return Object.entries(cost)
    .map(([res, amount]) => `${RES_META[res].short} ${amount}`)
    .join("  /  ");
}

function canAfford(cost) {
  return Object.entries(cost).every(([res, amount]) => state.resources[res] >= amount);
}

function spend(cost) {
  for (const [res, amount] of Object.entries(cost)) state.resources[res] -= amount;
}

function renderResources(bump = null) {
  for (const [res, el] of Object.entries(ui.resources)) {
    el.textContent = String(Math.max(0, Math.round(state.resources[res])));
    if (bump === res) {
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
    }
    if (ui.buildRes[res]) ui.buildRes[res].textContent = String(Math.max(0, Math.round(state.resources[res])));
  }
  ui.rates.food.textContent = `+${Math.max(0, state.foodRate - Math.ceil(survivors.filter((s) => !s.hidden).length / 3))}`;
  ui.rates.wood.textContent = `+${state.woodRate}`;
  ui.rates.scrap.textContent = `+${state.scrapRate}`;
}

function renderStats() {
  ui.defense.textContent = String(Math.round(state.defense));
  ui.defenseFill.style.width = `${clamp(state.defense, 0, 100)}%`;
  ui.morale.textContent = String(Math.round(state.morale));
  ui.moraleFill.style.width = `${clamp(state.morale, 0, 100)}%`;
  ui.threat.textContent = state.raid ? "CRITICAL" : state.minutes > 20 * 60 + 15 || state.minutes < 6 * 60 ? "HIGH" : "ELEVATED";
  ui.threat.style.color = state.raid ? "var(--red-2)" : state.minutes > 20 * 60 + 15 || state.minutes < 6 * 60 ? "var(--red-2)" : "var(--orange)";
  ui.buildCount.textContent = String(state.structures).padStart(2, "0");
  updateObjective();
}

function updateObjective() {
  if (state.objectiveStage === 0) {
    const p = clamp((state.defense / 55) * 100, 0, 100);
    ui.objTitle.textContent = "FORTIFY BEFORE DARK";
    ui.objDesc.innerHTML = "Raise defense to <b>55</b>. The north fence is the weak point.";
    ui.objProgress.textContent = `DEFENSE ${Math.round(state.defense)} / 55`;
    ui.objPercent.textContent = `${Math.round(p)}%`;
    ui.objFill.style.width = `${p}%`;
    if (state.defense >= 55) {
      state.objectiveStage = 1;
      ui.objTitle.textContent = "PERIMETER SECURED";
      ui.objDesc.innerHTML = "The wall will hold. <b>Scavenge supplies</b> and keep morale above 40.";
      ui.objProgress.textContent = "DEFENSE THRESHOLD MET";
      ui.objPercent.textContent = "100%";
      ui.objFill.style.width = "100%";
      addLog("Defense threshold met. The perimeter is holding.");
      showToast("OBJECTIVE COMPLETE", "Perimeter secured", "good");
    }
  } else {
    const p = clamp(state.morale, 0, 100);
    ui.objTitle.textContent = "HOLD UNTIL DAWN";
    ui.objDesc.innerHTML = "Scavenge supplies and keep morale above <b>40</b>.";
    ui.objProgress.textContent = `MORALE ${Math.round(state.morale)} / 100`;
    ui.objPercent.textContent = `${Math.round(p)}%`;
    ui.objFill.style.width = `${p}%`;
  }
}

function updateClockUI() {
  const m = Math.floor(state.minutes) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  ui.clockTime.textContent = `${hh}:${mm}`;
  ui.clockDay.textContent = `DAY ${String(state.day).padStart(2, "0")}`;
  const phase = m >= 20 * 60 + 30 || m < 5 * 60 ? "NIGHT" : m < 7 * 60 ? "DAWN" : m < 18 * 60 ? "DAY" : "DUSK";
  ui.clockPhase.textContent = phase;
  const progress = clamp(1 - (m - 18 * 60) / (12 * 60), 0, 1);
  ui.sunDot.style.left = `${progress * 100}%`;
  ui.sunDot.classList.toggle("night", phase === "NIGHT" || phase === "DAWN");
  const realSecondsLeft = Math.max(0, ((21 * 60 - m) / state.timeSpeed));
  if (state.raidDone) {
    ui.nightCountdown.textContent = "HORDE REPELLED";
  } else if (state.raid) {
    ui.nightCountdown.textContent = "HORDE AT GATE";
  } else {
    const mins = Math.floor(realSecondsLeft / 60);
    const secs = Math.floor(realSecondsLeft % 60);
    ui.nightCountdown.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
}

function addLog(text) {
  const m = Math.floor(state.minutes) % 1440;
  const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const line = document.createElement("div");
  line.className = "log-line";
  line.innerHTML = `<time>${time}</time><p>${text}</p>`;
  ui.eventLog.prepend(line);
  while (ui.eventLog.children.length > 3) ui.eventLog.lastElementChild.remove();
}

function showToast(title, body, kind = "") {
  const node = document.createElement("div");
  node.className = `toast ${kind}`;
  node.innerHTML = `<b>${title}</b> ${body}`;
  addToastNode(node, 3400);
}

function addToastNode(node, duration) {
  ui.toastStack.appendChild(node);
  setTimeout(() => {
    node.classList.add("out");
    setTimeout(() => node.remove(), 320);
  }, duration);
}

function selectBuildType(key) {
  if (!BUILD_TYPES[key] || !state.buildMode) return;
  state.selectedBuild = key;
  const type = BUILD_TYPES[key];
  ui.sbIcon.innerHTML = type.icon;
  ui.sbName.textContent = type.name;
  ui.sbTag.textContent = type.tag;
  ui.sbDesc.textContent = type.desc;
  ui.sbCost.innerHTML = Object.entries(type.cost)
    .map(([res, amount]) => `<span class="${state.resources[res] < amount ? "insufficient" : ""}"><i>${RES_META[res].short}</i> ${amount}</span>`)
    .join("");
  ui.buildToast.classList.remove("invalid");
  ui.buildToast.textContent = canAfford(type.cost) ? "CLICK A GRID CELL TO PLACE" : "INSUFFICIENT MATERIALS";
  renderBuildPalette();
  makeGhost();
}

function makeGhost() {
  removeGhost();
  const type = BUILD_TYPES[state.selectedBuild];
  if (!type || !state.buildMode) return;
  const ghost = createStructure(state.selectedBuild, mats);
  ghost.traverse((obj) => {
    if (obj.isMesh || obj.isLine) {
      obj.castShadow = false;
      obj.receiveShadow = false;
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        obj.material = materials.map((mat) => {
          const m = mat.clone();
          m.transparent = true;
          m.opacity = 0.46;
          m.depthWrite = false;
          if (m.color) m.color.set(0x9ad37a);
          if (m.emissive) {
            m.emissive.set(0x3f7a2e);
            m.emissiveIntensity = 0.45;
          }
          return m;
        });
        if (obj.material.length === 1) obj.material = obj.material[0];
      }
    }
  });
  ghost.visible = false;
  scene.add(ghost);
  state.ghost = ghost;
}

function removeGhost() {
  if (!state.ghost) return;
  scene.remove(state.ghost);
  state.ghost.traverse((obj) => {
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => m.dispose && m.dispose());
    }
  });
  state.ghost = null;
}

function tintGhost(valid) {
  if (!state.ghost) return;
  const color = valid ? 0x9ad37a : 0xd65f48;
  const emissive = valid ? 0x3f7a2e : 0x7a2419;
  state.ghost.traverse((obj) => {
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => {
        if (m.color) m.color.set(color);
        if (m.emissive) {
          m.emissive.set(emissive);
          m.emissiveIntensity = 0.45;
        }
      });
    }
  });
}

function setBuildMode(active) {
  state.buildMode = active;
  document.body.classList.toggle("build-mode", active);
  ui.buildUI.classList.toggle("hidden", !active);
  ui.buildButton.classList.toggle("active", active);
  ui.buildButton.querySelector(".build-copy small").textContent = active ? "WORKSHOP" : "SETTLEMENT";
  ui.buildButton.querySelector(".build-copy strong").textContent = active ? "EXIT BUILD" : "BUILD MODE";
  ui.objectivePanel.style.opacity = active ? "0.25" : "";
  ui.controlStrip.style.opacity = active ? "0.25" : "";
  grid.group.visible = active;
  if (active) {
    closeModal();
    state.buildRotation = 0;
    selectBuildType(state.selectedBuild);
  } else {
    removeGhost();
    grid.hover.visible = false;
    grid.hoverBorder.visible = false;
    state.hoverCell = null;
  }
}

function pointerToNdc(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.pointerClient.x = event.clientX;
  state.pointerClient.y = event.clientY;
}

function updateBuildHover() {
  if (!state.buildMode || !state.ghost) return;
  raycaster.setFromCamera(state.pointer, camera);
  if (!raycaster.ray.intersectPlane(groundPlane, tempVec)) {
    state.ghost.visible = false;
    grid.hover.visible = false;
    grid.hoverBorder.visible = false;
    return;
  }
  const bounds = grid.bounds;
  let col = Math.round((tempVec.x - (-8.8)) / bounds.cell);
  let row = Math.round((tempVec.z - (-7.7)) / bounds.cell);
  col = clamp(col, 0, 8);
  row = clamp(row, 0, 7);
  const inside = tempVec.x >= bounds.minX && tempVec.x <= bounds.maxX && tempVec.z >= bounds.minZ && tempVec.z <= bounds.maxZ;
  const key = cellKey(col, row);
  const occupied = occupancy.has(key);
  const affordable = canAfford(BUILD_TYPES[state.selectedBuild].cost);
  const atCap = state.structures >= state.buildCap;
  const valid = inside && !occupied && affordable && !atCap;
  state.hoverCell = { col, row, x: -8.8 + col * 2.2, z: -7.7 + row * 2.2, key, valid };
  state.hoverValid = valid;
  state.ghost.visible = true;
  state.ghost.position.set(state.hoverCell.x, 0, state.hoverCell.z);
  state.ghost.rotation.y = state.buildRotation;
  tintGhost(valid);
  grid.hover.visible = true;
  grid.hoverBorder.visible = true;
  grid.hover.position.set(state.hoverCell.x, 0.08, state.hoverCell.z);
  grid.hoverBorder.position.set(state.hoverCell.x, 0.08, state.hoverCell.z);
  const color = valid ? 0xb6dc8d : 0xe16f55;
  grid.hover.material.color.set(valid ? 0x8fca6f : 0xc9513d);
  grid.hoverBorder.material.color.set(color);
  ui.buildToast.textContent = !inside
    ? "OUTSIDE BUILDABLE PERIMETER"
    : atCap
      ? "BUILD CAPACITY REACHED"
      : occupied
        ? "CELL OCCUPIED"
        : !affordable
          ? "INSUFFICIENT MATERIALS"
          : "CLICK TO PLACE";
  ui.buildToast.classList.toggle("invalid", !valid);
}

function placeStructure() {
  if (!state.buildMode || !state.hoverCell) return;
  if (!state.hoverValid) {
    const type = BUILD_TYPES[state.selectedBuild];
    if (state.structures >= state.buildCap) showToast("CANNOT BUILD", "Settlement build capacity reached", "danger");
    else if (!canAfford(type.cost)) showToast("CANNOT BUILD", "Not enough materials", "danger");
    else showToast("CANNOT BUILD", "That cell is blocked", "danger");
    return;
  }
  const type = BUILD_TYPES[state.selectedBuild];
  const cell = state.hoverCell;
  spend(type.cost);
  occupancy.add(cell.key);
  const built = createStructure(state.selectedBuild, mats);
  built.position.set(cell.x, 0, cell.z);
  built.rotation.y = state.buildRotation;
  built.scale.setScalar(0.7);
  built.userData.kind = "built";
  scene.add(built);
  const record = { object: built, born: performance.now(), type: state.selectedBuild };
  built.userData.record = record;
  state.buildAnims = state.buildAnims || [];
  state.buildAnims.push({ object: built, t: 0 });
  renderer.shadowMap.needsUpdate = true;
  state.structures += 1;
  state.defense += type.defense || 0;
  state.foodRate += type.food || 0;
  state.morale = clamp(state.morale + (type.morale || 0), 0, 100);
  renderResources();
  renderStats();
  requestAnimationFrame(renderBuildPalette);
  renderStats();
  showToast("CONSTRUCTED", `${type.name} added to the settlement`, "good");
  addLog(`${type.name} completed. ${type.defense ? `Defense +${type.defense}.` : type.food ? `Food +${type.food}/day.` : "Morale improved."}`);
  updateBuildHover();
}

function renderLocations() {
  ui.locationList.innerHTML = LOCATIONS.map(
    (loc) => `
      <button class="location-card" data-location="${loc.id}">
        <span class="loc-thumb ${loc.className}"></span>
        <span><span class="loc-name">${loc.name}</span><span class="loc-desc">${loc.desc}</span></span>
        <span class="loc-risk ${loc.risk === "LOW" ? "low" : loc.risk === "HIGH" ? "high" : "med"}">RISK ${loc.risk}</span>
        <span class="loc-go">›</span>
      </button>`
  ).join("");
  ui.locationList.querySelectorAll(".location-card").forEach((card) => {
    card.addEventListener("click", () => dispatchMission(card.dataset.location));
  });
}

function openModal() {
  if (state.mission) return;
  ui.modal.classList.remove("hidden");
  renderLocations();
}
function closeModal() {
  ui.modal.classList.add("hidden");
}

function dispatchMission(locationId) {
  if (state.mission) return;
  const loc = LOCATIONS.find((l) => l.id === locationId);
  const survivor = survivors.find((s) => s.id === "eli" && !s.hidden) || survivors.find((s) => !s.hidden);
  if (!survivor || !loc) return;
  closeModal();
  survivor.hidden = true;
  survivor.group.visible = false;
  survivor.ring.visible = false;
  survivor.state = "AWAY";
  survivor.stateClass = "busy";
  state.mission = {
    location: loc,
    survivor,
    endsAt: performance.now() + 20000,
    duration: 20000,
    startAt: performance.now(),
  };
  ui.scavengeBtn.disabled = true;
  ui.scavengeSub.textContent = `${survivor.name} en route`;
  ui.missionProgress.classList.remove("hidden");
  ui.missionName.textContent = loc.name;
  ui.missionFill.style.width = "0%";
  renderSurvivorList();
  addLog(`${survivor.name} departed for the ${loc.name.toLowerCase()}.`);
  showToast("SCAVENGER DISPATCHED", `${survivor.name} → ${loc.name}`, "");
}

function finishMission() {
  const mission = state.mission;
  if (!mission) return;
  const { location, survivor } = mission;
  const rewards = {};
  for (const [res, [min, max]] of Object.entries(location.rewards)) {
    rewards[res] = Math.round(min + Math.random() * (max - min));
    state.resources[res] += rewards[res];
  }
  survivor.hidden = false;
  survivor.group.visible = true;
  survivor.state = "IDLE";
  survivor.stateClass = "idle";
  const wounded = Math.random() < location.danger;
  if (wounded) {
    survivor.health = clamp(survivor.health - (8 + Math.random() * 16), 20, 100);
    survivor.state = "WOUNDED";
    survivor.stateClass = "hurt";
    survivor.health = Math.round(survivor.health);
  }
  state.mission = null;
  ui.scavengeBtn.disabled = false;
  ui.scavengeSub.textContent = "3 locations available";
  ui.missionProgress.classList.add("hidden");
  renderResources();
  renderSurvivorList();
  renderStats();
  const summary = Object.entries(rewards).map(([res, n]) => `+${n} ${RES_META[res].label.toLowerCase()}`).join(", ");
  showToast("SCAVENGERS RETURNED", `${survivor.name} recovered ${summary}`, "good");
  addLog(`${survivor.name} returned from ${location.name.toLowerCase()}: ${summary}.${wounded ? " <b>Wounded.</b>" : ""}`);
  if (wounded) addLog(`${survivor.name} needs medical attention.`);
  survivor.routeIndex = 0;
}

function startRaid() {
  if (state.raid || state.raidDone) return;
  state.raid = { time: 25, total: 25, resolved: false, extraZombies: [] };
  state.raidTimer = 25;
  document.body.classList.add("raid");
  ui.alertBanner.classList.remove("hidden");
  ui.alertTag.textContent = "PERIMETER ALERT";
  ui.alertText.textContent = "HORDE INBOUND — NORTH GATE";
  ui.alertTimer.textContent = "00:25";
  addLog("Radio chatter: a horde is moving up the access road.");
  showToast("HORDE INBOUND", "North gate — hold the perimeter", "danger");
  for (let i = 0; i < 10; i++) {
    const z = createZombie(rng, i + 30);
    const x = -14 + Math.random() * 28;
    const zz = 15 + Math.random() * 6;
    z.position.set(x, 0, zz);
    z.scale.setScalar(0.92 + Math.random() * 0.15);
    z.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const zblob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshBasicMaterial({ color: 0x0b0c08, transparent: true, opacity: 0.25, depthWrite: false }));
    zblob.rotation.x = -Math.PI / 2;
    zblob.position.y = 0.018;
    z.add(zblob);
    z.userData.raid = true;
    z.userData.anim = Math.random() * TAU;
    z.userData.target = new THREE.Vector3((Math.random() - 0.5) * 7, 0, 13.4 + Math.random() * 2.6);
    z.userData.kind = "zombie";
    scene.add(z);
    zombies.push(z);
    state.raid.extraZombies.push(z);
  }
}

function resolveRaid() {
  if (!state.raid) return;
  const power = state.defense + (state.resources.ammo > 0 ? 8 : 0);
  const held = power >= 60;
  document.body.classList.remove("raid");
  ui.alertTag.textContent = held ? "PERIMETER REPORT" : "BREACH REPORT";
  ui.alertText.textContent = held ? "HORDE REPELLED — WALLS HOLD" : "WEST FENCE BREACHED — FALL BACK";
  ui.alertTimer.textContent = held ? "HELD" : "BREACH";
  if (held) {
    state.morale = clamp(state.morale + 7, 0, 100);
    state.resources.ammo = Math.max(0, state.resources.ammo - 12);
    showToast("PERIMETER HELD", "The horde broke against the wall", "good");
    addLog("Horde repelled. <b>Morale +7.</b> Ammo spent.");
  } else {
    state.morale = clamp(state.morale - 12, 0, 100);
    state.resources.food = Math.max(0, state.resources.food - 18);
    state.resources.meds = Math.max(0, state.resources.meds - 4);
    const victim = survivors[Math.floor(Math.random() * survivors.length)];
    victim.health = clamp(victim.health - 18, 12, 100);
    survivorUpdateVisual(victim);
    showToast("BREACH", "Supplies lost. A survivor is wounded", "danger");
    addLog("West fence breached. <b>-18 food, -4 meds.</b>");
  }
  renderResources();
  renderSurvivorList();
  renderStats();
  state.raidDone = true;
  const raid = state.raid;
  setTimeout(() => {
    ui.alertBanner.classList.add("hidden");
    state.raid = null;
    for (const z of raid.extraZombies) {
      scene.remove(z);
      const idx = zombies.indexOf(z);
      if (idx >= 0) zombies.splice(idx, 1);
    }
  }, 4200);
}

function survivorUpdateVisual(s) {
  if (s.health < 70) {
    s.state = "WOUNDED";
    s.stateClass = "hurt";
  }
}

function handleMissionUpdate(now) {
  if (!state.mission) return;
  const elapsed = now - state.mission.startAt;
  const p = clamp(elapsed / state.mission.duration, 0, 1);
  ui.missionFill.style.width = `${p * 100}%`;
  const remaining = Math.max(0, 20 - elapsed / 1000);
  ui.missionTime.textContent = `00:${String(Math.ceil(remaining)).padStart(2, "0")}`;
  if (p >= 1) finishMission();
}

function updateSurvivors(dt, t) {
  for (const s of survivors) {
    if (s.hidden) continue;
    const parts = s.group.userData.parts;
    if (s.route && s.speed > 0) {
      const target = s.route[s.routeIndex];
      const dx = target.x - s.group.position.x;
      const dz = target.z - s.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.16) {
        s.routeIndex = (s.routeIndex + 1) % s.route.length;
      } else {
        const move = Math.min(dist, s.speed * dt);
        s.group.position.x += (dx / dist) * move;
        s.group.position.z += (dz / dist) * move;
        const targetRot = Math.atan2(dx, dz);
        let diff = targetRot - s.group.rotation.y;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        s.group.rotation.y += diff * Math.min(1, dt * 5);
      }
      s.anim += dt * 7.2;
      const swing = Math.sin(s.anim) * 0.58;
      parts.leftLeg.rotation.x = swing;
      parts.rightLeg.rotation.x = -swing;
      parts.leftArm.rotation.x = -swing * 0.65;
      parts.rightArm.rotation.x = swing * 0.65;
      s.group.position.y = s.baseY + Math.abs(Math.sin(s.anim)) * 0.025;
      s.ring.position.set(s.group.position.x, s.group.position.y + 0.025, s.group.position.z);
    } else {
      parts.leftLeg.rotation.x *= 0.9;
      parts.rightLeg.rotation.x *= 0.9;
      parts.leftArm.rotation.x = Math.sin(t * 1.2 + s.anim) * 0.05;
      parts.rightArm.rotation.x = -Math.sin(t * 1.2 + s.anim) * 0.05;
      if (s.id === "maya") {
        if (parts.head) parts.head.rotation.y = Math.sin(t * 0.45) * 0.35;
        s.group.rotation.y = Math.PI + Math.sin(t * 0.23) * 0.12;
      } else {
        s.group.position.y = s.baseY + Math.sin(t * 1.5 + s.anim) * 0.008;
      }
    }
    if (s.selected) {
      s.ring.visible = true;
      s.ring.material.opacity = 0.5 + Math.sin(t * 2.2) * 0.16;
      s.ring.rotation.z = t * 0.35;
    } else {
      s.ring.visible = false;
    }
  }
}

function updateZombies(dt, t) {
  for (const z of zombies) {
    z.userData.anim += dt * (z.userData.raid ? 2.6 : 1.5);
    z.rotation.z = z.userData.baseTilt + Math.sin(z.userData.anim) * 0.075;
    z.rotation.x = Math.sin(t * 0.55 + z.userData.anim) * 0.025;

    if (z.userData.raid) {
      const target = z.userData.target;
      const dx = target.x - z.position.x;
      const dz = target.z - z.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.3 && state.raid) {
        z.position.x += (dx / d) * dt * 0.72;
        z.position.z += (dz / d) * dt * 0.72;
        z.rotation.y = Math.atan2(dx, dz);
      } else {
        z.position.x += Math.sin(t * 1.4 + z.userData.anim) * dt * 0.12;
      }
      z.position.y = Math.abs(Math.sin(z.userData.anim)) * 0.035;
      continue;
    }
    const phase = z.userData.phase;
    const base = z.userData.base;
    const radius = z.userData.radius;
    const speed = z.userData.speed;
    const nx = Math.cos(t * speed + phase) * radius;
    const nz = Math.sin(t * speed * 0.83 + phase * 1.7) * radius * 0.55;
    z.position.x = base.x + nx;
    z.position.z = base.z + nz;
    z.position.y = Math.abs(Math.sin(z.userData.anim)) * 0.035;
    const tx = -Math.sin(t * speed + phase) * radius * speed;
    const tz = Math.cos(t * speed * 0.83 + phase * 1.7) * radius * 0.55 * speed * 0.83;
    if (Math.abs(tx) + Math.abs(tz) > 0.0001) z.rotation.y = Math.atan2(tx, tz);
  }
}

function updateEnvironment(dt, t) {
  const n = clamp((state.minutes - 20 * 60) / 120, 0, 1);
  const night = clamp(n, 0, 1);
  lights.sun.intensity = 4.35 * (1 - night * 0.94);
  lights.hemi.intensity = 1.22 * (1 - night * 0.5);
  lights.rim.intensity = 1.02 * (1 - night * 0.45);
  lights.fill.intensity = 0.25 + night * 0.08;
  scene.fog.color.setHex(0x705441).lerp(new THREE.Color(0x11151c), night);
  scene.fog.density = lerp(0.0095, 0.017, night);
  renderer.toneMappingExposure = lerp(1.16, 0.86, night);
  sky.uniforms.night.value = night;
  sky.uniforms.sunDir.value.y = lerp(0.24, -0.22, night);
  sky.sun.position.copy(sky.uniforms.sunDir.value).multiplyScalar(128);
  sky.sun.material.opacity = Math.max(0, 0.95 - night * 1.35);
  mats.glass.emissiveIntensity = 2.2 + night * 2.8;
  campfire.light.intensity = 7.4 + Math.sin(t * 11.2) * 0.9 + Math.sin(t * 23.3) * 0.4 + night * 2.2;
  for (let i = 0; i < campfire.flameGroup.children.length; i++) {
    const flame = campfire.flameGroup.children[i];
    flame.scale.y = 0.8 + Math.sin(t * 9 + i * 1.7) * 0.22 + Math.sin(t * 17 + i) * 0.1;
    flame.rotation.y += dt * 0.8;
  }
  particles.update(dt, t);
  if (state.buildAnims) {
    for (const anim of state.buildAnims) {
      anim.t += dt;
      const p = clamp(anim.t / 0.28, 0, 1);
      const s = 0.7 + (1 - Math.pow(1 - p, 3)) * 0.3;
      anim.object.scale.setScalar(s);
      if (Math.abs(s - 1) < 0.001) anim.object.scale.setScalar(1);
    }
    state.buildAnims = state.buildAnims.filter((a) => a.t < 0.3);
  }
  if (state.raid) {
    state.raid.time -= dt;
    const rt = Math.max(0, Math.ceil(state.raid.time));
    ui.alertTimer.textContent = `00:${String(rt).padStart(2, "0")}`;
    if (state.raid.time <= 0) resolveRaid();
  }
}

function updateResources(dt) {
  state.resourceTimer += dt;
  if (state.resourceTimer < 18) return;
  state.resourceTimer = 0;
  const foodGain = Math.max(1, state.foodRate) - Math.ceil(survivors.filter((s) => !s.hidden).length / 3);
  state.resources.food = Math.max(0, state.resources.food + foodGain);
  state.resources.wood += state.woodRate;
  state.resources.scrap += state.scrapRate;
  if (state.morale < 40) state.resources.food = Math.max(0, state.resources.food - 1);
  if (state.morale < 25) state.morale = clamp(state.morale - 1, 0, 100);
  renderResources();
}

function updateHoveredSurvivor() {
  if (state.buildMode || state.dragging) {
    ui.hoverLabel.classList.add("hidden");
    canvas.classList.remove("pointing");
    return;
  }
  raycaster.setFromCamera(state.pointer, camera);
  const targets = survivors.filter((s) => !s.hidden).map((s) => s.group);
  const hits = raycaster.intersectObjects(targets, true);
  let entity = null;
  if (hits.length) {
    let obj = hits[0].object;
    while (obj && !entity) {
      if (obj.userData && obj.userData.entity) entity = obj.userData.entity;
      obj = obj.parent;
    }
  }
  if (entity) {
    ui.hoverLabel.classList.remove("hidden");
    ui.hoverLabel.style.left = `${state.pointerClient.x}px`;
    ui.hoverLabel.style.top = `${state.pointerClient.y}px`;
    ui.hoverLabel.textContent = `${entity.name}  /  ${entity.role}  /  ${Math.round(entity.health)}%`;
    canvas.classList.add("pointing");
    state.hoveredSurvivor = entity.id;
  } else {
    ui.hoverLabel.classList.add("hidden");
    canvas.classList.remove("pointing");
    state.hoveredSurvivor = null;
  }
}

function trySelectSurvivor() {
  raycaster.setFromCamera(state.pointer, camera);
  const targets = survivors.filter((s) => !s.hidden).map((s) => s.group);
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) {
    survivors.forEach((s) => {
      s.selected = false;
      s.ring.visible = false;
    });
    state.survivorSelected = null;
    renderSurvivorList();
    return;
  }
  let obj = hits[0].object;
  let entity = null;
  while (obj && !entity) {
    if (obj.userData && obj.userData.entity) entity = obj.userData.entity;
    obj = obj.parent;
  }
  if (entity) selectSurvivor(entity.id);
}

function updateCamera() {
  const p = state;
  if (p.keys.has("w") || p.keys.has("arrowup")) moveTarget(0, -1, 0.48);
  if (p.keys.has("s") || p.keys.has("arrowdown")) moveTarget(0, 1, 0.48);
  if (p.keys.has("a") || p.keys.has("arrowleft")) moveTarget(-1, 0, 0.48);
  if (p.keys.has("d") || p.keys.has("arrowright")) moveTarget(1, 0, 0.48);
  p.radius += (p.zoomTarget - p.radius) * 0.1;
  const sinPhi = Math.sin(p.phi);
  const x = p.target.x + p.radius * sinPhi * Math.sin(p.theta);
  const y = p.target.y + p.radius * Math.cos(p.phi);
  const z = p.target.z + p.radius * sinPhi * Math.cos(p.theta);
  camera.position.lerp(new THREE.Vector3(x, y, z), 0.16);
  const look = new THREE.Vector3(p.target.x, p.target.y + 0.2, p.target.z);
  camera.lookAt(look);
}

function moveTarget(right, forward, amount) {
  const dirX = Math.sin(state.theta);
  const dirZ = Math.cos(state.theta);
  state.target.x += (right * Math.cos(state.theta) + forward * dirX) * amount;
  state.target.z += (-right * Math.sin(state.theta) + forward * dirZ) * amount;
  state.target.x = clamp(state.target.x, -16, 16);
  state.target.z = clamp(state.target.z, -12, 16);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  state.elapsed += dt;
  state.minutes += dt * state.timeSpeed;
  if (state.minutes >= 1440) {
    state.minutes -= 1440;
    state.day += 1;
  }
  updateCamera();
  updateSurvivors(dt, state.elapsed);
  updateZombies(dt, state.elapsed);
  updateEnvironment(dt, state.elapsed);
  updateResources(dt);
  handleMissionUpdate(performance.now());
  if (!state.raidDone && !state.raid && state.minutes >= 21 * 60) startRaid();

  state.uiTimer += dt;
  if (state.uiTimer > 0.25) {
    state.uiTimer = 0;
    updateClockUI();
    renderResources();
    renderStats();
    if (state.buildMode) refreshBuildAffordability();
    if (state.mission) {
      const elapsed = performance.now() - state.mission.startAt;
      ui.missionFill.style.width = `${clamp(elapsed / state.mission.duration, 0, 1) * 100}%`;
      ui.missionTime.textContent = `00:${String(Math.max(0, Math.ceil(20 - elapsed / 1000))).padStart(2, "0")}`;
    }
  }
  renderer.render(scene, camera);
  state.frames = (state.frames || 0) + 1;
  if (state.frames === 5) renderer.shadowMap.autoUpdate = false;
  if (!state.introDone && state.elapsed > 0.15) {
    state.introDone = true;
    ui.loading.classList.add("done");
  }
}

function onPointerDown(event) {
  if (event.target !== canvas) return;
  pointerToNdc(event);
  state.dragging = true;
  state.dragMoved = false;
  state.dragButton = event.button;
  state.dragStart.x = event.clientX;
  state.dragStart.y = event.clientY;
  state.lastPointer.x = event.clientX;
  state.lastPointer.y = event.clientY;
  if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  pointerToNdc(event);
  if (state.dragging) {
    const dx = event.clientX - state.lastPointer.x;
    const dy = event.clientY - state.lastPointer.y;
    state.lastPointer.x = event.clientX;
    state.lastPointer.y = event.clientY;
    if (Math.abs(event.clientX - state.dragStart.x) + Math.abs(event.clientY - state.dragStart.y) > 5) state.dragMoved = true;
    if (state.dragButton === 0) {
      state.theta -= dx * 0.0037;
      state.phi = clamp(state.phi - dy * 0.003, 0.58, 1.36);
    } else if (state.dragButton === 2 || state.dragButton === 1) {
      moveTarget(-dx, dy, 0.02);
    }
    if (state.buildMode) updateBuildHover();
    return;
  }
  if (state.buildMode) {
    updateBuildHover();
  } else {
    updateHoveredSurvivor();
  }
}

function onPointerUp(event) {
  if (!state.dragging) return;
  const wasMoved = state.dragMoved;
  state.dragging = false;
  if (canvas.releasePointerCapture) {
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
  }
  if (wasMoved) return;
  pointerToNdc(event);
  if (event.button === 2) return;
  if (state.buildMode) {
    updateBuildHover();
    placeStructure();
  } else {
    trySelectSurvivor();
  }
}

function onWheel(event) {
  if (event.target !== canvas) return;
  event.preventDefault();
  state.zoomTarget = clamp(state.zoomTarget * (1 + event.deltaY * 0.0011), 28, 82);
  state.userZoomed = true;
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (key === "escape") {
    if (!ui.modal.classList.contains("hidden")) closeModal();
    else if (state.buildMode) setBuildMode(false);
    return;
  }
  if (ui.modal.classList.contains("hidden") === false && key !== "b") return;
  if (key === "b") {
    setBuildMode(!state.buildMode);
    return;
  }
  if (state.buildMode) {
    if (key === "r") {
      state.buildRotation = (state.buildRotation + Math.PI / 2) % TAU;
      updateBuildHover();
      return;
    }
    const entry = Object.entries(BUILD_TYPES).find(([, t]) => t.hotkey === key);
    if (entry) {
      selectBuildType(entry[0]);
      return;
    }
  }
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    state.keys.add(key);
    event.preventDefault();
  }
}

function onKeyUp(event) {
  state.keys.delete(event.key.toLowerCase());
}

function fitCameraToViewport() {
  if (state.userZoomed) return;
  const aspect = window.innerWidth / window.innerHeight;
  state.zoomTarget = aspect < 0.72 ? 68 : aspect < 1.1 ? 58 : 52;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitCameraToViewport();
}

canvas.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("wheel", onWheel, { passive: false });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("resize", onResize);
window.addEventListener("blur", () => state.keys.clear());

ui.buildButton.addEventListener("click", () => setBuildMode(!state.buildMode));
ui.scavengeBtn.addEventListener("click", openModal);
ui.modalClose.addEventListener("click", closeModal);
ui.modal.querySelector(".modal-scrim").addEventListener("click", closeModal);

renderSurvivorList();
renderBuildPalette();
renderResources();
renderStats();
updateClockUI();
renderLocations();
selectBuildType("barricade");

const loadingTimer = setTimeout(() => ui.loading.classList.add("done"), 1800);

fitCameraToViewport();
renderer.setAnimationLoop(animate);

window.__greyhaven = {
  state,
  renderer,
  scene,
  camera,
  lights,
  survivors,
  zombies,
  startRaid,
  setBuildMode,
  placeStructureHere(type, x, z) {
    const bounds = grid.bounds;
    const col = clamp(Math.round((x - (-8.8)) / bounds.cell), 0, 8);
    const row = clamp(Math.round((z - (-7.7)) / bounds.cell), 0, 7);
    setBuildMode(true);
    state.selectedBuild = type;
    selectBuildType(type);
    state.hoverCell = { col, row, x: -8.8 + col * 2.2, z: -7.7 + row * 2.2, key: cellKey(col, row), valid: true };
    state.hoverValid = true;
    placeStructure();
  },
};

setTimeout(() => clearTimeout(loadingTimer), 2400);
