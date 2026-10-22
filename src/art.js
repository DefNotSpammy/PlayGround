import * as THREE from "../vendor/three.module.js";

const TAU = Math.PI * 2;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

function rngFactory(seed = 1337) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

function noiseOverlay(ctx, w, h, count, colors, alpha, seed) {
  const rng = rngFactory(seed);
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.25 + rng() * 0.75);
    ctx.fillStyle = colors[(rng() * colors.length) | 0];
    const x = rng() * w;
    const y = rng() * h;
    const s = 0.4 + rng() * 2.2;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function makeTextTexture(text, options = {}) {
  const {
    width = 512,
    height = 128,
    color = "#e7dfca",
    background = "rgba(0,0,0,0)",
    font = "900 70px 'Barlow Condensed', sans-serif",
    letterSpacing = 4,
    sub = null,
    subColor = "#c69450",
  } = options;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.letterSpacing = `${letterSpacing}px`;
  const y = sub ? height * 0.42 : height * 0.5;
  ctx.fillText(text, width / 2, y);
  if (sub) {
    ctx.fillStyle = subColor;
    ctx.font = "500 21px 'Share Tech Mono', monospace";
    ctx.letterSpacing = "3px";
    ctx.fillText(sub, width / 2, height * 0.76);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createTextures() {
  const ground = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#4e5039";
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w * 0.4, h * 0.4, 5, w * 0.5, h * 0.5, w * 0.65);
    grad.addColorStop(0, "rgba(112,104,70,.16)");
    grad.addColorStop(1, "rgba(33,40,27,.22)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    noiseOverlay(ctx, w, h, 9500, ["#2f3827", "#656547", "#777456", "#363b2b", "#8a7e58"], 0.45, 12);
    const rng = rngFactory(77);
    for (let i = 0; i < 400; i++) {
      ctx.strokeStyle = rng() > 0.5 ? "rgba(39,49,30,.28)" : "rgba(124,119,77,.18)";
      ctx.lineWidth = 0.6 + rng() * 1.2;
      const x = rng() * w;
      const y = rng() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 12, y - 3 - rng() * 9);
      ctx.stroke();
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rng() > 0.5 ? "rgba(43,40,33,.5)" : "rgba(143,126,91,.3)";
      ctx.beginPath();
      ctx.ellipse(rng() * w, rng() * h, 0.7 + rng() * 2.2, 0.5 + rng() * 1.4, rng() * TAU, 0, TAU);
      ctx.fill();
    }
  }, 10, 10);

  const dirt = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.12, w / 2, h / 2, w * 0.5);
    grad.addColorStop(0, "rgba(89,75,54,.98)");
    grad.addColorStop(0.64, "rgba(76,66,47,.92)");
    grad.addColorStop(0.9, "rgba(64,59,43,.25)");
    grad.addColorStop(1, "rgba(64,59,43,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    noiseOverlay(ctx, w, h, 2600, ["#3d392c", "#87765a", "#5f523e", "#a48b63"], 0.28, 33);
  });

  const siding = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#77715f";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 13) {
      ctx.fillStyle = "rgba(39,35,27,.32)";
      ctx.fillRect(0, y, w, 1.4);
      ctx.fillStyle = "rgba(203,193,166,.08)";
      ctx.fillRect(0, y + 1.5, w, 1);
    }
    noiseOverlay(ctx, w, h, 3500, ["#4d493b", "#8c846d", "#615b4b", "#a6a087"], 0.3, 8);
    const rng = rngFactory(4);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = "rgba(42,38,31,.18)";
      ctx.lineWidth = 0.7;
      const x = rng() * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 4, h * 0.3, x - 3, h * 0.7, x + 2, h);
      ctx.stroke();
    }
  }, 3, 2);

  const roof = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#53453a";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 21) {
      ctx.fillStyle = "rgba(18,15,13,.36)";
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = "rgba(196,157,116,.07)";
      ctx.fillRect(x + 3, 0, 1, h);
    }
    noiseOverlay(ctx, w, h, 2400, ["#7e5037", "#392f28", "#956d48", "#2d2924"], 0.38, 21);
    const rng = rngFactory(55);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = "rgba(126,77,46,.2)";
      ctx.lineWidth = 1 + rng() * 3;
      const x = rng() * w;
      ctx.beginPath();
      ctx.moveTo(x, rng() * h * 0.4);
      ctx.lineTo(x + (rng() - 0.5) * 8, h * (0.4 + rng() * 0.6));
      ctx.stroke();
    }
  }, 4, 1);

  const metal = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#5c5a50";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = "rgba(28,28,24,.3)";
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = "rgba(206,201,178,.07)";
      ctx.fillRect(x + 2, 0, 1, h);
    }
    noiseOverlay(ctx, w, h, 2100, ["#7f5c40", "#373630", "#a17a50", "#45433b"], 0.32, 14);
  }, 2, 1);

  const stone = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#6a6454";
    ctx.fillRect(0, 0, w, h);
    const rng = rngFactory(23);
    for (let y = 0; y < h; y += 22) {
      for (let x = -10; x < w; x += 35) {
        ctx.fillStyle = `rgba(${55 + rng() * 45},${52 + rng() * 38},${42 + rng() * 30},.65)`;
        ctx.fillRect(x + rng() * 8, y + rng() * 4, 28 + rng() * 9, 17 + rng() * 5);
        ctx.strokeStyle = "rgba(25,24,20,.35)";
        ctx.strokeRect(x + rng() * 8, y + rng() * 4, 28 + rng() * 9, 17 + rng() * 5);
      }
    }
    noiseOverlay(ctx, w, h, 1600, ["#3d3a31", "#918773", "#575246"], 0.25, 11);
  }, 3, 2);

  const tent = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#9a927d";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 26) {
      ctx.fillStyle = "rgba(50,45,36,.13)";
      ctx.fillRect(x, 0, 1, h);
    }
    noiseOverlay(ctx, w, h, 1200, ["#6e6756", "#b9b09a", "#837a67"], 0.25, 3);
  }, 2, 2);

  const sign = makeTextTexture("GREYHAVEN", {
    width: 512,
    height: 160,
    color: "#e7deca",
    font: "900 74px 'Barlow Condensed', sans-serif",
    letterSpacing: 6,
    sub: "ST. JUDE'S FARMSTEAD",
  });

  const billboard = makeTextTexture("GREYHAVEN  2 MI", {
    width: 512,
    height: 256,
    color: "#e3d9c2",
    background: "#2b332b",
    font: "900 58px 'Barlow Condensed', sans-serif",
    letterSpacing: 2,
    sub: "TURN BACK  //  QUARANTINE ZONE",
    subColor: "#c66146",
  });

  return { ground, dirt, siding, roof, metal, stone, tent, sign, billboard };
}

function standard(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0,
    map: opts.map || null,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent || false,
    opacity: opts.opacity ?? 1,
    side: opts.side || THREE.FrontSide,
    flatShading: opts.flatShading ?? false,
  });
}

