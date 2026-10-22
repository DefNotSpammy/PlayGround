import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
let seed = 1337;
let rngState = 0x6d2b79f5;
export function setSeed(value) {
  seed = value >>> 0;
  rngState = (seed ^ 0x9e3779b9) >>> 0;
}
export const rand = (a = 0, b = 1) => {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return a + r * (b - a);
};
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(rand() * arr.length)];
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, octaves = 3) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export function canvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  return tex;
}

export function speckle(ctx, w, h, count, palette, minR = 0.5, maxR = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = choice(palette);
    ctx.globalAlpha = rand(0.15, 0.65);
    const x = rand(0, w), y = rand(0, h);
    ctx.beginPath();
    ctx.arc(x, y, rand(minR, maxR), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function makeDirtTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#816040';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(112,78,48,.35)');
    grad.addColorStop(0.5, 'rgba(156,118,76,.25)');
    grad.addColorStop(1, 'rgba(104,71,44,.35)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2400, ['#5c4129', '#967049', '#6f5235', '#b19066', '#4c3622'], 0.5, 2.2);
    for (let i = 0; i < 280; i++) {
      ctx.fillStyle = choice(['#8d8477', '#6e675d', '#a9a196']);
      ctx.globalAlpha = rand(0.3, 0.8);
      ctx.beginPath();
      ctx.ellipse(rand(0, w), rand(0, h), rand(1.5, 4.5), rand(1, 3), rand(0, 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = 'rgba(70,48,30,.35)';
      ctx.lineWidth = rand(0.5, 1.3);
      ctx.beginPath();
      const x = rand(0, w), y = rand(0, h);
      ctx.moveTo(x, y); ctx.lineTo(x + rand(-8, 8), y + rand(-8, 8));
      ctx.stroke();
    }
  }, { repeat: [4, 10] });
}

export function makeGrassTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6f954c';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 3600, ['#5d8340', '#7fa85a', '#4f7337', '#8cb36a', '#678c45'], 0.4, 1.8);
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = choice(['rgba(58,88,39,.5)', 'rgba(139,174,96,.4)', 'rgba(76,108,48,.5)']);
      ctx.lineWidth = rand(0.4, 1.2);
      const x = rand(0, w), y = rand(0, h);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand(-2, 2), y - rand(2, 6));
      ctx.stroke();
    }
  }, { repeat: [18, 18] });
}

export function makeWoodTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5b3b24';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 42) {
      ctx.fillStyle = x % 84 === 0 ? '#63422a' : '#553720';
      ctx.fillRect(x, 0, 40, h);
      ctx.fillStyle = 'rgba(28,17,10,.55)';
      ctx.fillRect(x + 39, 0, 2, h);
    }
    for (let i = 0; i < 240; i++) {
      ctx.strokeStyle = choice(['rgba(36,22,12,.3)', 'rgba(122,86,54,.35)', 'rgba(81,54,32,.4)']);
      ctx.lineWidth = rand(0.4, 1.4);
      const x = rand(0, w);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + rand(-6, 6), h * 0.3, x + rand(-6, 6), h * 0.7, x + rand(-4, 4), h);
      ctx.stroke();
    }
  }, { repeat: [1, 1] });
}

export function makeStoneTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8a8a80';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2200, ['#77786f', '#9a9b91', '#6c6e66', '#a6a79d'], 0.5, 2.2);
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const y = (r / rows) * h;
      ctx.strokeStyle = 'rgba(55,56,51,.65)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      const offset = (r % 2) * 40;
      for (let x = offset; x < w; x += 80) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h / rows); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(183,184,174,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + 3); ctx.lineTo(w, y + 3); ctx.stroke();
    }
  }, { repeat: [2, 1] });
}

