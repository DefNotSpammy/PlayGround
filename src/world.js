import * as THREE from 'three';
import {
  clamp, lerp, smoothstep, fbm, noise2, rand, randInt, choice, dist2,
  canvasTexture, makeDirtTexture, makeWoodTexture, makeStoneTexture, makeRoofTexture,
  makeStripeTexture, makeGlowTexture, makeSmokeTexture, makeBannerTexture, speckle,
} from './utils.js';

const WATER_LEVEL = 1.16;
const SPAWN = { x: 2, z: 21 };
const VILLAGE = { x: 15.5, z: -16 };

const GRASS_DARK = new THREE.Color(0x4f733d);
const GRASS_MID = new THREE.Color(0x6e964d);
const GRASS_LIGHT = new THREE.Color(0x88aa5e);
const SAND = new THREE.Color(0xa99a6d);
const ROCK = new THREE.Color(0x7e7c6f);
const ROCK_HIGH = new THREE.Color(0xb9b8ad);

let shared = null;
function getShared() {
  if (!shared) {
    shared = {
      wood: makeWoodTexture(),
      stone: makeStoneTexture(),
      dirt: makeDirtTexture(),
      roofRed: makeRoofTexture('#93402f', '#68291e', '#b25b44'),
      roofBlue: makeRoofTexture('#3d526d', '#263649', '#5a7491'),
      stripe: makeStripeTexture('#8d2f2f', '#e9dcbc'),
      glow: makeGlowTexture(),
      smoke: makeSmokeTexture(),
      banner: makeBannerTexture(),
      grassDetail: canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#cdd2c3'; ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, 1800, ['#b8c0ad', '#d9ddce', '#aeb8a2', '#e3e6d9'], 0.4, 1.8);
        for (let i = 0; i < 500; i++) {
          ctx.strokeStyle = choice(['rgba(110,122,98,.35)', 'rgba(235,238,225,.4)']);
          ctx.lineWidth = rand(0.4, 1);
          const x = rand(0, w), y = rand(0, h);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand(-1, 1), y - rand(2, 5)); ctx.stroke();
        }
      }, { repeat: [26, 26] }),
    };
  }
  return shared;
}

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.shared = getShared();
    this.colliders = [];
    this.trees = [];
    this.rocks = [];
    this.buildings = [];
    this.mapTrees = [];
    this.mapBuildings = [];
    this.mapPaths = [];
    this.interactables = [];
    this.npcSpots = [];
    this.goblinSpots = [];
    this.smokeEmitters = [];
    this.flags = [];
    this.clouds = [];
    this.water = null;
    this.fire = null;
    this.runeOrb = null;
    this.runeLight = null;
    this.time = 0;

    this.buildSky();
    this.buildMountains();
    this.buildTerrain();
    this.buildPaths();
    this.buildGroundCover();
    this.buildWater();
    this.buildVillage();
    this.buildCastle();
    this.buildStoneCircle();
    this.buildForest();
    this.buildScatter();
    this.buildAtmosphere();
    this.defineActors();
  }

  heightAt(x, z) {
    let h = 2.55 + (fbm(x * 0.021 + 7.3, z * 0.021 - 3.1, 4) - 0.5) * 3.6;
    h += (fbm(x * 0.072 - 2, z * 0.072 + 5, 3) - 0.5) * 0.9;

    const center = smoothstep(36, 3, Math.hypot(x, z));
    h = lerp(h, 2.72, center * 0.52);

    const village = smoothstep(15, 2, dist2(x, z, VILLAGE.x, VILLAGE.z));
    h = lerp(h, 3.05, village * 0.86);

    const spawn = smoothstep(7, 1.5, dist2(x, z, SPAWN.x, SPAWN.z));
    h = lerp(h, 3.16, spawn * 0.8);

    const lake = smoothstep(18.5, 2.5, dist2(x, z, 31, -25));
    h = lerp(h, -1.7, lake * 0.96);

    const castle = smoothstep(26, 5, dist2(x, z, -38, -43));
    h += castle * 5.6;

    const stone = smoothstep(13, 2, dist2(x, z, -23, -21));
    h += stone * 1.7;

    const d = Math.hypot(x, z);
    h += smoothstep(70, 120, d) * 26;
    h += smoothstep(72, 112, d) * (fbm(x * 0.05, z * 0.05, 2) - 0.3) * 14;

    return h;
  }

  isWater(x, z) {
    return this.heightAt(x, z) < WATER_LEVEL - 0.05;
  }

  addCollider(x, z, r) { this.colliders.push({ x, z, r }); }

  buildSky() {
    const skyGeo = new THREE.SphereGeometry(420, 32, 18);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x5c94c8) },
        midColor: { value: new THREE.Color(0x9fc6dc) },
        horizonColor: { value: new THREE.Color(0xf3d8ac) },
        lowColor: { value: new THREE.Color(0xd7c9a8) },
        sunColor: { value: new THREE.Color(0xfff0c8) },
        sunDir: { value: new THREE.Vector3(-0.42, 0.3, -0.86).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 topColor, midColor, horizonColor, lowColor, sunColor, sunDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
          col = mix(col, topColor, smoothstep(0.22, 0.78, max(h, 0.0)));
          col = mix(lowColor, col, smoothstep(-0.16, 0.02, h));
          float sd = max(dot(d, sunDir), 0.0);
          float disc = pow(sd, 2200.0);
          float halo = pow(sd, 38.0) * 0.55;
          float wide = pow(sd, 7.0) * 0.18;
          col += sunColor * (disc * 3.4 + halo + wide);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getShared().glow, color: 0xffe2a0, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, opacity: 0.55,
    }));
    glow.position.copy(new THREE.Vector3(-0.42, 0.3, -0.86).normalize().multiplyScalar(330));
    glow.scale.set(85, 85, 1);
    this.scene.add(glow);
    this.sunGlow = glow;

    for (let i = 0; i < 13; i++) {
      const cloud = new THREE.Group();
      const puffs = randInt(4, 7);
      for (let p = 0; p < puffs; p++) {
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(rand(0.09, 0.12), rand(0.1, 0.24), rand(0.78, 0.92)),
          transparent: true, opacity: rand(0.22, 0.46), depthWrite: false, fog: false,
        });
        const geo = new THREE.SphereGeometry(rand(2.2, 4.4), 8, 6);
        const puff = new THREE.Mesh(geo, mat);
        puff.position.set(rand(-6, 6), rand(-0.8, 0.8), rand(-2.5, 2.5));
        puff.scale.y = rand(0.42, 0.68);
        puff.scale.x = rand(0.85, 1.5);
        cloud.add(puff);
      }
      const a = (i / 13) * Math.PI * 2 + rand(-0.2, 0.2);
      const radius = rand(85, 260);
      cloud.position.set(Math.cos(a) * radius, rand(44, 78), Math.sin(a) * radius);
      cloud.userData.speed = rand(0.25, 0.75);
      cloud.userData.start = cloud.position.x;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  buildMountains() {
    const group = new THREE.Group();
    for (let i = 0; i < 23; i++) {
      const a = (i / 23) * Math.PI * 2 + rand(-0.06, 0.06);
      const radius = rand(92, 142);
      const height = rand(26, 58);
      const baseRadius = rand(24, 46);
      const geo = new THREE.ConeGeometry(baseRadius, height, randInt(6, 9), 4, false);
      const pos = geo.attributes.position;
      const colors = [];
      const low = new THREE.Color(0x445c46), mid = new THREE.Color(0x70766b), high = new THREE.Color(0xc4ccc9);
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v);
        const yn = clamp((y + height / 2) / height, 0, 1);
        if (yn < 0.98) {
          pos.setX(v, pos.getX(v) * rand(0.86, 1.16));
          pos.setZ(v, pos.getZ(v) * rand(0.86, 1.16));
        }
        const c = yn < 0.46 ? low.clone().lerp(mid, yn / 0.46) : mid.clone().lerp(high, (yn - 0.46) / 0.54);
        c.offsetHSL(rand(-0.01, 0.01), 0, rand(-0.04, 0.04));
        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, metalness: 0, flatShading: true });
      const mesh = new THREE.Mesh(geo, mat);
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      mesh.position.set(x, height / 2 + this.heightAt(x, z) * 0.4 - 4, z);
      mesh.rotation.y = rand(0, Math.PI);
      group.add(mesh);
    }

    const haze = new THREE.Mesh(
      new THREE.RingGeometry(70, 300, 64),
      new THREE.MeshBasicMaterial({ color: 0xd5d9c4, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false })
    );
    haze.rotation.x = -Math.PI / 2;
    haze.position.y = 2;
    group.add(haze);
    this.scene.add(group);
  }

  buildTerrain() {
    const size = 280;
    const segments = 172;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.15 + 40, z * 0.15 - 22, 2);
      if (h < WATER_LEVEL + 0.38) {
        c.copy(SAND).lerp(new THREE.Color(0x7c8d60), smoothstep(WATER_LEVEL + 0.38, WATER_LEVEL - 0.5, h) * 0.35);
      } else if (h > 11) {
        c.copy(ROCK).lerp(ROCK_HIGH, clamp((h - 11) / 12, 0, 1));
      } else {
        c.copy(GRASS_DARK).lerp(GRASS_MID, smoothstep(0.2, 0.6, n));
        c.lerp(GRASS_LIGHT, smoothstep(0.6, 0.9, n) * 0.55);
        c.offsetHSL(rand(-0.012, 0.012), rand(-0.03, 0.03), rand(-0.025, 0.025));
        if (h > 7.5) c.lerp(ROCK, smoothstep(7.5, 11, h) * 0.7);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: getShared().grassDetail,
      vertexColors: true,
      roughness: 0.98,
      metalness: 0,
    });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  makePath(points, width = 2.6) {
    this.mapPaths.push(points.map(p => ({ x: p[0], z: p[1] })));
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.18);
    const samples = 150;
    const positions = [], uvs = [], indices = [];
    const length = curve.getLength();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const side = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
      const wobble = (noise2(p.x * 0.5, p.z * 0.5) - 0.5) * 0.55;
      const w = width * 0.5 + wobble;
      for (const s of [-1, 1]) {
        const x = p.x + side.x * w * s;
        const z = p.z + side.z * w * s;
        const y = this.heightAt(x, z) + 0.06;
        positions.push(x, y, z);
      }
      uvs.push(0, t * length * 0.16, 1, t * length * 0.16);
      if (i < samples) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const tex = getShared().dirt.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  buildPaths() {
    this.makePath([[2, 30], [2, 22], [2.5, 14], [1.5, 7], [4, 0], [8.5, -7], [12, -12], [15, -16], [19, -20], [24, -22]], 2.8);
    this.makePath([[15, -16], [10, -18], [4, -20], [-3, -22], [-11, -25], [-20, -29], [-27, -34], [-33, -39], [-37, -42]], 2.3);
    this.makePath([[2.5, 12], [-3, 9], [-8, 5], [-13, 0], [-18, -7], [-20, -14], [-23, -21]], 2.1);
    this.makePath([[15, -16], [16, -21], [18, -26], [20, -30]], 1.9);
  }


  distanceToPaths(x, z) {
    let best = Infinity;
    for (const path of this.mapPaths) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = dx * dx + dz * dz;
        let t = len ? ((x - a.x) * dx + (z - a.z) * dz) / len : 0;
        t = clamp(t, 0, 1);
        const px = a.x + dx * t, pz = a.z + dz * t;
        best = Math.min(best, Math.hypot(x - px, z - pz));
      }
    }
    return best;
  }

  buildGroundCover() {
    const bladeGeo = new THREE.ConeGeometry(0.035, 0.55, 3, 1, false);
    bladeGeo.translate(0, 0.27, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x8aa562, roughness: 0.98, envMapIntensity: 0.25, side: THREE.DoubleSide });
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, 5200);
    blades.receiveShadow = false;
    blades.castShadow = false;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let count = 0;
    for (let i = 0; i < 15000 && count < 5200; i++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand()) * 58;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 5;
      if (this.heightAt(x, z) < WATER_LEVEL + 0.25) continue;
      if (this.distanceToPaths(x, z) < 1.8) continue;
      if (dist2(x, z, VILLAGE.x, VILLAGE.z) < 5) continue;
      let blocked = false;
      for (const c of this.colliders) if (dist2(x, z, c.x, c.z) < c.r * 0.8) { blocked = true; break; }
      if (blocked) continue;
      dummy.position.set(x, this.heightAt(x, z) - 0.04, z);
      dummy.rotation.set(rand(-0.12, 0.12), rand(0, Math.PI * 2), rand(-0.14, 0.14));
      const s = rand(0.55, 1.5);
      dummy.scale.set(s, s * rand(0.8, 1.4), s);
      dummy.updateMatrix();
      blades.setMatrixAt(count, dummy.matrix);
      color.setHSL(rand(0.21, 0.29), rand(0.3, 0.48), rand(0.3, 0.46));
      blades.setColorAt(count, color);
      count++;
    }
    blades.count = count;
    blades.instanceMatrix.needsUpdate = true;
    if (blades.instanceColor) blades.instanceColor.needsUpdate = true;
    this.scene.add(blades);
    this.grass = blades;

    const flowerGeo = new THREE.IcosahedronGeometry(0.055, 0);
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 900);
    const palette = [0xe8e0c8, 0xe2c45c, 0xc96a86, 0x9d86d6, 0xd98352, 0xf2edda];
    let fcount = 0;
    for (let i = 0; i < 5000 && fcount < 900; i++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand()) * 42;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 6;
      const h = this.heightAt(x, z);
      if (h < WATER_LEVEL + 0.4 || h > 8) continue;
      if (this.distanceToPaths(x, z) < 2.3) continue;
      dummy.position.set(x, h + rand(0.12, 0.26), z);
      dummy.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
      const s = rand(0.6, 1.35);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      flowers.setMatrixAt(fcount, dummy.matrix);
      flowers.setColorAt(fcount, color.setHex(choice(palette)));
      fcount++;
    }
    flowers.count = fcount;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    this.scene.add(flowers);
    this.flowers = flowers;

    const bushGeo = new THREE.IcosahedronGeometry(0.65, 1);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x517b3b, roughness: 0.97, flatShading: true });
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, 120);
    let bcount = 0;
    for (let i = 0; i < 1200 && bcount < 120; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(16, 56);
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 6;
      if (this.heightAt(x, z) < WATER_LEVEL + 0.4) continue;
      if (this.distanceToPaths(x, z) < 3) continue;
      if (dist2(x, z, VILLAGE.x, VILLAGE.z) < 10) continue;
      let blocked = false;
      for (const c of this.colliders) if (dist2(x, z, c.x, c.z) < c.r + 0.8) { blocked = true; break; }
      if (blocked) continue;
      dummy.position.set(x, this.heightAt(x, z) + 0.3, z);
      dummy.rotation.set(0, rand(0, Math.PI * 2), 0);
      dummy.scale.set(rand(0.7, 1.4), rand(0.5, 0.9), rand(0.7, 1.4));
      dummy.updateMatrix();
      bushes.setMatrixAt(bcount, dummy.matrix);
      bcount++;
    }
    bushes.count = bcount;
    bushes.instanceMatrix.needsUpdate = true;
    this.scene.add(bushes);
    this.bushes = bushes;
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(58, 48, 48, 40);
    geo.rotateX(-Math.PI / 2);
    const normal = canvasTexture(256, 256, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const vx = Math.sin(x * 0.16 + y * 0.09) + Math.sin(x * 0.06 - y * 0.21) * 0.7;
          const vy = Math.cos(x * 0.12 - y * 0.14) + Math.cos(x * 0.19 + y * 0.05) * 0.6;
          const i = (y * w + x) * 4;
          img.data[i] = 128 + vx * 14;
          img.data[i + 1] = 128 + vy * 14;
          img.data[i + 2] = 255;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, { srgb: false, repeat: [5, 4] });
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x2f7b78,
      map: null,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.16,
      metalness: 0.15,
      transparent: true,
      opacity: 0.83,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.set(31, WATER_LEVEL, -25);
    water.receiveShadow = true;
    this.scene.add(water);
    this.water = water;
    this.waterNormal = normal;

    const glint = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 9),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glint.rotation.x = -Math.PI / 2;
    glint.position.set(36, WATER_LEVEL + 0.03, -28);
    this.scene.add(glint);
    this.waterGlint = glint;
  }

  addBuildingBox(x, z, w, d, rot) {
    this.mapBuildings.push({ x, z, w, d, rot });
    const r = Math.max(w, d) * 0.5;
    this.addCollider(x, z, r * 0.72);
  }

  createHouse(x, z, rot, { w = 5.2, d = 4.4, h = 2.8, stone = false, roof = null } = {}) {
    const group = new THREE.Group();
    const y = this.heightAt(x, z);
    group.position.set(x, y, z);
    group.rotation.y = rot;
    const wood = getShared().wood;
    const wallMat = new THREE.MeshStandardMaterial({ color: stone ? 0x9b978a : 0xd8c8a6, roughness: 0.95, map: stone ? getShared().stone : null });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.95, map: wood });
    const roofMat = new THREE.MeshStandardMaterial({ map: roof || getShared().roofRed, roughness: 0.9 });

    const foundation = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), new THREE.MeshStandardMaterial({ color: 0x79786c, roughness: 1, map: getShared().stone }));
    foundation.position.y = 0.25;
    foundation.castShadow = foundation.receiveShadow = true;
    group.add(foundation);

    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.y = 0.5 + h / 2;
    walls.castShadow = walls.receiveShadow = true;
    group.add(walls);

    const beamGeoV = new THREE.BoxGeometry(0.2, h, 0.16);
    const beamGeoH = new THREE.BoxGeometry(w + 0.06, 0.18, 0.14);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const beam = new THREE.Mesh(beamGeoV, beamMat);
        beam.position.set(sx * (w / 2 - 0.1), 0.5 + h / 2, sz * (d / 2 + 0.01));
        group.add(beam);
      }
      const horizontal = new THREE.Mesh(beamGeoH, beamMat);
      horizontal.position.set(0, 0.5 + h * 0.62, sx * (d / 2 + 0.02));
      group.add(horizontal);
      const low = new THREE.Mesh(beamGeoH, beamMat);
      low.position.set(0, 0.55, sx * (d / 2 + 0.02));
      group.add(low);
    }
    const sideBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.14), beamMat);
    sideBeam.position.set(w / 2 + 0.01, 0.5 + h / 2, 0);
    group.add(sideBeam);
    const sideBeam2 = sideBeam.clone(); sideBeam2.position.x = -w / 2 - 0.01; group.add(sideBeam2);

    const frontX = new THREE.Mesh(new THREE.BoxGeometry(w * 0.44, 0.18, 0.14), beamMat);
    frontX.position.set(0, 0.5 + h * 0.32, d / 2 + 0.02);
    group.add(frontX);
    for (const sx of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.15, h * 0.5, 0.14), beamMat);
      brace.position.set(sx * w * 0.27, 0.5 + h * 0.45, d / 2 + 0.02);
      brace.rotation.z = sx * 0.5;
      group.add(brace);
    }

    const rise = w * 0.4;
    const roofTop = 0.5 + h;
    for (const side of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w / 2 + 0.55, 0.18, d + 0.9), roofMat);
      slab.position.set(side * w / 4, roofTop + rise / 2, 0);
      slab.rotation.z = side * -Math.atan2(rise, w / 2);
      slab.castShadow = slab.receiveShadow = true;
      group.add(slab);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, d + 1), new THREE.MeshStandardMaterial({ color: 0x4b3021, roughness: 0.9 }));
    ridge.position.set(0, roofTop + rise + 0.02, 0);
    group.add(ridge);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-w / 2, 0); gableShape.lineTo(w / 2, 0); gableShape.lineTo(0, rise); gableShape.closePath();
    const gableGeo = new THREE.ShapeGeometry(gableShape);
    for (const sz of [-1, 1]) {
      const gable = new THREE.Mesh(gableGeo, wallMat);
      gable.position.set(0, roofTop, sz * (d / 2 + 0.02));
      if (sz < 0) gable.rotation.y = Math.PI;
      group.add(gable);
    }

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.7, 0.55), new THREE.MeshStandardMaterial({ color: 0x777166, roughness: 1, map: getShared().stone }));
    chimney.position.set(-w * 0.24, roofTop + rise * 0.7, -d * 0.16);
    group.add(chimney);
    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x5e5b53 }));
    chimneyCap.position.set(-w * 0.24, roofTop + rise * 0.7 + 0.88, -d * 0.16);
    group.add(chimneyCap);
    this.smokeEmitters.push({ x, z, y: y + roofTop + rise * 0.7 + 1.1, rate: 0.34, spread: 0.25 });

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x573a24, roughness: 0.92, map: wood });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.75, 0.12), doorMat);
    door.position.set(0.1, 0.5 + 0.87, d / 2 + 0.07);
    door.castShadow = true;
    group.add(door);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, 0.15), beamMat);
    lintel.position.set(0.1, 2.23, d / 2 + 0.09);
    group.add(lintel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd1a951, metalness: 0.8, roughness: 0.3 }));
    knob.position.set(0.42, 1.34, d / 2 + 0.15);
    group.add(knob);

    const windowMat = new THREE.MeshStandardMaterial({ color: 0x3d2e1d, emissive: 0xffb35e, emissiveIntensity: 0.35, roughness: 0.4, map: null });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4b3322, roughness: 0.9 });
    const windows = [
      [-w * 0.32, 1.85, d / 2 + 0.06, 0],
      [w * 0.55, 1.85, d / 2 + 0.06, 0],
      [w / 2 + 0.06, 1.85, d * 0.2, Math.PI / 2],
    ];
    for (const [wx, wy, wz, ry] of windows) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.72), windowMat);
      win.position.set(wx, wy, wz);
      win.rotation.y = ry;
      group.add(win);
      const wf = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.08), frameMat);
      wf.position.set(wx, wy + 0.38, wz + 0.01); wf.rotation.y = ry; group.add(wf);
      const wf2 = wf.clone(); wf2.position.y = wy - 0.38; group.add(wf2);
      const wf3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), frameMat);
      wf3.position.set(wx - 0.34, wy, wz + 0.01); wf3.rotation.y = ry; group.add(wf3);
      const wf4 = wf3.clone(); wf4.position.x = wx + 0.34; group.add(wf4);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.03), frameMat);
      cross.position.set(wx, wy, wz + 0.015); cross.rotation.y = ry; group.add(cross);
    }

    const boxMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1, map: wood });
    const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.24), boxMat);
    flowerBox.position.set(-w * 0.32, 1.42, d / 2 + 0.18);
    group.add(flowerBox);
    for (let i = 0; i < 5; i++) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), new THREE.MeshStandardMaterial({ color: choice([0xd85f6e, 0xe3c256, 0xe9e1cc, 0x9b79d8]), roughness: 0.8 }));
      flower.position.set(-w * 0.32 + rand(-0.3, 0.3), 1.56, d / 2 + 0.2 + rand(-0.04, 0.04));
      group.add(flower);
    }

    this.scene.add(group);
    this.addBuildingBox(x, z, w + 0.6, d + 0.6, rot);
    return group;
  }

  createMarket(x, z, rot) {
    const y = this.heightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rot;
    const wood = getShared().wood;
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 1, map: wood });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 7), postMat);
        post.position.set(sx * 1.45, 1.2, sz * 0.95);
        post.castShadow = true;
        group.add(post);
      }
    }
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.17, 1.15), new THREE.MeshStandardMaterial({ color: 0x6d4b2d, roughness: 0.95, map: wood }));
    counter.position.set(0, 0.95, 0.45);
    counter.castShadow = true;
    group.add(counter);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.95, 0.13), postMat);
      leg.position.set(sx * 1.4, 0.47, 0.95);
      group.add(leg);
    }
    const canopyMat = new THREE.MeshStandardMaterial({ map: getShared().stripe, roughness: 0.85, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.07, 1.45), canopyMat);
      canopy.position.set(0, 2.32 + side * 0.17, side * 0.52);
      canopy.rotation.x = side * 0.22;
      canopy.castShadow = true;
      group.add(canopy);
    }
    const goods = [
      { color: 0xb54a35, geo: new THREE.SphereGeometry(0.1, 8, 6) },
      { color: 0xd6b34a, geo: new THREE.SphereGeometry(0.085, 8, 6) },
      { color: 0x7a9b46, geo: new THREE.SphereGeometry(0.09, 8, 6) },
      { color: 0x955d32, geo: new THREE.BoxGeometry(0.15, 0.14, 0.15) },
    ];
    for (let i = 0; i < 15; i++) {
      const g = choice(goods);
      const mesh = new THREE.Mesh(g.geo, new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.75 }));
      mesh.position.set(rand(-1.5, 1.5), 1.08 + rand(0, 0.05), rand(0.12, 0.78));
      group.add(mesh);
    }
    for (const sx of [-1, 1]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x70502f, roughness: 1, map: wood }));
      crate.position.set(sx * 2.1, 0.3, 0.4);
      crate.rotation.y = rand(-0.2, 0.2);
      crate.castShadow = true;
      group.add(crate);
    }
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffa83f, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 }));
    lantern.position.set(0, 2.05, 0.85);
    group.add(lantern);
    const light = new THREE.PointLight(0xffad5b, 8, 7, 1.6);
    light.position.set(0, 2.05, 0.85);
    group.add(light);
    this.scene.add(group);
    this.addBuildingBox(x, z, 3.9, 2.2, rot);
    return group;
  }

  createWell(x, z) {
    const y = this.heightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8e8b7e, roughness: 1, map: getShared().stone });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 1.0, 14, 1, true), stoneMat);
    ring.position.y = 0.5;
    ring.castShadow = ring.receiveShadow = true;
    group.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.12, 6, 18), stoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.0;
    group.add(rim);
    const inside = new THREE.Mesh(new THREE.CircleGeometry(0.86, 14), new THREE.MeshBasicMaterial({ color: 0x15201d }));
    inside.rotation.x = -Math.PI / 2;
    inside.position.y = 0.98;
    group.add(inside);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.0, 0.14), new THREE.MeshStandardMaterial({ color: 0x553921, roughness: 1, map: getShared().wood }));
      post.position.set(sx * 0.8, 2.0, 0);
      group.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.8, 4), new THREE.MeshStandardMaterial({ map: getShared().roofRed, roughness: 0.9 }));
    roof.position.y = 3.35;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x4a3322 }));
    crank.rotation.z = Math.PI / 2;
    crank.position.y = 2.05;
    group.add(crank);
    this.scene.add(group);
    this.addCollider(x, z, 1.1);
    return group;
  }

  createCampfire(x, z) {
    const y = this.heightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x777469, roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.17, 0.26), 0), stoneMat);
      s.position.set(Math.cos(a) * 0.85, 0.13, Math.sin(a) * 0.85);
      s.scale.y = 0.7;
      s.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
      s.castShadow = true;
      group.add(s);
    }
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4b3421, roughness: 1, map: getShared().wood });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.15, 6), woodMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 4) * Math.PI;
      log.position.y = 0.16;
      group.add(log);
    }
    const flameGroup = new THREE.Group();
    const flameMats = [
      new THREE.MeshBasicMaterial({ color: 0xffb23f, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    ];
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34 - i * 0.06, 1.2 + i * 0.15, 6), flameMats[i]);
      flame.position.y = 0.65 + i * 0.12;
      flame.userData.phase = i * 2.1;
      flameGroup.add(flame);
    }
    group.add(flameGroup);
    this.fire = { group, flames: flameGroup.children, light: null, embers: null };
    const light = new THREE.PointLight(0xff8a3d, 22, 14, 1.6);
    light.position.set(0, 1.3, 0);
    light.castShadow = false;
    group.add(light);
    this.fire.light = light;

    const emberGeo = new THREE.BufferGeometry();
    const emberPos = new Float32Array(40 * 3);
    for (let i = 0; i < 40; i++) {
      emberPos[i * 3] = rand(-0.3, 0.3);
      emberPos[i * 3 + 1] = rand(0.4, 1.8);
      emberPos[i * 3 + 2] = rand(-0.3, 0.3);
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
      map: getShared().glow, size: 0.16, transparent: true, opacity: 0.8,
      color: 0xffb35a, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    group.add(embers);
    this.fire.embers = embers;

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.1, 7), woodMat);
      seat.rotation.z = Math.PI / 2;
      seat.rotation.y = a + Math.PI / 2;
      seat.position.set(Math.cos(a) * 2.0, 0.22, Math.sin(a) * 2.0);
      seat.castShadow = true;
      group.add(seat);
    }
    this.scene.add(group);
    this.addCollider(x, z, 1.1);
    this.fire.position = { x, y, z };
    return group;
  }

  createForge(x, z, rot) {
    const y = this.heightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rot;
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x807b6d, roughness: 1, map: getShared().stone });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.4), stoneMat);
    base.position.y = 0.5;
    base.castShadow = base.receiveShadow = true;
    group.add(base);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 1.0), stoneMat);
    hood.position.set(0, 1.5, -0.3);
    hood.castShadow = true;
    group.add(hood);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.7), new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff4a00, emissiveIntensity: 1.3, roughness: 0.8 }));
    coals.position.set(0, 1.02, 0.15);
    group.add(coals);
    const light = new THREE.PointLight(0xff6a26, 14, 8, 1.8);
    light.position.set(0, 1.6, 0.3);
    group.add(light);
    this.forgeLight = light;
    const anvil = new THREE.Group();
    const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x3a3b3c, metalness: 0.4, roughness: 0.7 }));
    anvilBase.position.y = 0.25;
    anvil.add(anvilBase);
    const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.32), new THREE.MeshStandardMaterial({ color: 0x54595c, metalness: 0.7, roughness: 0.45 }));
    anvilTop.position.y = 0.58;
    anvil.add(anvilTop);
    anvil.position.set(1.7, 0, 0.3);
    group.add(anvil);
    this.scene.add(group);
    this.addCollider(x, z, 1.5);
    return group;
  }

  createLamp(x, z) {
    const y = this.heightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3c2a1b, roughness: 0.9 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.3, 7), postMat);
    post.position.y = 1.65;
    post.castShadow = true;
    group.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), postMat);
    arm.position.set(0.32, 3.15, 0);
    group.add(arm);
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), new THREE.MeshStandardMaterial({ color: 0xffd98e, emissive: 0xffa640, emissiveIntensity: 1.1, transparent: true, opacity: 0.92 }));
    lantern.position.set(0.68, 2.94, 0);
    group.add(lantern);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 4), postMat);
    cap.position.set(0.68, 3.24, 0);
    cap.rotation.y = Math.PI / 4;
    group.add(cap);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getShared().glow, color: 0xffb35e, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(0.68, 2.94, 0);
    glow.scale.set(1.5, 1.5, 1);
    group.add(glow);
    this.scene.add(group);
    return group;
  }

  createFence(points) {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3d25, roughness: 1, map: getShared().wood });
    const group = new THREE.Group();
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, z1] = points[i], [x2, z2] = points[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const angle = Math.atan2(z2 - z1, x2 - x1);
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const y = this.heightAt(cx, cz);
      for (let s = 0; s <= Math.ceil(len / 1.6); s++) {
        const t = s / Math.ceil(len / 1.6);
        const px = lerp(x1, x2, t), pz = lerp(z1, z2, t);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), postMat);
        post.position.set(px, this.heightAt(px, pz) + 0.5, pz);
        post.rotation.y = angle;
        post.castShadow = true;
        group.add(post);
      }
      for (const hy of [0.35, 0.72]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.07), postMat);
        rail.position.set(cx, y + hy, cz);
        rail.rotation.y = -angle;
        group.add(rail);
      }
    }
    this.scene.add(group);
    return group;
  }

  buildVillage() {
    this.createHouse(9.5, -12.5, 0.42, { w: 5.4, d: 4.3 });
    this.createHouse(21.6, -12.8, -0.54, { w: 4.9, d: 4.1, roof: getShared().roofBlue });
    this.createHouse(10.2, -23.4, Math.PI - 0.36, { w: 4.8, d: 4.2 });
    this.createHouse(22.4, -23.0, Math.PI + 0.5, { w: 5.5, d: 4.4, stone: false, roof: getShared().roofRed });
    this.createHouse(16.0, -7.2, 0.08, { w: 4.2, d: 3.6, h: 2.5, roof: getShared().roofBlue });
    this.createMarket(20.7, -17.6, -0.18);
    this.createWell(11.0, -18.1);
    this.createCampfire(16.7, -17.9);
    this.createForge(7.3, -20.4, 0.9);
    this.createLamp(10.3, -10.0);
    this.createLamp(20.4, -22.4);
    this.createFence([[7.0, -15.8], [7.0, -27.0]]);
    this.createFence([[24.9, -15.4], [26.0, -25.6]]);
    this.createFence([[7.5, -26.4], [12.4, -27.5]]);
    this.createFence([[20.0, -27.4], [25.6, -26.0]]);

    const crateMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1, map: getShared().wood });
    for (const [x, z, s] of [[8.2, -8.6, 0.8], [23.7, -9.2, 0.65], [24.5, -20.9, 0.75], [12.8, -27.0, 0.6]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
      crate.position.set(x, this.heightAt(x, z) + s / 2, z);
      crate.rotation.y = rand(0, Math.PI);
      crate.castShadow = true;
      this.scene.add(crate);
      this.addCollider(x, z, s * 0.6);
    }

    this.npcSpots.push(
      { id: 'rowan', name: 'Elder Rowan', role: 'elder', x: 14.4, z: -13.0, rot: 0.35, quest: true },
      { id: 'marta', name: 'Marta the Merchant', role: 'merchant', x: 19.8, z: -15.0, rot: Math.PI - 0.2 },
      { id: 'bran', name: 'Bran the Smith', role: 'smith', x: 8.4, z: -19.2, rot: 1.1 },
      { id: 'lyra', name: 'Lyra', role: 'villager', x: 13.1, z: -18.7, rot: 2.4, wander: { x: 12.5, z: -18, r: 2.4 } },
      { id: 'tomas', name: 'Tomas', role: 'villager', x: 18.8, z: -21.8, rot: -0.8, wander: { x: 18.5, z: -21, r: 2.1 } },
    );
  }

  buildCastle() {
    const cx = -38, cz = -43;
    const ground = this.heightAt(cx, cz);
    const group = new THREE.Group();
    group.position.set(cx, ground - 0.3, cz);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8a7f, roughness: 0.96, map: getShared().stone });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x66655d, roughness: 0.98, map: getShared().stone });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3e5673, roughness: 0.75, metalness: 0.1 });

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(17, 19, 3, 12), darkStone);
    platform.position.y = -0.8;
    platform.receiveShadow = true;
    group.add(platform);

    const keep = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 8), stoneMat);
    keep.position.set(0, 9, -1.5);
    keep.castShadow = keep.receiveShadow = true;
    group.add(keep);

    const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(7.4, 4.2, 4), roofMat);
    keepRoof.position.set(0, 17.1, -1.5);
    keepRoof.rotation.y = Math.PI / 4;
    keepRoof.castShadow = true;
    group.add(keepRoof);

    for (const [tx, tz, h, r] of [[-8, 6, 13, 2.4], [8, 6, 13, 2.4], [-8, -8, 15, 2.7], [8, -8, 15, 2.7], [0, 7, 10, 2.0]]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, h, 12), stoneMat);
      tower.position.set(tx, h / 2 + 1.5, tz);
      tower.castShadow = tower.receiveShadow = true;
      group.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.28, r * 1.6, 12), roofMat);
      roof.position.set(tx, h + 1.5 + r * 0.8, tz);
      roof.castShadow = true;
      group.add(roof);
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.6, 5), new THREE.MeshStandardMaterial({ color: 0x4a3a2a }));
      flagPole.position.set(tx, h + 1.5 + r * 1.6 + 1.1, tz);
      group.add(flagPole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.85, 8, 4), new THREE.MeshStandardMaterial({ map: getShared().banner, side: THREE.DoubleSide, roughness: 0.9 }));
      flag.position.set(tx + 0.78, h + 1.5 + r * 1.6 + 1.8, tz);
      flag.userData.base = Float32Array.from(flag.geometry.attributes.position.array);
      group.add(flag);
      this.flags.push(flag);
      const battlements = 8;
      for (let b = 0; b < battlements; b++) {
        const a = (b / battlements) * Math.PI * 2;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.7), stoneMat);
        merlon.position.set(tx + Math.cos(a) * r * 0.82, h + 1.8, tz + Math.sin(a) * r * 0.82);
        merlon.rotation.y = -a;
        group.add(merlon);
      }
    }

    for (const [wx, wz, ww, wd, wr] of [[0, 6.2, 15, 1.2, 0], [-12, 1, 1.2, 12, 0], [12, 1, 1.2, 12, 0]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, 6.5, wd), stoneMat);
      wall.position.set(wx, 4.7, wz);
      wall.rotation.y = wr;
      wall.castShadow = wall.receiveShadow = true;
      group.add(wall);
      const length = Math.max(ww, wd);
      const count = Math.floor(length / 1.6);
      for (let m = 0; m < count; m++) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.65), stoneMat);
        if (ww > wd) merlon.position.set(wx - ww / 2 + 0.8 + m * 1.6, 8.3, wz);
        else merlon.position.set(wx, 8.3, wz - wd / 2 + 0.8 + m * 1.6);
        group.add(merlon);
      }
    }

    const gate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.6, 1.5), darkStone);
    gate.position.set(0, 4.0, 6.2);
    group.add(gate);
    const gateHole = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.8), new THREE.MeshBasicMaterial({ color: 0x1c1a16 }));
    gateHole.position.set(0, 4.1, 7.0);
    group.add(gateHole);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.55, 12, 1, false, 0, Math.PI), darkStone);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(0, 6.0, 7.0);
    group.add(arch);

    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), new THREE.MeshStandardMaterial({ map: getShared().banner, side: THREE.DoubleSide, roughness: 0.9 }));
    banner.position.set(0, 5.0, 7.1);
    group.add(banner);

    for (const [wx, wy, wz] of [[-2, 7.5, 3.4], [2, 7.5, 3.4], [0, 12, 3.4], [-5, 9, 3.4], [5, 9, 3.4]]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.6), new THREE.MeshStandardMaterial({ color: 0x2f2619, emissive: 0xffa54c, emissiveIntensity: 0.42, roughness: 0.5 }));
      win.position.set(wx, wy, wz);
      group.add(win);
    }

    this.scene.add(group);
    this.castle = group;
    for (const tx of [-1.6, 1.6]) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getShared().glow, color: 0xff9a44, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(tx, 5.2, 7.3);
      glow.scale.set(1.8, 1.8, 1);
      group.add(glow);
    }
  }

  buildStoneCircle() {
    const cx = -23, cz = -21;
    const y = this.heightAt(cx, cz);
    const group = new THREE.Group();
    group.position.set(cx, y, cz);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7d8078, roughness: 0.92 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const x = Math.cos(a) * 5.4, z = Math.sin(a) * 5.4;
      const h = rand(2.2, 3.4);
      const stone = new THREE.Mesh(new THREE.BoxGeometry(rand(0.8, 1.3), h, rand(0.5, 0.9)), stoneMat);
      stone.position.set(x, h / 2, z);
      stone.rotation.y = -a + rand(-0.25, 0.25);
      stone.rotation.z = rand(-0.08, 0.08);
      stone.castShadow = stone.receiveShadow = true;
      group.add(stone);
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.55), new THREE.MeshBasicMaterial({ color: 0x74e6e0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      rune.position.set(-Math.sin(a) * 0.49, h * 0.55, Math.cos(a) * 0.49);
      rune.rotation.y = -a;
      group.add(rune);
    }
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x696d68, roughness: 0.9 }));
    altar.position.y = 0.4;
    altar.castShadow = altar.receiveShadow = true;
    group.add(altar);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), new THREE.MeshStandardMaterial({ color: 0x7ef0e6, emissive: 0x35c8c0, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.4 }));
    orb.position.y = 1.55;
    group.add(orb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getShared().glow, color: 0x82f4ea, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(2.2, 2.2, 1);
    halo.position.y = 1.55;
    group.add(halo);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 10, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x6ee6dd, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 6;
    group.add(beam);
    const light = new THREE.PointLight(0x55d9d2, 13, 16, 1.7);
    light.position.y = 2.3;
    group.add(light);
    this.scene.add(group);
    this.stoneCircle = group;
    this.runeOrb = orb;
    this.runeHalo = halo;
    this.runeBeam = beam;
    this.runeLight = light;
    this.addCollider(cx, cz, 1.2);
    this.interactables.push({ type: 'altar', name: 'Ancient Altar', x: cx, z: cz + 1.4, radius: 2.6, node: group });
  }

  createTree(x, z, type = 'oak', scale = 1) {
    const y = this.heightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    group.rotation.y = rand(0, Math.PI * 2);
    const trunkMat = new THREE.MeshStandardMaterial({ color: type === 'birch' ? 0xd6d2bd : 0x5c4028, roughness: 1, map: getShared().wood });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.27, 2.1, 7), trunkMat);
    trunk.position.y = 1.05;
    trunk.castShadow = trunk.receiveShadow = true;
    group.add(trunk);
    if (type === 'birch') {
      for (let i = 0; i < 7; i++) {
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.005), new THREE.MeshBasicMaterial({ color: 0x3a342b }));
        mark.position.set(rand(-0.12, 0.12), rand(0.5, 1.9), 0.175);
        mark.rotation.z = rand(-0.15, 0.15);
        group.add(mark);
      }
    }
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: type === 'birch' ? 0x93b35e : 0x4d7a3a, roughness: 0.95, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: type === 'birch' ? 0xa9c26f : 0x5f8b45, roughness: 0.95, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: type === 'birch' ? 0x7f9e52 : 0x426b33, roughness: 0.95, flatShading: true }),
    ];
    const canopy = new THREE.Group();
    canopy.position.y = 2.55;
    if (type === 'pine') {
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.38, 1.8, 7), leafMats[i % 3]);
        cone.position.y = i * 0.75;
        cone.castShadow = cone.receiveShadow = true;
        canopy.add(cone);
      }
    } else {
      const blobs = type === 'birch' ? 3 : 4;
      for (let i = 0; i < blobs; i++) {
        const r = rand(0.78, 1.18) * (type === 'birch' ? 0.85 : 1);
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMats[i % 3]);
        blob.position.set(rand(-0.8, 0.8), rand(0.1, 1.25), rand(-0.8, 0.8));
        blob.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
        blob.castShadow = blob.receiveShadow = true;
        canopy.add(blob);
      }
    }
    group.add(canopy);
    group.userData.canopy = canopy;
    group.userData.phase = rand(0, Math.PI * 2);
    group.userData.isTree = true;
    group.userData.radius = 0.55 * scale;
    group.userData.treeType = type;
    group.userData.hp = 3;
    group.userData.cooldown = 0;
    group.userData.stump = null;
    this.scene.add(group);
    this.trees.push(group);
    this.mapTrees.push({ x, z, r: 1.1 * scale });
    this.addCollider(x, z, 0.55 * scale);
    return group;
  }

  createRock(x, z, ore = null, scale = 1) {
    const y = this.heightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    group.rotation.y = rand(0, Math.PI * 2);
    const rockMat = new THREE.MeshStandardMaterial({ color: choice([0x77776c, 0x85857a, 0x6c7066]), roughness: 1, flatShading: true });
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.7, 1.15), 0), rockMat);
    rock.position.y = 0.45;
    rock.scale.set(rand(0.9, 1.3), rand(0.65, 1.0), rand(0.9, 1.2));
    rock.castShadow = rock.receiveShadow = true;
    group.add(rock);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.6, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a7a3d, roughness: 1, flatShading: true }));
    moss.position.y = 0.86;
    moss.scale.set(1.05, 0.18, 1.05);
    group.add(moss);
    if (ore) {
      const oreMat = new THREE.MeshStandardMaterial({
        color: ore === 'gold' ? 0xe8bc4d : ore === 'iron' ? 0xb2a08c : 0x7fd4cf,
        emissive: ore === 'gold' ? 0x8a5c08 : ore === 'iron' ? 0x3d3630 : 0x2b7f7a,
        emissiveIntensity: ore === 'gold' ? 0.5 : 0.25, roughness: 0.35, metalness: 0.7,
      });
      for (let i = 0; i < 7; i++) {
        const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.09, 0.18), 0), oreMat);
        crystal.position.set(rand(-0.55, 0.55), rand(0.25, 0.85), rand(-0.45, 0.55));
        crystal.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
        group.add(crystal);
      }
    }
    group.userData.ore = ore;
    group.userData.hp = 3;
    group.userData.cooldown = 0;
    group.userData.radius = 1.1 * scale;
    this.scene.add(group);
    this.rocks.push(group);
    this.mapTrees.push({ x, z, r: 0.85 * scale, rock: true });
    this.addCollider(x, z, 0.9 * scale);
    return group;
  }

  buildForest() {
    const manual = [
      [8.5, 23.5, 'oak', 1.02], [-9.5, 20.5, 'oak', 1.1], [13.5, 14.5, 'birch', 0.9],
      [-14.5, 12.2, 'oak', 1.15], [24.0, 8.0, 'oak', 1.0], [-25.0, 3.5, 'pine', 1.05],
      [31.5, -3.5, 'oak', 0.95], [-5.5, 30.5, 'pine', 1.1], [18.0, 29.0, 'birch', 0.86],
      [-27.0, -9.0, 'pine', 1.15], [-15.0, -2.5, 'oak', 0.98], [-9.0, -9.0, 'oak', 1.05],
      [-30.0, -18.0, 'pine', 1.2], [-33.0, -5.0, 'oak', 0.95], [3.5, 10.5, 'birch', 0.8],
      [29.5, -9.0, 'oak', 1.0], [37.5, -17.0, 'oak', 0.92], [24.0, -35.0, 'birch', 0.88],
      [14.5, -34.0, 'oak', 0.96], [43.0, -31.0, 'pine', 1.0], [6.0, -30.0, 'oak', 1.08],
      [-2.0, -27.0, 'birch', 0.84], [-17.0, -33.0, 'pine', 1.05], [-31.0, -30.0, 'pine', 1.12],
      [-45.0, -27.0, 'pine', 1.15], [48.0, -8.0, 'pine', 1.08], [37.0, 16.0, 'oak', 0.95],
      [-42.0, 9.0, 'pine', 1.14], [-21.0, 27.0, 'pine', 1.1],
    ];
    for (const [x, z, type, s] of manual) {
      const yy = this.heightAt(x, z);
      if (yy > WATER_LEVEL + 0.2) this.createTree(x, z, type, s);
    }

    const candidates = [];
    for (let i = 0; i < 900; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(6, 68);
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 4;
      if (dist2(x, z, SPAWN.x, SPAWN.z) < 14) continue;
      if (dist2(x, z, SPAWN.x, SPAWN.z + 8.5) < 7) continue;
      if (x > -20 && x < 30 && z > -32 && z < 8) continue;
      if (dist2(x, z, 31, -25) < 23) continue;
      if (dist2(x, z, -38, -43) < 20) continue;
      if (dist2(x, z, -23, -21) < 9) continue;
      let ok = true;
      for (const c of this.colliders) if (dist2(x, z, c.x, c.z) < c.r + 2.2) { ok = false; break; }
      if (!ok) continue;
      if (this.heightAt(x, z) < WATER_LEVEL + 0.4) continue;
      candidates.push([x, z]);
    }
    for (const [x, z] of candidates.slice(0, 52)) {
      const t = rand();
      this.createTree(x, z, t < 0.18 ? 'birch' : t < 0.46 ? 'pine' : 'oak', rand(0.78, 1.2));
    }
  }

  buildScatter() {
    this.createRock(4.5, 5.0, null, 0.9);
    this.createRock(-4.0, 1.0, 'iron', 1.05);
    this.createRock(-13.5, -11.0, 'iron', 1.0);
    this.createRock(-17.0, -18.0, 'gold', 1.1);
    this.createRock(27.0, 4.0, null, 0.8);
    this.createRock(-7.0, -20.0, 'gold', 1.0);
    this.createRock(33.0, -7.0, null, 1.2);
    this.createRock(-26.0, -36.0, 'iron', 1.1);
    this.createRock(5.5, -20.5, null, 0.7);
    this.createRock(38.0, -23.0, null, 1.1);
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), r = rand(10, 55);
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 5;
      if (dist2(x, z, 31, -25) < 20 || dist2(x, z, 15.5, -16) < 16) continue;
      if (this.heightAt(x, z) < WATER_LEVEL + 0.3) continue;
      this.createRock(x, z, null, rand(0.5, 1.0));
    }

    for (const [x, z] of [[17.7, -32.8], [22.5, -33.2], [26.5, -33.8], [36.5, -32.4], [39.5, -24.8], [38.2, -18.0]]) {
      const group = new THREE.Group();
      const y = this.heightAt(x, z);
      group.position.set(x, y, z);
      for (let i = 0; i < 5; i++) {
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, rand(0.7, 1.3), 4), new THREE.MeshStandardMaterial({ color: 0x557d3d, roughness: 0.9 }));
        reed.position.set(rand(-0.3, 0.3), rand(0.3, 0.6), rand(-0.3, 0.3));
        reed.rotation.z = rand(-0.15, 0.15);
        group.add(reed);
      }
      this.scene.add(group);
    }

    const dockMat = new THREE.MeshStandardMaterial({ color: 0x64462b, roughness: 1, map: getShared().wood });
    const dock = new THREE.Group();
    const dx = 22.5, dz = -27.0;
    dock.position.set(dx, WATER_LEVEL + 0.25, dz);
    for (let i = 0; i < 9; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 2.2), dockMat);
      plank.position.set(i * 0.46 - 1.8, 0, 0);
      plank.castShadow = true;
      dock.add(plank);
    }
    for (const px of [-1.9, 1.9]) {
      for (const pz of [-1.0, 1.0]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.0, 6), dockMat);
        post.position.set(px, -0.8, pz);
        dock.add(post);
      }
    }
    this.scene.add(dock);
    const boat = new THREE.Group();
    boat.position.set(28.5, WATER_LEVEL + 0.12, -26.0);
    boat.rotation.y = 0.5;
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.35, 2.8, 7, 1, false), new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9, map: getShared().wood }));
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(1, 1, 0.5);
    boat.add(hull);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.4), dockMat);
    seat.position.y = 0.15;
    boat.add(seat);
    this.scene.add(boat);

    const horse = new THREE.Group();
    horse.position.set(11.5, this.heightAt(11.5, -4.5), -4.5);
    horse.rotation.y = 1.5;
    const horseMat = new THREE.MeshStandardMaterial({ color: 0x6c4a2f, roughness: 0.9 });
    const hbody = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 3, 8), horseMat);
    hbody.rotation.z = Math.PI / 2;
    hbody.position.y = 1.0;
    horse.add(hbody);
    for (const [hx, hz] of [[-0.45, -0.18], [-0.45, 0.18], [0.45, -0.18], [0.45, 0.18]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.9, 5), horseMat);
      leg.position.set(hx, 0.45, hz);
      horse.add(leg);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.75, 7), horseMat);
    neck.position.set(0.62, 1.4, 0);
    neck.rotation.z = -0.55;
    horse.add(neck);
    const hhead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.2), horseMat);
    hhead.position.set(0.98, 1.68, 0);
    hhead.rotation.z = -0.2;
    horse.add(hhead);
    groupShadow(horse);
    this.scene.add(horse);
    this.addCollider(11.5, -4.5, 0.9);

    this.interactables.push({ type: 'dock', name: 'Old Dock', x: 22.5, z: -27.0, radius: 2.4 });
  }

  buildAtmosphere() {
    const count = 260;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), r = rand(4, 44);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = rand(1.5, 9);
      positions[i * 3 + 2] = Math.sin(a) * r - 8;
      phases[i] = rand(0, Math.PI * 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: getShared().glow, size: 0.11, transparent: true, opacity: 0.5,
      color: 0xffe9b8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const motes = new THREE.Points(geo, mat);
    this.scene.add(motes);
    this.motes = motes;
    this.motePhases = phases;
    this.moteBase = Float32Array.from(positions);

    const smokeCount = 150;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePos = new Float32Array(smokeCount * 3);
    const smokeData = [];
    for (let i = 0; i < smokeCount; i++) {
      smokePos[i * 3] = 0; smokePos[i * 3 + 1] = -100; smokePos[i * 3 + 2] = 0;
      smokeData.push({ life: rand(0, 1), speed: rand(0.25, 0.5), drift: rand(-0.2, 0.2), scale: rand(0.8, 2.0), source: null });
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokeMat = new THREE.PointsMaterial({
      map: getShared().smoke, size: 1.8, transparent: true, opacity: 0.28,
      color: 0xd4d0c6, depthWrite: false, sizeAttenuation: true,
    });
    const smoke = new THREE.Points(smokeGeo, smokeMat);
    smoke.frustumCulled = false;
    this.scene.add(smoke);
    this.smoke = smoke;
    this.smokeData = smokeData;

    const birds = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const bird = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x2c3430, side: THREE.DoubleSide });
      const wingGeo = new THREE.PlaneGeometry(1.3, 0.15);
      const l = new THREE.Mesh(wingGeo, mat); l.position.x = -0.62; bird.add(l);
      const r = new THREE.Mesh(wingGeo, mat); r.position.x = 0.62; bird.add(r);
      bird.userData.phase = rand(0, Math.PI * 2);
      bird.userData.radius = rand(28, 52);
      bird.userData.height = rand(24, 38);
      bird.userData.speed = rand(0.05, 0.09);
      bird.userData.offset = rand(0, Math.PI * 2);
      birds.add(bird);
    }
    this.scene.add(birds);
    this.birds = birds;
  }

  defineActors() {
    this.goblinSpots = [
      { x: -8.5, z: -13.5, patrol: 4.5 },
      { x: -13.0, z: -8.0, patrol: 3.5 },
      { x: -19.5, z: -14.0, patrol: 4.0 },
      { x: -4.5, z: -22.5, patrol: 4.8 },
      { x: -12.0, z: -23.0, patrol: 3.6 },
      { x: -20.0, z: -2.0, patrol: 4.2 },
      { x: 3.0, z: -26.0, patrol: 3.2 },
    ];
  }

  update(dt, time, camera) {
    this.time = time;
    if (this.waterNormal) {
      this.waterNormal.offset.x = (this.waterNormal.offset.x + dt * 0.018) % 1;
      this.waterNormal.offset.y = (this.waterNormal.offset.y + dt * 0.011) % 1;
    }
    if (this.waterGlint) this.waterGlint.material.opacity = 0.08 + Math.sin(time * 0.8) * 0.03;

    for (const tree of this.trees) {
      const canopy = tree.userData.canopy;
      if (canopy && camera && tree.position.distanceToSquared(camera.position) < 1600) {
        canopy.rotation.z = Math.sin(time * 0.7 + tree.userData.phase) * 0.018;
        canopy.rotation.x = Math.cos(time * 0.55 + tree.userData.phase) * 0.012;
      }
    }

    for (const cloud of this.clouds) {
      cloud.position.x += dt * cloud.userData.speed;
      if (cloud.position.x > 280) cloud.position.x = -280;
    }

    if (this.fire) {
      const f = this.fire;
      f.flames.forEach((flame, i) => {
        const p = Math.sin(time * (7 + i * 1.7) + flame.userData.phase);
        flame.scale.y = 1 + p * 0.16;
        flame.scale.x = flame.scale.z = 1 + Math.sin(time * 9 + i) * 0.08;
        flame.position.x = Math.sin(time * 5 + i * 2) * 0.035;
      });
      f.light.intensity = 20 + Math.sin(time * 11) * 4 + Math.sin(time * 23.7) * 2;
      const ep = f.embers.geometry.attributes.position;
      for (let i = 0; i < ep.count; i++) {
        let y = ep.getY(i) + dt * (0.7 + (i % 5) * 0.12);
        if (y > 2.4) {
          y = 0.3;
          ep.setX(i, rand(-0.3, 0.3));
          ep.setZ(i, rand(-0.3, 0.3));
        }
        ep.setY(i, y);
        ep.setX(i, ep.getX(i) + Math.sin(time * 2 + i) * dt * 0.12);
      }
      ep.needsUpdate = true;
    }

    if (this.runeOrb) {
      this.runeOrb.rotation.y += dt * 0.7;
      this.runeOrb.rotation.x = Math.sin(time * 0.6) * 0.2;
      this.runeOrb.position.y = 1.55 + Math.sin(time * 1.7) * 0.09;
      this.runeHalo.position.y = this.runeOrb.position.y;
      this.runeHalo.material.opacity = 0.55 + Math.sin(time * 2.3) * 0.15;
      this.runeLight.intensity = 11 + Math.sin(time * 2.2) * 3;
      this.runeBeam.material.opacity = 0.06 + Math.sin(time * 1.4) * 0.02;
    }

    if (this.forgeLight) this.forgeLight.intensity = 12 + Math.sin(time * 9) * 3 + Math.sin(time * 17) * 2;

    for (const flag of this.flags) {
      const pos = flag.geometry.attributes.position;
      const base = flag.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const t = (x + 0.75) / 1.5;
        pos.setZ(i, Math.sin(time * 3.5 + t * 4 + y * 2) * 0.16 * t);
      }
      pos.needsUpdate = true;
    }

    if (this.motes) {
      const pos = this.motes.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const ph = this.motePhases[i];
        pos.setX(i, this.moteBase[i * 3] + Math.sin(time * 0.35 + ph) * 0.9);
        pos.setY(i, this.moteBase[i * 3 + 1] + Math.sin(time * 0.5 + ph * 1.7) * 0.65);
        pos.setZ(i, this.moteBase[i * 3 + 2] + Math.cos(time * 0.3 + ph) * 0.9);
      }
      pos.needsUpdate = true;
    }

    if (this.smoke) {
      const pos = this.smoke.geometry.attributes.position;
      for (let i = 0; i < this.smokeData.length; i++) {
        const s = this.smokeData[i];
        s.life += dt * s.speed;
        if (s.life > 1) {
          s.life -= 1;
          const sources = this.smokeEmitters;
          if (sources.length) s.source = choice(sources);
          s.drift = rand(-0.25, 0.25);
        }
        if (!s.source && this.smokeEmitters.length) s.source = this.smokeEmitters[i % this.smokeEmitters.length];
        const src = s.source;
        if (src) {
          const life = s.life;
          pos.setXYZ(i,
            src.x + Math.sin(time * 0.7 + i) * 0.3 + s.drift * life * 5,
            src.y + life * 3.2,
            src.z + Math.cos(time * 0.5 + i) * 0.3);
        }
      }
      pos.needsUpdate = true;
    }

    if (this.birds) {
      for (const bird of this.birds.children) {
        const d = bird.userData;
        const a = time * d.speed + d.offset;
        bird.position.set(Math.cos(a) * d.radius, d.height + Math.sin(time * 0.5 + d.offset) * 2, Math.sin(a) * d.radius - 5);
        bird.rotation.y = -a + Math.PI / 2;
        const flap = Math.sin(time * 6 + d.phase) * 0.45;
        bird.children[0].rotation.z = flap;
        bird.children[1].rotation.z = -flap;
      }
    }
  }
}

function groupShadow(group) {
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

export { SPAWN, VILLAGE, WATER_LEVEL };