export function createMaterials() {
  const tex = createTextures();
  return {
    tex,
    ground: standard(0xffffff, { map: tex.ground, roughness: 1 }),
    dirt: new THREE.MeshStandardMaterial({
      map: tex.dirt,
      transparent: true,
      roughness: 1,
      depthWrite: false,
      alphaTest: 0.03,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    siding: standard(0xffffff, { map: tex.siding, roughness: 0.93 }),
    sidingDark: standard(0x6d6655, { roughness: 0.95 }),
    roof: standard(0xffffff, { map: tex.roof, roughness: 0.8, metalness: 0.12 }),
    metal: standard(0xffffff, { map: tex.metal, roughness: 0.78, metalness: 0.2 }),
    metalDark: standard(0x3e403b, { roughness: 0.72, metalness: 0.3 }),
    rust: standard(0x71452e, { roughness: 0.89, metalness: 0.08 }),
    stone: standard(0xffffff, { map: tex.stone, roughness: 1 }),
    wood: standard(0x5a4630, { roughness: 0.96 }),
    woodLight: standard(0x7e6747, { roughness: 0.94 }),
    woodDark: standard(0x352a1e, { roughness: 0.98 }),
    plank: standard(0x8a7352, { roughness: 0.94 }),
    sandbag: standard(0x8b8060, { roughness: 1, flatShading: true }),
    canvas: standard(0xffffff, { map: tex.tent, roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xffb45c,
      emissive: 0xff7a28,
      emissiveIntensity: 2.2,
      roughness: 0.36,
      transparent: true,
      opacity: 0.88,
    }),
    glassDark: standard(0x232925, { roughness: 0.45, metalness: 0.1 }),
    leaf: standard(0x4e6538, { roughness: 1, flatShading: true }),
    leafDark: standard(0x334429, { roughness: 1, flatShading: true }),
    leafDry: standard(0x796d3b, { roughness: 1, flatShading: true }),
    trunk: standard(0x453728, { roughness: 1, flatShading: true }),
    concrete: standard(0x6c6a5e, { roughness: 0.98 }),
    road: standard(0x3d3b35, { roughness: 0.96 }),
    roadLine: standard(0x9f9065, { roughness: 1 }),
    soil: standard(0x3e3325, { roughness: 1, flatShading: true }),
    crops: standard(0x687c3d, { roughness: 1, flatShading: true }),
    clothing: standard(0x5a5c48, { roughness: 1 }),
    tire: standard(0x1c1c19, { roughness: 0.95 }),
    red: standard(0x8e3527, { roughness: 0.85 }),
    blue: standard(0x46575c, { roughness: 0.88 }),
    yellow: standard(0xb5923d, { roughness: 0.85 }),
    white: standard(0xcac3b0, { roughness: 0.9 }),
    zombieSkin: standard(0x6f765d, { roughness: 1, flatShading: true }),
    zombieCloth: standard(0x34382e, { roughness: 1, flatShading: true }),
    zombieCloth2: standard(0x4a4034, { roughness: 1, flatShading: true }),
    skin: standard(0x9b7357, { roughness: 0.95 }),
    skinLight: standard(0xb08466, { roughness: 0.95 }),
    skinDark: standard(0x76513e, { roughness: 0.95 }),
    emissiveOrange: new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.88 }),
    emissiveRed: new THREE.MeshBasicMaterial({ color: 0xff3d26 }),
    black: standard(0x181a16, { roughness: 0.9 }),
    wire: new THREE.LineBasicMaterial({ color: 0x1e211c, transparent: true, opacity: 0.75 }),
  };
}

export function boxMesh(w, h, d, mat, x = 0, y = 0, z = 0, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function cylMesh(rt, rb, h, segments, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addEdges(mesh, color = 0x1b1d17, opacity = 0.45) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 30),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  edges.renderOrder = 1;
  mesh.add(edges);
  return mesh;
}

function pitchRoof(width, depth, rise, mat, y, z = 0, overhang = 0.5, thickness = 0.2) {
  const group = new THREE.Group();
  const slope = Math.atan2(rise, width / 2);
  const panelLen = Math.sqrt((width / 2 + overhang) ** 2 + rise ** 2) + 0.1;
  const panelW = width / 2 + overhang;
  for (const side of [-1, 1]) {
    const panel = boxMesh(panelLen, thickness, depth + overhang * 2, mat, side * panelW / 2, y + rise / 2, z);
    panel.rotation.z = side * -slope;
    group.add(panel);
  }
  const ridge = boxMesh(0.16, 0.14, depth + overhang * 2, mat, 0, y + rise + 0.02, z);
  group.add(ridge);
  return group;
}

export function createSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(0x2b3449) },
    midColor: { value: new THREE.Color(0x7d5360) },
    horizonColor: { value: new THREE.Color(0xd98854) },
    groundColor: { value: new THREE.Color(0x423c33) },
    sunColor: { value: new THREE.Color(0xffc17b) },
    sunDir: { value: new THREE.Vector3(-0.55, 0.24, -0.8).normalize() },
    night: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorld;
      void main(){
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor, midColor, horizonColor, groundColor, sunColor, sunDir;
      uniform float night;
      varying vec3 vWorld;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec3 dir = normalize(vWorld);
        float h = dir.y;
        float th = smoothstep(-0.03, 0.42, h);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.33, h));
        col = mix(col, topColor, smoothstep(0.26, 0.8, h));
        if (h < 0.0) col = mix(horizonColor, groundColor, smoothstep(0.0, -0.2, h));
        float glow = pow(max(dot(dir, sunDir), 0.0), 8.0);
        float core = pow(max(dot(dir, sunDir), 0.0), 180.0);
        col += sunColor * glow * (0.22 - night * 0.14);
        col += sunColor * core * (1.4 - night * 1.05);
        float band = sin((h + 0.1) * 22.0 + dir.x * 3.0) * 0.5 + 0.5;
        col += vec3(0.08, 0.04, 0.02) * band * smoothstep(0.0, 0.5, h) * (1.0 - night * 0.5);
        vec3 nightTop = vec3(0.012, 0.02, 0.04);
        col = mix(col, nightTop + vec3(0.03,0.045,0.07) * smoothstep(0.0,0.5,h), night * 0.72);
        float star = step(0.9975, hash(floor(dir.xz * 460.0 + dir.y * 150.0)));
        col += vec3(0.8, 0.85, 0.9) * star * night * smoothstep(0.08, 0.5, h) * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 24), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const sunTexCanvas = document.createElement("canvas");
  sunTexCanvas.width = sunTexCanvas.height = 128;
  const ctx = sunTexCanvas.getContext("2d");
  const grd = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,240,196,1)");
  grd.addColorStop(0.17, "rgba(255,196,112,.95)");
  grd.addColorStop(0.42, "rgba(255,146,74,.23)");
  grd.addColorStop(1, "rgba(255,120,50,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(sunTexCanvas);
  sunTex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
  }));
  sun.scale.set(26, 26, 1);
  sun.position.copy(uniforms.sunDir.value).multiplyScalar(128);
  scene.add(sun);

  return { sky, sun, uniforms };
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xc7d6dc, 0x333b28, 1.22);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffc794, 4.35);
  sun.position.set(-31, 29, 23);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 38;
  sun.shadow.camera.bottom = -38;
  sun.shadow.bias = -0.00045;
  sun.shadow.normalBias = 0.028;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0, 0);

  const rim = new THREE.DirectionalLight(0x91b3c9, 1.02);
  rim.position.set(30, 16, -28);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x876d5b, 0.25);
  fill.position.set(12, 6, 35);
  scene.add(fill);

  return { hemi, sun, rim, fill };
}

export function createGround(scene, mats) {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, 1, 1), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  group.add(ground);

  const patch = new THREE.Mesh(new THREE.PlaneGeometry(34, 28), mats.dirt);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(0, 0.02, 0.5);
  patch.receiveShadow = true;
  group.add(patch);

  const driveway = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 18), mats.dirt);
  driveway.rotation.x = -Math.PI / 2;
  driveway.position.set(0, 0.035, 3.4);
  driveway.material = mats.dirt.clone();
  driveway.material.opacity = 0.8;
  group.add(driveway);

  const roadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(39, 0, 72),
    new THREE.Vector3(30, 0, 53),
    new THREE.Vector3(17, 0, 33),
    new THREE.Vector3(6.5, 0, 20),
    new THREE.Vector3(1.2, 0, 13.2),
  ]);
  const road = makeRibbon(roadCurve, 6.2, 64);
  road.position.y = 0.025;
  road.receiveShadow = true;
  group.add(road);

  const rng = rngFactory(91);
  for (let i = 0; i < 18; i++) {
    const t = 0.06 + i * 0.051;
    const p = roadCurve.getPointAt(Math.min(t, 0.985));
    const tangent = roadCurve.getTangentAt(Math.min(t, 0.985));
    if (i % 2) continue;
    const dash = boxMesh(0.15, 0.012, 1.8, mats.roadLine, p.x + tangent.z * 0.04, 0.045, p.z - tangent.x * 0.04);
    dash.rotation.y = Math.atan2(tangent.x, tangent.z);
    dash.castShadow = false;
    group.add(dash);
  }

  for (let i = 0; i < 85; i++) {
    const angle = rng() * TAU;
    const dist = 14 + rng() * 44;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.08 + rng() * 0.32, 0),
      rng() > 0.55 ? mats.stone : mats.concrete
    );
    rock.position.set(Math.cos(angle) * dist, 0.05, Math.sin(angle) * dist);
    rock.scale.y = 0.4 + rng() * 0.5;
    rock.rotation.set(rng() * 2, rng() * TAU, rng() * 2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x6f7446,
    roughness: 1,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.4,
    flatShading: true,
  });
  const bladeGeo = makeGrassGeometry();
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, 700);
  grass.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 700; i++) {
    const a = rng() * TAU;
    const d = 13 + Math.pow(rng(), 0.68) * 44;
    dummy.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    dummy.rotation.y = rng() * TAU;
    const s = 0.5 + rng() * 1.15;
    dummy.scale.set(s, s * (0.7 + rng() * 0.8), s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  grass.instanceMatrix.needsUpdate = true;
  group.add(grass);

  scene.add(group);
  return { group, roadCurve };
}

function makeGrassGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI;
    const c = Math.cos(a) * 0.22;
    const s = Math.sin(a) * 0.22;
    const base = positions.length / 3;
    positions.push(-c, 0, -s, c, 0, s, c * 0.45, 1, s * 0.45);
    uvs.push(0, 0, 1, 0, 0.5, 1);
    indices.push(base, base + 1, base + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeRibbon(curve, width, segments) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(width / 2);
    positions.push(p.x + side.x, 0, p.z + side.z, p.x - side.x, 0, p.z - side.z);
    uvs.push(0, t * 10, 1, t * 10);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x393832, roughness: 0.97 }));
}