export function makeRoofTexture(base = '#8d3d2e', dark = '#65291f', light = '#a9553f') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const rowH = 26;
    for (let r = 0; r < 11; r++) {
      const y = r * rowH;
      for (let x = -20; x < w + 20; x += 30) {
        const off = (r % 2) * 15;
        ctx.fillStyle = choice([base, dark, light]);
        ctx.beginPath();
        ctx.roundRect(x + off, y, 27, rowH - 3, [0, 0, 7, 7]);
        ctx.fill();
        ctx.fillStyle = 'rgba(35,16,12,.35)';
        ctx.fillRect(x + off, y + rowH - 4, 27, 2);
      }
    }
    speckle(ctx, w, h, 360, ['#4e2119', '#b4654f', '#793428'], 0.4, 1.5);
  }, { repeat: [2, 2] });
}

export function makeStripeTexture(a = '#8f2f2f', b = '#e8d9b5') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = b; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = a;
    for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 32, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,.16)');
    grad.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  }, { repeat: [2, 1] });
}

export function makeCapeTexture() {
  return canvasTexture(256, 384, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1d3b63');
    g.addColorStop(0.55, '#264b7c');
    g.addColorStop(1, '#172c49');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d9b45b'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = 'rgba(217,180,91,.55)'; ctx.lineWidth = 2; ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.fillStyle = '#dfbd69';
    ctx.beginPath();
    ctx.moveTo(0, -58); ctx.lineTo(16, -14); ctx.lineTo(58, -12); ctx.lineTo(25, 14);
    ctx.lineTo(36, 58); ctx.lineTo(0, 32); ctx.lineTo(-36, 58); ctx.lineTo(-25, 14);
    ctx.lineTo(-58, -12); ctx.lineTo(-16, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#24466f'; ctx.beginPath(); ctx.arc(0, 2, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f4df9a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    speckle(ctx, w, h, 240, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.12)'], 0.5, 1.5);
  });
}

export function makeBannerTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7e2323');
    g.addColorStop(1, '#4d1111');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d9b45b'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#e2c26d';
    ctx.beginPath();
    ctx.moveTo(64, 52); ctx.lineTo(84, 96); ctx.lineTo(74, 96); ctx.lineTo(74, 150);
    ctx.lineTo(54, 150); ctx.lineTo(54, 96); ctx.lineTo(44, 96); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(64, 170, 17, 0, Math.PI * 2); ctx.fill();
  });
}

export function makeGlowTexture(inner = 'rgba(255,232,170,1)', outer = 'rgba(255,170,60,0)') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, 'rgba(255,210,120,.75)');
    g.addColorStop(0.55, 'rgba(255,160,60,.22)');
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeSmokeTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(210,210,205,.55)');
    g.addColorStop(0.5, 'rgba(180,182,178,.22)');
    g.addColorStop(1, 'rgba(160,164,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeTextSprite(text, {
  font = '600 42px Inter, sans-serif',
  color = '#f2e7ce',
  stroke = 'rgba(10,14,12,.92)',
  background = null,
  padding = 14,
  scale = 1,
  maxWidth = 512,
  depthTest = false,
} = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  mctx.font = font;
  const width = Math.min(maxWidth, Math.ceil(mctx.measureText(text).width + padding * 2));
  const height = 78;
  canvas.width = width;
  canvas.height = height;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (background) {
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(1, 10, width - 2, height - 20, 12);
    ctx.fill();
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, width / 2, height / 2 + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((width / height) * 0.62 * scale, 0.62 * scale, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function makeBarSprite(width = 0.9, height = 0.12) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 20;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = 19;
  const draw = (pct) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 20);
    ctx.fillStyle = 'rgba(8,10,9,.85)';
    ctx.beginPath(); ctx.roundRect(0, 0, 128, 20, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(3, 3, 122, 5);
    const w = Math.max(0, Math.min(1, pct)) * 116;
    const g = ctx.createLinearGradient(0, 0, 0, 20);
    g.addColorStop(0, '#d95050'); g.addColorStop(1, '#8d1f1f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(6, 4, w, 12, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(226,199,126,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(0.5, 0.5, 127, 19, 6); ctx.stroke();
    tex.needsUpdate = true;
  };
  draw(1);
  sprite.userData.draw = draw;
  return sprite;
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
}

export function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