export function createHouse(mats) {
  const group = new THREE.Group();
  group.position.set(0, 0, -4.7);

  group.add(boxMesh(11.2, 0.55, 7.5, mats.stone, 0, 0.28, 0));
  group.add(boxMesh(10.6, 0.8, 6.9, mats.stone, 0, 0.94, 0));
  group.add(boxMesh(10.2, 4.0, 6.5, mats.siding, 0, 3.18, 0));

  const roof = pitchRoof(11.6, 7.8, 2.2, mats.roof, 5.15, 0, 0.52, 0.24);
  group.add(roof);

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-5.1, 0);
  gableShape.lineTo(5.1, 0);
  gableShape.lineTo(0, 2.18);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);
  const gableFront = new THREE.Mesh(gableGeo, mats.siding);
  gableFront.position.set(0, 5.18, 3.255);
  gableFront.castShadow = true;
  group.add(gableFront);
  const gableBack = gableFront.clone();
  gableBack.rotation.y = Math.PI;
  gableBack.position.z = -3.255;
  group.add(gableBack);

  const porchFloor = boxMesh(9.2, 0.22, 2.25, mats.woodLight, 0, 1.02, 4.35);
  group.add(porchFloor);
  const porchRoof = boxMesh(9.7, 0.18, 2.65, mats.roof, 0, 3.58, 4.4);
  porchRoof.rotation.x = 0.055;
  group.add(porchRoof);
  for (const x of [-4.25, -1.45, 1.45, 4.25]) {
    group.add(boxMesh(0.15, 2.5, 0.15, mats.woodDark, x, 2.35, 5.45));
  }
  for (let i = 0; i < 5; i++) {
    const step = boxMesh(3.3, 0.16, 0.35, mats.wood, 0, 0.15 + i * 0.17, 5.55 + i * 0.3);
    group.add(step);
  }
  for (const side of [-1, 1]) {
    const rail = boxMesh(0.12, 0.12, 2.15, mats.woodDark, side * 4.2, 2.0, 4.4);
    group.add(rail);
    for (let i = 0; i < 4; i++) {
      group.add(boxMesh(0.07, 0.95, 0.07, mats.woodDark, side * 4.2, 1.55, 3.5 + i * 0.62));
    }
  }

  const door = boxMesh(1.16, 2.28, 0.14, mats.woodDark, 0.4, 2.19, 3.28);
  group.add(door);
  group.add(boxMesh(0.12, 2.4, 0.2, mats.woodLight, -0.24, 2.19, 3.35));
  group.add(boxMesh(0.12, 2.4, 0.2, mats.woodLight, 1.04, 2.19, 3.35));
  group.add(boxMesh(1.45, 0.12, 0.2, mats.woodLight, 0.4, 3.36, 3.35));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mats.yellow);
  knob.position.set(0.83, 2.05, 3.4);
  group.add(knob);

  const windows = [
    { x: -3.25, y: 3.02, z: 3.28, w: 1.35, h: 1.55, lit: true },
    { x: 3.5, y: 3.02, z: 3.28, w: 1.35, h: 1.55, lit: false },
    { x: -3.25, y: 5.45, z: 3.33, w: 0.95, h: 1.05, lit: true },
    { x: 6.5, y: 3.0, z: 0.3, w: 0.15, h: 1.35, side: true, lit: true },
    { x: -6.5, y: 3.0, z: -1.2, w: 0.15, h: 1.2, side: true, lit: false },
  ];
  for (const win of windows) {
    if (win.side) {
      const pane = boxMesh(win.w, win.h, 0.9, win.lit ? mats.glass : mats.glassDark, win.x, win.y, win.z);
      group.add(pane);
      if (!win.lit) {
        group.add(boxMesh(win.w + 0.03, 0.12, 1.05, mats.woodDark, win.x, win.y + 0.1, win.z));
      }
      continue;
    }
    const frame = boxMesh(win.w + 0.2, win.h + 0.2, 0.08, mats.woodDark, win.x, win.y, win.z + 0.02);
    group.add(frame);
    const pane = boxMesh(win.w, win.h, 0.05, win.lit ? mats.glass : mats.glassDark, win.x, win.y, win.z + 0.08);
    group.add(pane);
    group.add(boxMesh(0.07, win.h, 0.03, mats.woodDark, win.x, win.y, win.z + 0.13));
    group.add(boxMesh(win.w, 0.07, 0.03, mats.woodDark, win.x, win.y, win.z + 0.13));
    if (!win.lit) {
      const board1 = boxMesh(win.w + 0.3, 0.18, 0.07, mats.wood, win.x, win.y + 0.4, win.z + 0.17);
      board1.rotation.z = 0.15;
      const board2 = boxMesh(win.w + 0.25, 0.16, 0.07, mats.wood, win.x - 0.05, win.y - 0.18, win.z + 0.17);
      board2.rotation.z = -0.23;
      group.add(board1, board2);
    }
  }

  const chimney = boxMesh(1.25, 4.5, 1.15, mats.stone, -3.0, 5.9, -1.45);
  group.add(chimney);
  group.add(boxMesh(1.5, 0.18, 1.4, mats.concrete, -3.0, 8.18, -1.45));

  const signMat = new THREE.MeshBasicMaterial({ map: mats.tex.sign, transparent: true, toneMapped: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.44), signMat);
  sign.position.set(0, 5.55, 3.36);
  group.add(sign);

  const porchLightMat = new THREE.MeshBasicMaterial({ color: 0xffb96a, toneMapped: false });
  for (const x of [-3.9, 3.9]) {
    group.add(boxMesh(0.18, 0.28, 0.18, mats.metalDark, x, 3.15, 5.28));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), porchLightMat);
    bulb.position.set(x, 3.0, 5.28);
    group.add(bulb);
  }

  const porchGlow = new THREE.PointLight(0xffa760, 5.5, 11, 2);
  porchGlow.position.set(0, 3.0, 5.2);
  group.add(porchGlow);

  const stringLightMat = new THREE.MeshBasicMaterial({ color: 0xffc27b, toneMapped: false });
  const stringPoints = [];
  for (let i = 0; i < 7; i++) {
    const x = -3.9 + i * 1.3;
    const y = 3.28 + Math.sin((i / 6) * Math.PI) * -0.18;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), stringLightMat);
    bulb.position.set(x, y, 5.58);
    group.add(bulb);
    stringPoints.push(new THREE.Vector3(x, y + 0.06, 5.58));
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(stringPoints), new THREE.LineBasicMaterial({ color: 0x1c1a15 })));

  const antenna = new THREE.Group();
  antenna.position.set(2.4, 7.0, -2.2);
  antenna.add(boxMesh(0.07, 2.0, 0.07, mats.metalDark, 0, 1, 0));
  for (let i = 0; i < 3; i++) {
    antenna.add(boxMesh(1.3 - i * 0.28, 0.05, 0.05, mats.metalDark, 0, 0.8 + i * 0.38, 0));
  }
  antenna.rotation.z = -0.08;
  group.add(antenna);

  for (let i = 0; i < 4; i++) {
    const bag = cylMesh(0.34, 0.38, 0.3, 7, mats.sandbag, -4.5 + (i % 2) * 0.7, 0.16 + Math.floor(i / 2) * 0.24, 5.9);
    bag.rotation.z = Math.PI / 2;
    group.add(bag);
  }

  const satellite = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, TAU, 0, Math.PI * 0.42), mats.metal);
  satellite.position.set(-4.4, 7.25, 1.9);
  satellite.rotation.x = -1.1;
  satellite.rotation.z = 0.4;
  satellite.castShadow = true;
  group.add(satellite);
  group.add(boxMesh(0.08, 1.6, 0.08, mats.metalDark, -4.4, 6.6, 2.0));

  const gutter = boxMesh(10.5, 0.11, 0.12, mats.metalDark, 0, 4.45, 3.62);
  group.add(gutter);

  return group;
}

export function createWatchtower(mats, small = false) {
  const group = new THREE.Group();
  const scale = small ? 0.8 : 1;
  const legSpread = small ? 0.85 : 0.95;
  const height = small ? 3.7 : 4.55;
  for (const x of [-legSpread, legSpread]) {
    for (const z of [-legSpread, legSpread]) {
      const leg = boxMesh(0.18, height + 0.3, 0.18, mats.woodDark, x, height / 2, z);
      group.add(leg);
    }
  }
  for (const y of [1.35, 2.7]) {
    const brace1 = boxMesh(0.08, 2.6, 0.08, mats.wood, 0, y, 0);
    brace1.rotation.z = Math.PI / 2;
    brace1.scale.x = 1.9;
    group.add(brace1);
    const brace2 = brace1.clone();
    brace2.rotation.y = Math.PI / 2;
    group.add(brace2);
  }
  for (const s of [-1, 1]) {
    const diag1 = boxMesh(0.07, 2.35, 0.07, mats.wood, s * legSpread * 0.45, 2.0, legSpread);
    diag1.rotation.z = s * 0.7;
    group.add(diag1);
    const diag2 = diag1.clone();
    diag2.position.z = -legSpread;
    group.add(diag2);
  }

  const platform = boxMesh(2.7, 0.2, 2.7, mats.woodLight, 0, height, 0);
  group.add(platform);
  for (const s of [-1, 1]) {
    group.add(boxMesh(2.9, 0.09, 0.09, mats.woodDark, 0, height + 0.95, s * 1.35));
    group.add(boxMesh(0.09, 0.09, 2.9, mats.woodDark, s * 1.35, height + 0.95, 0));
    for (let i = -1; i <= 1; i++) {
      group.add(boxMesh(0.06, 0.9, 0.06, mats.wood, i * 1.05, height + 0.48, s * 1.35));
      group.add(boxMesh(0.06, 0.9, 0.06, mats.wood, s * 1.35, height + 0.48, i * 1.05));
    }
  }
  const towerRoof = pitchRoof(3.5, 3.6, 0.72, mats.roof, height + 1.75, 0, 0.35, 0.16);
  group.add(towerRoof);

  for (let i = 0; i < 6; i++) {
    group.add(boxMesh(0.38, 0.06, 0.08, mats.wood, -1.0 + 0.0, 0.45 + i * 0.6, 0.98));
  }
  const ladderSide = new THREE.Group();
  ladderSide.position.set(0, 0, 1.0);
  for (const x of [-0.35, 0.35]) {
    const rail = boxMesh(0.05, 4.1, 0.05, mats.woodLight, x, 2.1, 0);
    ladderSide.add(rail);
  }
  for (let i = 0; i < 9; i++) {
    ladderSide.add(boxMesh(0.72, 0.05, 0.05, mats.woodLight, 0, 0.25 + i * 0.45, 0));
  }
  group.add(ladderSide);

  const lantern = boxMesh(0.24, 0.3, 0.24, mats.metalDark, 1.1, height + 0.95, -1.1);
  group.add(lantern);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffb15c, toneMapped: false }));
  glow.position.set(1.1, height + 0.87, -1.1);
  group.add(glow);
  const light = new THREE.PointLight(0xff9c4f, 5.5, 10, 2);
  light.position.set(1.1, height + 1.0, -1.1);
  group.add(light);

  for (let i = 0; i < 3; i++) {
    const bag = cylMesh(0.28, 0.32, 0.26, 7, mats.sandbag, -0.65 + (i % 2) * 0.55, height + 0.23 + Math.floor(i / 2) * 0.22, -1.0);
    bag.rotation.z = Math.PI / 2;
    group.add(bag);
  }
  group.scale.setScalar(scale);
  return group;
}

export function createGarden(mats) {
  const group = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    group.add(boxMesh(2.8, 0.18, 0.18, mats.woodLight, 0, 0.23, -1.3 + i * 0.86));
  }
  group.add(boxMesh(2.8, 0.2, 2.9, mats.soil, 0, 0.08, 0));
  for (const s of [-1, 1]) {
    group.add(boxMesh(0.18, 0.5, 2.9, mats.wood, s * 1.38, 0.25, 0));
  }
  const rng = rngFactory(45);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 4; i++) {
      const x = -0.95 + i * 0.63;
      const z = -0.88 + r * 0.88;
      const stem = cylMesh(0.025, 0.03, 0.55 + rng() * 0.28, 5, mats.crops, x, 0.36, z);
      group.add(stem);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + rng() * 0.09, 0), rng() > 0.35 ? mats.crops : mats.leaf);
      leaf.position.set(x, 0.58 + rng() * 0.22, z);
      leaf.scale.set(1.4, 0.6, 1.2);
      leaf.rotation.y = rng() * TAU;
      leaf.castShadow = true;
      group.add(leaf);
    }
  }
  const scarecrow = new THREE.Group();
  scarecrow.position.set(1.15, 0, 1.15);
  scarecrow.add(boxMesh(0.08, 1.8, 0.08, mats.woodDark, 0, 0.9, 0));
  scarecrow.add(boxMesh(1.05, 0.07, 0.07, mats.woodDark, 0, 1.48, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), mats.canvas);
  head.position.set(0, 1.82, 0);
  head.castShadow = true;
  scarecrow.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 7), mats.woodDark);
  hat.position.set(0, 2.02, 0);
  scarecrow.add(hat);
  group.add(scarecrow);
  return group;
}

export function createCampfire(mats) {
  const group = new THREE.Group();
  const rng = rngFactory(7);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + rng() * 0.1, 0), mats.stone);
    stone.position.set(Math.cos(a) * 0.64, 0.1, Math.sin(a) * 0.64);
    stone.scale.y = 0.7;
    stone.rotation.set(rng(), rng() * TAU, rng());
    stone.castShadow = true;
    group.add(stone);
  }
  for (let i = 0; i < 4; i++) {
    const log = cylMesh(0.11, 0.13, 1.25, 6, mats.woodDark, 0, 0.23, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 4) * Math.PI;
    log.rotation.x = 0.22;
    group.add(log);
  }
  const flameGroup = new THREE.Group();
  flameGroup.userData.dynamic = true;
  for (let i = 0; i < 4; i++) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22 - i * 0.035, 0.65 + i * 0.13, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: i < 2 ? 0xffc26a : 0xf06b2a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flame.position.set((rng() - 0.5) * 0.16, 0.45 + i * 0.13, (rng() - 0.5) * 0.16);
    flame.rotation.y = rng() * TAU;
    flameGroup.add(flame);
  }
  group.add(flameGroup);
  const light = new THREE.PointLight(0xff7434, 8.5, 15, 2);
  light.position.set(0, 1.0, 0);
  light.castShadow = false;
  group.add(light);

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext("2d");
  const glowGrad = gctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  glowGrad.addColorStop(0, "rgba(255,196,112,.9)");
  glowGrad.addColorStop(0.28, "rgba(255,128,48,.36)");
  glowGrad.addColorStop(1, "rgba(255,100,30,0)");
  gctx.fillStyle = glowGrad;
  gctx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xff8a45,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glowSprite.scale.set(4.2, 4.2, 1);
  glowSprite.position.set(0, 1.15, 0);
  group.add(glowSprite);

  for (const a of [0.2, 2.4, 4.5]) {
    const seat = cylMesh(0.19, 0.21, 1.5, 7, mats.woodDark, Math.cos(a) * 1.65, 0.21, Math.sin(a) * 1.65);
    seat.rotation.z = Math.PI / 2;
    seat.rotation.y = a + 0.5;
    group.add(seat);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.32, 8, 1, true), mats.metalDark);
  pot.position.set(0, 0.82, 0);
  group.add(pot);

  return { group, light, flameGroup };
}

function addFenceRun(group, mats, x1, z1, x2, z2, options = {}) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const n = Math.max(1, Math.round(length / 2.6));
  const dirX = dx / length;
  const dirZ = dz / length;
  const rng = rngFactory(Math.floor((x1 + 7) * 13 + (z1 + 9) * 31));

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    const post = boxMesh(0.18, 2.75 + rng() * 0.2, 0.18, mats.woodDark, px, 1.35, pz);
    post.rotation.z = (rng() - 0.5) * 0.03;
    group.add(post);
    if (i < n && options.metal !== false && rng() > 0.22) {
      const midX = px + dirX * 1.3;
      const midZ = pz + dirZ * 1.3;
      const panel = boxMesh(2.45, 1.75 + rng() * 0.25, 0.08, rng() > 0.45 ? mats.metal : mats.rust, midX, 1.36, midZ);
      panel.rotation.y = -Math.atan2(dz, dx) + (rng() - 0.5) * 0.02;
      group.add(panel);
      if (rng() > 0.55) {
        const brace = boxMesh(0.1, 1.5, 0.11, mats.wood, midX, 1.38, midZ + 0.12);
        brace.rotation.y = -Math.atan2(dz, dx);
        brace.rotation.z = 0.7;
        group.add(brace);
      }
    }
  }
  for (const h of [0.75, 1.9]) {
    const rail = boxMesh(0.09, 0.09, length, mats.wood, x1 + dx / 2, h, z1 + dz / 2);
    rail.rotation.y = angle;
    group.add(rail);
  }
  for (let i = 0; i < Math.floor(length / 2); i++) {
    if (rng() > 0.55) {
      const t = rng();
      group.add(boxMesh(0.55, 0.07, 0.07, mats.woodLight, x1 + dx * t, 0.35 + rng() * 1.8, z1 + dz * t));
    }
  }
  const wirePoints = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    wirePoints.push(new THREE.Vector3(x1 + dx * t, 2.86 + Math.sin(t * 9) * 0.03, z1 + dz * t));
  }
  const wireGeo = new THREE.BufferGeometry().setFromPoints(wirePoints);
  group.add(new THREE.Line(wireGeo, mats.wire));
}

export function createFence(mats) {
  const group = new THREE.Group();
  const x = 12.8;
  const zBack = -11.1;
  const zFront = 11.6;
  addFenceRun(group, mats, -x, zBack, x, zBack);
  addFenceRun(group, mats, -x, zBack, -x, zFront);
  addFenceRun(group, mats, x, zBack, x, zFront);
  addFenceRun(group, mats, -x, zFront, -2.5, zFront);
  addFenceRun(group, mats, 2.5, zFront, x, zFront);

  for (const s of [-1, 1]) {
    const gatePost = boxMesh(0.32, 3.4, 0.32, mats.woodDark, s * 2.55, 1.65, zFront);
    group.add(gatePost);
    const gate = new THREE.Group();
    gate.position.set(s * 2.4, 0, zFront);
    gate.rotation.y = s * 0.8;
    for (let i = 0; i < 3; i++) {
      gate.add(boxMesh(0.08, 2.7, 1.35, mats.wood, 0, 1.4, s * -0.2 - i * 0.03));
    }
    for (const h of [0.65, 1.7, 2.6]) {
      gate.add(boxMesh(0.09, 0.09, 2.1, mats.woodDark, 0, h, s * -0.65));
    }
    gate.add(boxMesh(0.12, 2.85, 0.1, mats.metal, 0, 1.45, s * -1.28));
    group.add(gate);
  }

  for (let i = 0; i < 4; i++) {
    const bag = cylMesh(0.33, 0.37, 0.32, 7, mats.sandbag, -3.25 + (i % 2) * 0.62, 0.16 + Math.floor(i / 2) * 0.27, 10.75);
    bag.rotation.z = Math.PI / 2;
    group.add(bag);
    const bag2 = bag.clone();
    bag2.position.x = 3.25 - (i % 2) * 0.62;
    group.add(bag2);
  }

  for (const s of [-1, 1]) {
    for (const zz of [-6, 2, 7]) {
      const stake = boxMesh(0.1, 0.9, 0.1, mats.woodDark, s * (x - 0.35), 0.45, zz);
      stake.rotation.z = s * 0.35;
      group.add(stake);
    }
  }

  const signPost = new THREE.Group();
  signPost.position.set(-4.8, 0, 11.7);
  signPost.add(boxMesh(0.13, 2.1, 0.13, mats.woodDark, 0, 1.05, 0));
  const signMat = new THREE.MeshBasicMaterial({ map: mats.tex.sign, transparent: true, toneMapped: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), signMat);
  sign.position.set(0, 1.75, 0.07);
  signPost.add(sign);
  signPost.add(boxMesh(2.55, 0.86, 0.06, mats.woodDark, 0, 1.75, 0));
  sign.renderOrder = 2;
  group.add(signPost);

  return group;
}

export function createTree(mats, rng, type = "pine") {
  const group = new THREE.Group();
  const h = 3.2 + rng() * 4.2;
  const lean = (rng() - 0.5) * 0.08;
  const trunk = cylMesh(0.16 + rng() * 0.13, 0.36 + rng() * 0.2, h, 6, mats.trunk, 0, h / 2, 0);
  trunk.rotation.z = lean;
  group.add(trunk);

  if (type === "pine") {
    const layers = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < layers; i++) {
      const r = (1.15 - i * 0.16) * (0.8 + rng() * 0.35);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, 1.2 + rng() * 0.5, 7),
        i > layers - 3 ? mats.leaf : mats.leafDark
      );
      cone.position.set((rng() - 0.5) * 0.25, h * 0.45 + i * (h * 0.135), (rng() - 0.5) * 0.25);
      cone.rotation.y = rng() * TAU;
      cone.rotation.z = (rng() - 0.5) * 0.12;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    }
  } else {
    const branches = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < branches; i++) {
      const a = rng() * TAU;
      const len = 1.2 + rng() * 2.2;
      const branch = cylMesh(0.045, 0.1, len, 5, mats.trunk, 0, 0, 0);
      branch.position.set(Math.cos(a) * len * 0.32, h * (0.45 + rng() * 0.46), Math.sin(a) * len * 0.32);
      branch.rotation.z = Math.PI / 2 - 0.25 - rng() * 0.4;
      branch.rotation.y = -a;
      group.add(branch);
      if (rng() > 0.55) {
        const twig = cylMesh(0.02, 0.045, len * 0.55, 4, mats.trunk, 0, 0, 0);
        twig.position.copy(branch.position);
        twig.position.x += Math.cos(a) * len * 0.35;
        twig.position.y += 0.3 + rng() * 0.5;
        twig.position.z += Math.sin(a) * len * 0.35;
        twig.rotation.z = Math.PI / 3;
        twig.rotation.y = -a + 0.5;
        group.add(twig);
      }
    }
  }
  return group;
}

export function createBush(mats, rng) {
  const group = new THREE.Group();
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + rng() * 0.4, 0), rng() > 0.2 ? mats.leafDark : mats.leafDry);
    leaf.position.set((rng() - 0.5) * 0.9, 0.2 + rng() * 0.35, (rng() - 0.5) * 0.9);
    leaf.scale.y = 0.55 + rng() * 0.4;
    leaf.rotation.set(rng(), rng(), rng());
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

const CHAR_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.96,
  flatShading: true,
});
const zombieGeometryCache = new Map();

function coloredGeometry(geometry, colorHex, matrix = null) {
  let geo = geometry.index ? geometry.toNonIndexed() : geometry;
  if (matrix) geo.applyMatrix4(matrix);
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  if (!geo.getAttribute("uv")) {
    const count = geo.getAttribute("position").count;
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  const count = geo.getAttribute("position").count;
  const color = new THREE.Color(colorHex);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function composeMatrix(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
}

function mergeColored(geometries) {
  let count = 0;
  for (const geo of geometries) count += geo.getAttribute("position").count;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const colors = new Float32Array(count * 3);
  let offset = 0;
  for (const geo of geometries) {
    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    const uv = geo.getAttribute("uv");
    const col = geo.getAttribute("color");
    positions.set(pos.array, offset * 3);
    normals.set(norm.array, offset * 3);
    uvs.set(uv.array, offset * 2);
    colors.set(col.array, offset * 3);
    offset += pos.count;
    geo.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  merged.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

function addColoredBox(list, w, h, d, color, matrix) {
  list.push(coloredGeometry(new THREE.BoxGeometry(w, h, d), color, matrix));
}

export function createHuman(options = {}) {
  const {
    shirt = 0x5c5e46,
    pants = 0x373a33,
    skin = 0x9b7357,
    cap = null,
    backpack = false,
    rifle = false,
    scale = 1,
  } = options;
  const group = new THREE.Group();

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.86, 0);
  const legParts = [];
  addColoredBox(legParts, 0.18, 0.78, 0.21, pants, composeMatrix(0, -0.4, 0));
  addColoredBox(legParts, 0.2, 0.14, 0.34, 0x24251f, composeMatrix(0, -0.79, 0.07));
  const legGeo = mergeColored(legParts);
  leftLeg.add(new THREE.Mesh(legGeo, CHAR_MAT));
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.86, 0);
  rightLeg.add(new THREE.Mesh(legGeo, CHAR_MAT));
  group.add(leftLeg, rightLeg);

  const bodyParts = [];
  addColoredBox(bodyParts, 0.62, 0.73, 0.33, shirt, composeMatrix(0, 1.34, 0));
  addColoredBox(bodyParts, 0.52, 0.12, 0.35, 0x4b4c3b, composeMatrix(0, 1.68, 0));
  bodyParts.push(coloredGeometry(new THREE.IcosahedronGeometry(0.19, 1), skin, composeMatrix(0, 1.89, 0.01, 0, 0, 0, 0.95, 1.08, 0.95)));
  if (cap) {
    bodyParts.push(coloredGeometry(new THREE.CylinderGeometry(0.2, 0.21, 0.13, 7), cap, composeMatrix(0, 2.04, 0)));
    addColoredBox(bodyParts, 0.28, 0.045, 0.18, cap, composeMatrix(0, 2.0, 0.2));
  } else {
    bodyParts.push(coloredGeometry(new THREE.IcosahedronGeometry(0.196, 1), 0x2b251d, composeMatrix(0, 1.95, -0.03, 0, 0, 0, 1, 0.55, 1)));
  }
  if (backpack) {
    addColoredBox(bodyParts, 0.45, 0.52, 0.22, 0x4c4432, composeMatrix(0, 1.34, -0.27));
    addColoredBox(bodyParts, 0.48, 0.07, 0.08, 0x2a2921, composeMatrix(0, 1.53, -0.36));
  }
  if (rifle) {
    addColoredBox(bodyParts, 0.06, 0.08, 1.15, 0x28271f, composeMatrix(0.32, 1.2, 0.45, 0.18, -0.2, -0.18));
    addColoredBox(bodyParts, 0.035, 0.035, 0.58, 0x36352a, composeMatrix(0.36, 1.22, 1.02, 0.18, -0.2, -0.18));
    addColoredBox(bodyParts, 0.12, 0.2, 0.16, 0x39352a, composeMatrix(0.31, 1.12, 0.23, 0.18, -0.2, -0.18));
  }
  const body = new THREE.Mesh(mergeColored(bodyParts), CHAR_MAT);
  group.add(body);

  const armParts = [];
  addColoredBox(armParts, 0.16, 0.6, 0.18, shirt, composeMatrix(0, -0.28, 0));
  addColoredBox(armParts, 0.14, 0.18, 0.14, skin, composeMatrix(0, -0.64, 0.01));
  const armGeo = mergeColored(armParts);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.39, 1.57, 0);
  leftArm.add(new THREE.Mesh(armGeo, CHAR_MAT));
  const rightArm = new THREE.Group();
  rightArm.position.set(0.39, 1.57, 0);
  rightArm.add(new THREE.Mesh(armGeo, CHAR_MAT));
  group.add(leftArm, rightArm);

  group.scale.setScalar(scale);
  group.userData.parts = { leftLeg, rightLeg, leftArm, rightArm, head: null, torso: body };
  return group;
}

export function createZombie(rng, variant = 0) {
  const variantKey = variant % 3;
  let geometry = zombieGeometryCache.get(variantKey);
  if (!geometry) {
    const skinTone = variantKey === 0 ? 0x6f765d : variantKey === 1 ? 0x77745f : 0x616952;
    const clothTone = variantKey === 0 ? 0x34382e : variantKey === 1 ? 0x4a4034 : 0x3b3d31;
    const parts = [];
    addColoredBox(parts, 0.16, 0.72, 0.18, 0x2d2f28, composeMatrix(-0.14, 0.41, 0.03));
    addColoredBox(parts, 0.16, 0.72, 0.18, 0x2d2f28, composeMatrix(0.14, 0.41, 0.03));
    addColoredBox(parts, 0.55, 0.67, 0.3, clothTone, composeMatrix(0, 1.28, 0, 0.26, 0, 0));
    parts.push(coloredGeometry(new THREE.IcosahedronGeometry(0.18, 1), skinTone, composeMatrix(0.02, 1.75, 0.13, 0.2, 0.2, 0.3, 0.9, 1.1, 0.9)));
    addColoredBox(parts, 0.035, 0.03, 0.02, 0x8f2f1e, composeMatrix(-0.05, 1.78, 0.29));
    addColoredBox(parts, 0.035, 0.03, 0.02, 0x8f2f1e, composeMatrix(0.09, 1.78, 0.29));
    addColoredBox(parts, 0.19, 0.16, 0.02, 0x5e2c24, composeMatrix(-0.1, 1.52, 0.17));
    const armTransforms = [
      composeMatrix(-0.36, 1.5, 0.03, -1.1, 0, 0),
      composeMatrix(0.36, 1.5, 0.03, -0.7, 0, 0.18),
    ];
    for (const base of armTransforms) {
      const sleeve = new THREE.Matrix4().multiplyMatrices(base, composeMatrix(0, -0.27, 0));
      const hand = new THREE.Matrix4().multiplyMatrices(base, composeMatrix(0, -0.62, 0));
      addColoredBox(parts, 0.14, 0.62, 0.15, clothTone, sleeve);
      addColoredBox(parts, 0.12, 0.16, 0.12, skinTone, hand);
    }
    geometry = mergeColored(parts);
    zombieGeometryCache.set(variantKey, geometry);
  }
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, CHAR_MAT);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.rotation.z = (rng() - 0.5) * 0.11;
  group.userData.baseTilt = group.rotation.z;
  group.userData.parts = null;
  return group;
}

export function createCar(mats, color = 0x5f3b2e) {
  const group = new THREE.Group();
  const bodyMat = standard(color, { roughness: 0.83, metalness: 0.2 });
  const body = boxMesh(1.95, 0.52, 4.15, bodyMat, 0, 0.58, 0);
  group.add(body);
  const cabin = boxMesh(1.72, 0.62, 1.95, bodyMat, 0, 1.12, -0.15);
  cabin.rotation.x = -0.02;
  group.add(cabin);
  const glass = boxMesh(1.56, 0.44, 1.8, mats.glassDark, 0, 1.15, -0.17);
  group.add(glass);
  const bed = boxMesh(1.72, 0.08, 1.35, mats.metalDark, 0, 0.86, 1.2);
  group.add(bed);
  for (const x of [-1.0, 1.0]) {
    for (const z of [-1.4, 1.3]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.24, 10), mats.tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.38, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }
  for (const x of [-0.62, 0.62]) {
    group.add(boxMesh(0.28, 0.16, 0.06, mats.yellow, x, 0.7, 2.09));
  }
  return group;
}

export function createBarrel(mats, color = 0x4c5a4d) {
  const group = new THREE.Group();
  const barrel = cylMesh(0.32, 0.32, 0.88, 9, standard(color, { roughness: 0.8, metalness: 0.25 }), 0, 0.44, 0);
  group.add(barrel);
  for (const y of [0.25, 0.64]) {
    group.add(cylMesh(0.34, 0.34, 0.06, 9, mats.metalDark, 0, y, 0));
  }
  return group;
}

export function createCrate(mats, s = 0.75) {
  const group = new THREE.Group();
  group.add(boxMesh(s, s * 0.8, s, mats.wood, 0, s * 0.4, 0));
  group.add(boxMesh(s * 0.9, 0.06, 0.06, mats.woodDark, 0, s * 0.78, s / 2 + 0.01));
  group.add(boxMesh(0.06, s * 0.72, 0.06, mats.woodDark, s / 2 - 0.08, s * 0.4, s / 2 + 0.01));
  return group;
}

export function createDistantTown(mats, scene) {
  const group = new THREE.Group();
  group.position.set(-10, 0, -61);
  group.scale.setScalar(0.82);
  const rng = rngFactory(500);
  const dark = standard(0x2f3030, { roughness: 1, flatShading: true });
  const dark2 = standard(0x3a3834, { roughness: 1, flatShading: true });
  const warm = new THREE.MeshBasicMaterial({ color: 0xd78b4d, toneMapped: false });

  for (let i = 0; i < 15; i++) {
    const w = 3 + rng() * 7;
    const h = 3 + rng() * 9;
    const d = 3 + rng() * 7;
    const x = -35 + rng() * 70;
    const z = -12 + rng() * 20;
    const b = boxMesh(w, h, d, rng() > 0.5 ? dark : dark2, x, h / 2, z);
    group.add(b);
    if (rng() > 0.35) {
      const roof = pitchRoof(w + 0.6, d + 0.4, 1.2 + rng() * 1.2, dark, h, z, 0.2, 0.18);
      roof.position.x = x;
      group.add(roof);
    }
    if (rng() > 0.5) {
      const window = boxMesh(0.6, 0.7, 0.04, warm, x + (rng() - 0.5) * w * 0.5, 1.5 + rng() * (h - 2), z + d / 2 + 0.02);
      group.add(window);
    }
  }

  const church = new THREE.Group();
  church.position.set(12, 0, -15);
  church.add(boxMesh(8, 6, 6, dark2, 0, 3, 0));
  church.add(boxMesh(3.2, 10, 3.2, dark, 0, 5, 3));
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.3, 6, 4), dark);
  spire.position.set(0, 12.9, 3);
  spire.rotation.y = Math.PI / 4;
  church.add(spire);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0x6f6b5d });
  church.add(boxMesh(0.13, 1.8, 0.13, crossMat, 0, 16.5, 3));
  church.add(boxMesh(0.9, 0.13, 0.13, crossMat, 0, 16.9, 3));
  group.add(church);

  const water = new THREE.Group();
  water.position.set(-29, 0, -11);
  for (const x of [-2, 2]) {
    for (const z of [-2, 2]) {
      water.add(boxMesh(0.3, 9, 0.3, mats.metalDark, x, 4.5, z));
    }
  }
  water.add(boxMesh(5, 0.25, 5, mats.metalDark, 0, 9, 0));
  water.add(cylMesh(3.4, 3.4, 4.4, 12, mats.metalDark, 0, 11.2, 0));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.1, 12), mats.metalDark);
  cone.position.y = 14.4;
  water.add(cone);
  group.add(water);

  scene.add(group);

  return { group, hills: null };
}

export function createBillboard(mats, scene) {
  const group = new THREE.Group();
  group.position.set(19.5, 0, 22);
  group.rotation.y = -0.65;
  for (const x of [-2.1, 2.1]) {
    group.add(boxMesh(0.22, 5.4, 0.22, mats.woodDark, x, 2.7, 0));
  }
  group.add(boxMesh(6.6, 3.1, 0.25, mats.woodDark, 0, 4.0, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(6.15, 2.7), new THREE.MeshStandardMaterial({
    map: mats.tex.billboard,
    roughness: 0.95,
    emissive: 0x17130d,
    emissiveIntensity: 0.2,
  }));
  face.position.set(0, 4.0, 0.14);
  group.add(face);
  for (const x of [-3.1, 3.1]) {
    const light = boxMesh(0.15, 0.18, 0.15, mats.metalDark, x, 5.4, 0.25);
    group.add(light);
  }
  group.rotation.z = -0.025;
  scene.add(group);
  return group;
}

export function createTelephonePoles(mats, scene, roadCurve) {
  const group = new THREE.Group();
  const poles = [];
  for (let i = 0; i < 6; i++) {
    const t = 0.1 + i * 0.13;
    const p = roadCurve.getPointAt(Math.min(t, 0.95));
    const tangent = roadCurve.getTangentAt(Math.min(t, 0.95));
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const pos = p.clone().addScaledVector(side, 5.8);
    const pole = new THREE.Group();
    pole.position.copy(pos);
    pole.add(boxMesh(0.18, 7.2, 0.18, mats.woodDark, 0, 3.6, 0));
    pole.add(boxMesh(2.1, 0.13, 0.13, mats.woodDark, 0, 6.7, 0));
    pole.rotation.y = Math.atan2(tangent.x, tangent.z);
    group.add(pole);
    poles.push(pos.clone().setY(6.65));
  }
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1b1d18, transparent: true, opacity: 0.55 });
  for (let i = 0; i < poles.length - 1; i++) {
    for (const offset of [-0.7, 0.7]) {
      const a = poles[i].clone();
      const b = poles[i + 1].clone();
      a.x += offset;
      b.x += offset;
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= 0.65;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const pts = curve.getPoints(15);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, wireMat));
    }
  }
  scene.add(group);
  return group;
}

export function createStructure(type, mats) {
  let group;
  switch (type) {
    case "barricade": {
      group = new THREE.Group();
      group.add(boxMesh(2.15, 0.42, 0.46, mats.sandbag, 0, 0.22, 0));
      group.add(boxMesh(2.1, 0.35, 0.4, mats.sandbag, 0, 0.56, 0));
      const topBag = boxMesh(1.2, 0.3, 0.42, mats.sandbag, 0.2, 0.88, 0);
      group.add(topBag);
      for (let i = 0; i < 4; i++) {
        const plank = boxMesh(0.22, 1.8, 0.09, mats.wood, -0.95 + i * 0.6, 0.65, 0.32);
        plank.rotation.z = (i % 2 ? -1 : 1) * 0.16;
        group.add(plank);
      }
      const brace = boxMesh(0.09, 2.2, 0.09, mats.woodDark, 0.7, 0.9, -0.2);
      brace.rotation.z = -0.5;
      group.add(brace);
      group.userData.defense = 8;
      break;
    }
    case "watchtower": {
      group = createWatchtower(mats, true);
      group.userData.defense = 18;
      break;
    }
    case "garden": {
      group = createGarden(mats);
      group.userData.food = 2;
      group.userData.defense = 0;
      break;
    }
    case "collector": {
      group = new THREE.Group();
      const base = boxMesh(1.7, 0.15, 1.7, mats.concrete, 0, 0.07, 0);
      group.add(base);
      for (const x of [-0.56, 0.56]) {
        for (const z of [-0.56, 0.56]) {
          group.add(boxMesh(0.12, 1.55, 0.12, mats.woodDark, x, 0.8, z));
        }
      }
      const roof = pitchRoof(2.1, 2.1, 0.55, mats.metal, 1.45, 0, 0.18, 0.08);
      roof.rotation.y = Math.PI / 2;
      group.add(roof);
      const barrel = createBarrel(mats, 0x415a5c);
      barrel.position.set(0.15, 0, 0.05);
      group.add(barrel);
      const pipe = cylMesh(0.06, 0.06, 1.2, 6, mats.metalDark, 0.3, 1.0, 0.65);
      pipe.rotation.x = 0.25;
      group.add(pipe);
      group.userData.food = 2;
      break;
    }
    case "turret": {
      group = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        const leg = boxMesh(0.09, 1.2, 0.09, mats.metalDark, Math.cos(a) * 0.35, 0.6, Math.sin(a) * 0.35);
        leg.rotation.z = Math.cos(a) * 0.28;
        leg.rotation.x = -Math.sin(a) * 0.28;
        group.add(leg);
      }
      group.add(boxMesh(0.65, 0.3, 0.65, mats.metalDark, 0, 1.25, 0));
      const gun = new THREE.Group();
      gun.position.set(0, 1.47, 0.05);
      gun.add(boxMesh(0.36, 0.27, 0.56, mats.metalDark, 0, 0, 0));
      gun.add(boxMesh(0.1, 0.1, 0.85, mats.metalDark, 0, 0.03, 0.6));
      gun.add(boxMesh(0.05, 0.24, 0.05, mats.metalDark, 0.2, 0.35, -0.05));
      group.add(gun);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), mats.emissiveRed);
      eye.position.set(0, 1.52, 0.36);
      group.add(eye);
      group.add(boxMesh(0.5, 0.04, 0.5, mats.metal, 0, 1.4, 0));
      group.userData.defense = 22;
      group.userData.turret = true;
      break;
    }
    case "clinic": {
      group = new THREE.Group();
      const tent = new THREE.Group();
      tent.position.y = 0.02;
      const roofL = boxMesh(2.25, 0.08, 2.6, mats.canvas, -0.55, 1.24, 0);
      roofL.rotation.z = 0.65;
      const roofR = boxMesh(2.25, 0.08, 2.6, mats.canvas, 0.55, 1.24, 0);
      roofR.rotation.z = -0.65;
      tent.add(roofL, roofR);
      tent.add(boxMesh(0.12, 1.8, 2.55, mats.canvas, 0, 0.9, 0));
      const back = boxMesh(2.2, 1.9, 0.12, mats.canvas, 0, 0.95, -1.25);
      tent.add(back);
      const crossMat = standard(0x9d3d2e, { roughness: 0.9 });
      tent.add(boxMesh(0.5, 0.16, 0.05, crossMat, 0, 1.05, 1.34));
      tent.add(boxMesh(0.16, 0.5, 0.05, crossMat, 0, 1.05, 1.34));
      group.add(tent);
      group.add(boxMesh(0.55, 0.08, 0.55, mats.woodDark, -1.1, 0.02, 1.0));
      group.userData.hp = 3;
      group.userData.morale = 4;
      break;
    }
    default: {
      group = new THREE.Group();
      group.add(boxMesh(1.5, 1.2, 1.5, mats.wood, 0, 0.6, 0));
    }
  }
  group.userData.type = type;
  return group;
}

export function createCampProps(mats) {
  const group = new THREE.Group();
  const generator = new THREE.Group();
  generator.position.set(-8.7, 0, 7.9);
  generator.add(boxMesh(1.25, 0.9, 0.72, mats.metalDark, 0, 0.5, 0));
  generator.add(boxMesh(1.1, 0.12, 0.66, mats.rust, 0, 1.02, 0));
  for (let i = 0; i < 4; i++) {
    generator.add(boxMesh(0.07, 0.42, 0.05, mats.metal, -0.45 + i * 0.25, 0.55, 0.38));
  }
  generator.add(boxMesh(0.2, 0.16, 0.16, mats.yellow, 0.42, 0.82, 0.4));
  group.add(generator);

  const barrelPositions = [[-10.6, 4.2, 0x4c5a4d], [-10.1, 5.0, 0x704934], [10.7, 2.1, 0x4c5a4d]];
  for (const [x, z, c] of barrelPositions) {
    const b = createBarrel(mats, c);
    b.position.set(x, 0, z);
    group.add(b);
  }
  const crates = [[6.2, 8.6], [6.9, 8.1], [-6.3, 9.3]];
  for (const [x, z] of crates) {
    const c = createCrate(mats, 0.8);
    c.position.set(x, 0, z);
    c.rotation.y = x * 0.7;
    group.add(c);
  }
  const tire1 = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.14, 6, 10), mats.tire);
  tire1.rotation.x = Math.PI / 2;
  tire1.position.set(5.5, 0.15, 9.5);
  tire1.castShadow = true;
  group.add(tire1);

  const table = new THREE.Group();
  table.position.set(-2.5, 0, 8.3);
  table.add(boxMesh(1.7, 0.1, 0.9, mats.woodLight, 0, 0.84, 0));
  for (const x of [-0.68, 0.68]) {
    for (const z of [-0.32, 0.32]) {
      table.add(boxMesh(0.08, 0.8, 0.08, mats.woodDark, x, 0.4, z));
    }
  }
  table.add(boxMesh(0.4, 0.18, 0.3, mats.metalDark, -0.3, 0.98, 0));
  table.add(cylMesh(0.12, 0.14, 0.12, 8, mats.metal, 0.32, 0.96, 0.1));
  group.add(table);

  return group;
}

export function createSmokeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(130,122,106,.62)");
  grd.addColorStop(0.45, "rgba(88,84,74,.28)");
  grd.addColorStop(1, "rgba(70,68,60,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createParticles(scene) {
  const smokeTexture = createSmokeTexture();
  const systems = [];

  function makeSmoke(origin, count, spread, size, speed, color = 0x9a9180) {
    const positions = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const data = [];
    for (let i = 0; i < count; i++) {
      const d = {
        x: origin.x + (Math.random() - 0.5) * spread,
        y: origin.y + Math.random() * 1.4,
        z: origin.z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 0.12,
        vy: speed * (0.5 + Math.random()),
        vz: (Math.random() - 0.5) * 0.12,
        age: Math.random() * 8,
        max: 6 + Math.random() * 6,
      };
      data.push(d);
      positions[i * 3] = d.x;
      positions[i * 3 + 1] = d.y;
      positions[i * 3 + 2] = d.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: smokeTexture,
      color,
      size,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    const sys = { points, positions, data, origin, spread, speed };
    systems.push(sys);
    return sys;
  }

  const chimney = makeSmoke(new THREE.Vector3(-3.0, 8.25, -6.15), 22, 2.2, 1.7, 0.62);
  const campfire = makeSmoke(new THREE.Vector3(4.3, 1.0, 2.8), 16, 0.9, 1.2, 0.55, 0x615e54);

  const ashCount = 220;
  const ashPositions = new Float32Array(ashCount * 3);
  const ashRng = rngFactory(808);
  for (let i = 0; i < ashCount; i++) {
    ashPositions[i * 3] = (ashRng() - 0.5) * 70;
    ashPositions[i * 3 + 1] = ashRng() * 22;
    ashPositions[i * 3 + 2] = (ashRng() - 0.5) * 70;
  }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute("position", new THREE.BufferAttribute(ashPositions, 3));
  const ashMat = new THREE.PointsMaterial({
    color: 0xd9b78a,
    size: 0.055,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ash = new THREE.Points(ashGeo, ashMat);
  ash.frustumCulled = false;
  scene.add(ash);
  systems.push({ ash, positions: ashPositions, kind: "ash" });

  return {
    systems,
    update(dt, t) {
      for (const sys of systems) {
        if (sys.ash) {
          const pos = sys.ash.geometry.attributes.position.array;
          for (let i = 0; i < ashCount; i++) {
            pos[i * 3] += Math.sin(t * 0.2 + i) * 0.002 + 0.005;
            pos[i * 3 + 1] -= 0.012 + (i % 5) * 0.002;
            pos[i * 3 + 2] += Math.cos(t * 0.17 + i * 1.7) * 0.002;
            if (pos[i * 3 + 1] < 0.1) {
              pos[i * 3 + 1] = 18 + Math.random() * 5;
              pos[i * 3] = (Math.random() - 0.5) * 70;
              pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
            }
          }
          sys.ash.geometry.attributes.position.needsUpdate = true;
          continue;
        }
        const arr = sys.positions;
        for (let i = 0; i < sys.data.length; i++) {
          const d = sys.data[i];
          d.age += dt;
          d.x += d.vx * dt + Math.sin(t * 0.3 + i) * 0.006;
          d.y += d.vy * dt;
          d.z += d.vz * dt + Math.cos(t * 0.25 + i) * 0.005;
          if (d.age > d.max) {
            d.age = 0;
            d.x = sys.origin.x + (Math.random() - 0.5) * sys.spread;
            d.y = sys.origin.y + Math.random() * 0.3;
            d.z = sys.origin.z + (Math.random() - 0.5) * sys.spread;
          }
          arr[i * 3] = d.x;
          arr[i * 3 + 1] = d.y;
          arr[i * 3 + 2] = d.z;
        }
        sys.points.geometry.attributes.position.needsUpdate = true;
      }
    },
  };
}

export function createBuildGrid(scene) {
  const group = new THREE.Group();
  const bounds = { minX: -9.9, maxX: 9.9, minZ: -8.8, maxZ: 8.8, cell: 2.2 };
  const points = [];
  for (let x = bounds.minX; x <= bounds.maxX + 0.01; x += bounds.cell) {
    points.push(new THREE.Vector3(x, 0.07, bounds.minZ), new THREE.Vector3(x, 0.07, bounds.maxZ));
  }
  for (let z = bounds.minZ; z <= bounds.maxZ + 0.01; z += bounds.cell) {
    points.push(new THREE.Vector3(bounds.minX, 0.07, z), new THREE.Vector3(bounds.maxX, 0.07, z));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd4a45e, transparent: true, opacity: 0.2 }));
  lines.renderOrder = 2;
  group.add(lines);

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
    new THREE.MeshBasicMaterial({ color: 0xc7924c, transparent: true, opacity: 0.025, depthWrite: false })
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(0, 0.06, 0);
  group.add(fill);

  const corners = [];
  const { minX, maxX, minZ, maxZ } = bounds;
  const c = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  for (let i = 0; i < 4; i++) {
    corners.push(new THREE.Vector3(c[i][0], 0.09, c[i][1]), new THREE.Vector3(c[(i + 1) % 4][0], 0.09, c[(i + 1) % 4][1]));
  }
  const border = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(corners),
    new THREE.LineBasicMaterial({ color: 0xf1c47c, transparent: true, opacity: 0.65 })
  );
  group.add(border);

  const hover = new THREE.Mesh(
    new THREE.BoxGeometry(bounds.cell - 0.13, 0.06, bounds.cell - 0.13),
    new THREE.MeshBasicMaterial({ color: 0x8fca6f, transparent: true, opacity: 0.28, depthWrite: false })
  );
  hover.position.y = 0.08;
  hover.visible = false;
  group.add(hover);

  const hoverBorder = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(bounds.cell - 0.12, 0.1, bounds.cell - 0.12)),
    new THREE.LineBasicMaterial({ color: 0xb6dc8d, transparent: true, opacity: 0.9 })
  );
  hoverBorder.visible = false;
  group.add(hoverBorder);

  group.visible = false;
  scene.add(group);
  return { group, lines, hover, hoverBorder, bounds };
}
