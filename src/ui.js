import { ITEMS, HOTBAR, SKILLS, icon } from './items.js';
import { clamp, lerp } from './utils.js';

const fmt = (n) => n.toLocaleString('en-US');

export class UI {
  constructor(world, callbacks = {}) {
    this.world = world;
    this.callbacks = callbacks;
    this.el = {
      hud: document.getElementById('hud'),
      loading: document.getElementById('loadingCurtain'),
      hpValue: document.getElementById('hpValue'),
      hpLiquid: document.getElementById('hpLiquid'),
      runValue: document.getElementById('runValue'),
      runLiquid: document.getElementById('runLiquid'),
      minimap: document.getElementById('minimap'),
      bigMap: document.getElementById('bigMap'),
      worldTime: document.getElementById('worldTime'),
      hotbar: document.getElementById('hotbar'),
      inventory: document.getElementById('inventoryGrid'),
      coins: document.getElementById('coinCount'),
      skills: document.getElementById('skillsStrip'),
      xpSkill: document.getElementById('xpSkill'),
      xpFill: document.getElementById('xpFill'),
      xpNumbers: document.getElementById('xpNumbers'),
      chatLog: document.getElementById('chatLog'),
      chatForm: document.getElementById('chatForm'),
      chatInput: document.getElementById('chatInput'),
      questTitle: document.getElementById('questTitle'),
      questText: document.getElementById('questText'),
      questObjective: document.getElementById('questObjective'),
      questFill: document.getElementById('questFill'),
      questCount: document.getElementById('questCount'),
      target: document.getElementById('targetPanel'),
      targetName: document.getElementById('targetName'),
      targetLevel: document.getElementById('targetLevel'),
      targetFill: document.getElementById('targetFill'),
      targetHp: document.getElementById('targetHp'),
      toasts: document.getElementById('toastStack'),
      context: document.getElementById('contextPrompt'),
      contextLabel: document.getElementById('contextLabel'),
      harvest: document.getElementById('harvestPanel'),
      harvestLabel: document.getElementById('harvestLabel'),
      harvestFill: document.getElementById('harvestFill'),
      dialog: document.getElementById('dialogOverlay'),
      dialogName: document.getElementById('dialogName'),
      dialogText: document.getElementById('dialogText'),
      dialogPortrait: document.getElementById('dialogPortrait'),
      dialogActions: document.getElementById('dialogActions'),
      mapOverlay: document.getElementById('mapOverlay'),
      helpOverlay: document.getElementById('helpOverlay'),
      levelup: document.getElementById('levelupOverlay'),
      levelupSkill: document.getElementById('levelupSkill'),
      levelupLevel: document.getElementById('levelupLevel'),
      death: document.getElementById('deathOverlay'),
      damageFlash: document.getElementById('damageFlash'),
      tooltip: document.getElementById('tooltip'),
      soundIcon: document.getElementById('soundIcon'),
      locBanner: document.getElementById('locationBanner'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.bigMapCtx = this.el.bigMap.getContext('2d');
    this.mapExtent = 150;
    this.waypoint = null;
    this.timeMinutes = 18 * 60 + 42;
    this.currentTab = 'all';
    this.tooltipsBound = false;
    this.mapClickHandler = null;
    this.buildMapTexture();
    this.bindStatic();
  }

  bindStatic() {
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.close).hidden = true;
      });
    });
    for (const overlay of [this.el.mapOverlay, this.el.helpOverlay]) {
      overlay.addEventListener('pointerdown', (e) => {
        if (e.target === overlay) overlay.hidden = true;
      });
    }
    document.getElementById('openMap').addEventListener('click', () => this.openMap());
    document.getElementById('mapToggle').addEventListener('click', () => this.openMap());
    document.getElementById('helpToggle').addEventListener('click', () => { this.el.helpOverlay.hidden = false; });
    document.getElementById('soundToggle').addEventListener('click', () => this.callbacks.onSoundToggle?.());
    document.querySelectorAll('.chat-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chat-tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.tab;
        this.el.chatLog.querySelectorAll('.chat-line').forEach((line) => {
          const tab = line.dataset.tab || 'all';
          line.style.display = this.currentTab === 'all' || tab === this.currentTab ? '' : 'none';
        });
      });
    });
    this.el.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.el.chatInput.value.trim();
      if (!text) return;
      this.el.chatInput.value = '';
      this.callbacks.onChat?.(text);
    });
    this.el.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.el.chatInput.blur();
      e.stopPropagation();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.el.dialog.hidden) this.closeDialog();
        if (!this.el.mapOverlay.hidden) this.el.mapOverlay.hidden = true;
        if (!this.el.helpOverlay.hidden) this.el.helpOverlay.hidden = true;
      }
    });
    this.el.bigMap.addEventListener('click', (e) => {
      const rect = this.el.bigMap.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const x = (px - 0.5) * this.mapExtent;
      const z = (py - 0.5) * this.mapExtent;
      this.waypoint = { x, z };
      this.callbacks.onWaypoint?.(x, z);
      this.drawBigMap();
    });
    window.addEventListener('resize', () => {
      if (!this.el.mapOverlay.hidden) this.drawBigMap();
    });
  }

  setLoading(loaded) {
    this.el.loading.classList.toggle('loaded', loaded);
  }

  buildMapTexture() {
    const size = 384;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    const half = this.mapExtent / 2;
    for (let py = 0; py < size; py++) {
      const z = (py / size - 0.5) * this.mapExtent;
      for (let px = 0; px < size; px++) {
        const x = (px / size - 0.5) * this.mapExtent;
        const h = this.world.heightAt(x, z);
        let r, g, b;
        if (h < 1.2) {
          const d = clamp((1.2 - h) * 0.12, 0, 1);
          r = lerp(54, 35, d); g = lerp(98, 70, d); b = lerp(106, 82, d);
        } else if (h < 1.75) {
          r = 166; g = 154; b = 112;
        } else if (h > 10.5) {
          const t = clamp((h - 10.5) / 12, 0, 1);
          r = lerp(120, 186, t); g = lerp(120, 188, t); b = lerp(108, 181, t);
        } else {
          const t = clamp((h - 1.8) / 9, 0, 1);
          r = lerp(93, 111, t); g = lerp(133, 144, t); b = lerp(66, 83, t);
          r += ((px * 13 + py * 7) % 11) - 5;
          g += ((px * 5 + py * 11) % 9) - 4;
        }
        const i = (py * size + px) * 4;
        image.data[i] = r; image.data[i + 1] = g; image.data[i + 2] = b; image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    const toPx = (x, z) => [((x / this.mapExtent) + 0.5) * size, ((z / this.mapExtent) + 0.5) * size];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const path of this.world.mapPaths) {
      ctx.beginPath();
      path.forEach((p, i) => {
        const [x, y] = toPx(p.x, p.z);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(137,104,65,.95)';
      ctx.lineWidth = 5.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(181,148,99,.6)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    for (const tree of this.world.mapTrees) {
      const [x, y] = toPx(tree.x, tree.z);
      ctx.fillStyle = tree.rock ? 'rgba(106,109,99,.85)' : 'rgba(48,84,44,.85)';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.4, tree.r * 0.95), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of this.world.mapBuildings) {
      const [x, y] = toPx(b.x, b.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-b.rot);
      ctx.fillStyle = 'rgba(104,60,43,.95)';
      ctx.fillRect(-b.w * 1.05, -b.d * 1.05, b.w * 2.1, b.d * 2.1);
      ctx.strokeStyle = 'rgba(224,194,132,.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-b.w * 1.05, -b.d * 1.05, b.w * 2.1, b.d * 2.1);
      ctx.restore();
    }
    const [cx, cy] = toPx(-38, -43);
    ctx.fillStyle = 'rgba(150,148,137,.95)';
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(54,76,104,.95)';
    ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
    const [sx, sy] = toPx(-23, -21);
    ctx.strokeStyle = 'rgba(129,240,230,.9)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.stroke();
    const [lx, ly] = toPx(31, -25);
    ctx.fillStyle = 'rgba(63,125,135,.95)';
    ctx.beginPath(); ctx.arc(lx, ly, 29, 0, Math.PI * 2); ctx.fill();

    this.mapTexture = canvas;
    this.mapSize = size;
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const size = this.el.minimap.width;
    const player = state.player;
    const viewUnits = 64;
    const srcSize = (viewUnits / this.mapExtent) * this.mapSize;
    const srcX = ((player.x / this.mapExtent) + 0.5) * this.mapSize - srcSize / 2;
    const srcY = ((player.z / this.mapExtent) + 0.5) * this.mapSize - srcSize / 2;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#1b3024';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapTexture, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

    const toMap = (x, z) => [
      ((x - player.x) / viewUnits + 0.5) * size,
      ((z - player.z) / viewUnits + 0.5) * size,
    ];
    const inView = (x, z) => Math.abs(x - player.x) < viewUnits / 2 && Math.abs(z - player.z) < viewUnits / 2;

    for (const npc of state.npcs) {
      if (!inView(npc.x, npc.z)) continue;
      const [x, y] = toMap(npc.x, npc.z);
      ctx.fillStyle = npc.quest ? '#f0d482' : '#7fc98b';
      ctx.beginPath(); ctx.arc(x, y, npc.quest ? 4.6 : 3, 0, Math.PI * 2); ctx.fill();
      if (npc.quest) {
        ctx.strokeStyle = 'rgba(240,212,130,.32)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive || !inView(enemy.x, enemy.z)) continue;
      const [x, y] = toMap(enemy.x, enemy.z);
      ctx.fillStyle = '#d35f54';
      ctx.beginPath(); ctx.arc(x, y, 3.1, 0, Math.PI * 2); ctx.fill();
      if (enemy.targeted) {
        ctx.strokeStyle = 'rgba(255,214,127,.9)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (this.waypoint) {
      if (inView(this.waypoint.x, this.waypoint.z)) {
        const [x, y] = toMap(this.waypoint.x, this.waypoint.z);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#eacb7c';
        ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
        ctx.restore();
      } else {
        const dx = this.waypoint.x - player.x, dz = this.waypoint.z - player.z;
        const a = Math.atan2(dz, dx);
        const rx = size / 2 - 15, ry = size / 2 - 15;
        const x = size / 2 + Math.cos(a) * Math.min(rx, ry);
        const y = size / 2 + Math.sin(a) * Math.min(rx, ry);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 4);
        ctx.fillStyle = '#eacb7c';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI - (player.facing || 0));
    const grad = ctx.createLinearGradient(0, -13, 0, 11);
    grad.addColorStop(0, '#fff6dc');
    grad.addColorStop(1, '#d3a94f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 5);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,18,10,.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(239,220,176,.32)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r1 = size / 2 - 3;
      const r2 = i % 6 === 0 ? size / 2 - 11 : size / 2 - 6;
      ctx.beginPath();
      ctx.moveTo(size / 2 + Math.cos(a) * r1, size / 2 + Math.sin(a) * r1);
      ctx.lineTo(size / 2 + Math.cos(a) * r2, size / 2 + Math.sin(a) * r2);
      ctx.stroke();
    }
    const labels = [['N', 0], ['E', 1], ['S', 2], ['W', 3]];
    ctx.font = '600 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [label, i] of labels) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = label === 'N' ? '#f3d99a' : 'rgba(239,224,186,.65)';
      ctx.fillText(label, size / 2 + Math.cos(a) * (size / 2 - 22), size / 2 + Math.sin(a) * (size / 2 - 22));
    }

    const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.52);
    vignette.addColorStop(0, 'rgba(6,12,8,0)');
    vignette.addColorStop(1, 'rgba(6,12,8,.34)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  drawBigMap(state) {
    if (!state) return;
    const ctx = this.bigMapCtx;
    const w = this.el.bigMap.width, h = this.el.bigMap.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0c1711';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapTexture, 0, 0, w, h);
    const toMap = (x, z) => [((x / this.mapExtent) + 0.5) * w, ((z / this.mapExtent) + 0.5) * h];

    const shade = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.82);
    shade.addColorStop(0, 'rgba(8,15,10,0)');
    shade.addColorStop(1, 'rgba(4,8,6,.55)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(232,210,160,.09)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += w / 12) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += h / 8) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const labels = [
      { name: 'Mistwood Vale', x: 15.5, z: -16, type: 'village' },
      { name: 'Castle Greywatch', x: -38, z: -43, type: 'castle' },
      { name: 'The Old Stones', x: -23, z: -21, type: 'stones' },
      { name: 'Mirror Lake', x: 31, z: -25, type: 'lake' },
      { name: 'The Whispering Wood', x: -18, z: -7, type: 'forest' },
      { name: 'Southroad', x: 2, z: 25, type: 'road' },
    ];
    for (const label of labels) {
      const [x, y] = toMap(label.x, label.z);
      ctx.save();
      ctx.translate(x, y);
      if (label.type === 'village') {
        ctx.fillStyle = 'rgba(231,204,128,.9)';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      } else if (label.type === 'stones') {
        ctx.strokeStyle = 'rgba(124,240,230,.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
      } else if (label.type === 'castle') {
        ctx.fillStyle = 'rgba(200,200,188,.9)';
        ctx.fillRect(-4, -4, 8, 8);
      }
      ctx.font = '600 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244,231,201,.92)';
      ctx.strokeStyle = 'rgba(8,12,9,.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(label.name, 0, -12);
      ctx.fillText(label.name, 0, -12);
      ctx.restore();
    }

    for (const npc of state.npcs) {
      const [x, y] = toMap(npc.x, npc.z);
      ctx.fillStyle = npc.quest ? '#f2d27e' : 'rgba(127,201,139,.75)';
      ctx.beginPath(); ctx.arc(x, y, npc.quest ? 4 : 2.6, 0, Math.PI * 2); ctx.fill();
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const [x, y] = toMap(enemy.x, enemy.z);
      ctx.fillStyle = 'rgba(207,91,81,.8)';
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    if (this.waypoint) {
      const [x, y] = toMap(this.waypoint.x, this.waypoint.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = '#f2d48a';
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.strokeStyle = 'rgba(242,212,138,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const player = state.player;
    const [px, py] = toMap(player.x, player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - (player.facing || 0));
    ctx.fillStyle = '#fff4d8';
    ctx.strokeStyle = 'rgba(20,18,10,.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(6, 7); ctx.lineTo(0, 3.6); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    const border = ctx.createLinearGradient(0, 0, w, h);
    border.addColorStop(0, 'rgba(232,204,136,.35)');
    border.addColorStop(0.5, 'rgba(232,204,136,.05)');
    border.addColorStop(1, 'rgba(232,204,136,.28)');
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  }

  openMap() {
    this.el.mapOverlay.hidden = false;
    this.drawBigMap(this.lastState);
  }

  update(state) {
    this.lastState = state;
    const p = state.player;
    this.el.hpValue.textContent = Math.round(p.hp);
    this.el.hpLiquid.style.height = `${clamp(p.hp / p.maxHp, 0, 1) * 100}%`;
    this.el.runValue.textContent = Math.round(p.run);
    this.el.runLiquid.style.height = `${clamp(p.run / p.maxRun, 0, 1) * 100}%`;
    this.el.coins.textContent = fmt(p.coins);
    const skill = state.skills.find((s) => s.id === state.activeSkill) || SKILLS[0];
    this.el.xpSkill.textContent = skill.name;
    const pct = clamp((skill.xp - skill.prev) / Math.max(1, skill.next - skill.prev), 0, 1);
    this.el.xpFill.style.width = `${pct * 100}%`;
    this.el.xpNumbers.textContent = `${fmt(skill.xp)} / ${fmt(skill.next)}`;
    this.drawMinimap(state);
    if (!this.el.mapOverlay.hidden) this.drawBigMap(state);
  }

  updateTime(dt) {
    this.timeMinutes += dt * 0.7;
    if (this.timeMinutes >= 24 * 60) this.timeMinutes -= 24 * 60;
    const total = Math.floor(this.timeMinutes);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    this.el.worldTime.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  renderHotbar(selectedId, inventory) {
    const counts = {};
    for (const item of inventory) {
      if (item) counts[item.id] = (counts[item.id] || 0) + item.count;
    }
    this.el.hotbar.innerHTML = HOTBAR.map((slot, index) => {
      const item = ITEMS[slot.id];
      const count = counts[slot.id] || (slot.id === 'home_rune' ? '' : '');
      const active = selectedId === slot.id;
      return `<button class="hotbar-slot${active ? ' active' : ''}" data-hotbar="${index}" data-id="${slot.id}" aria-label="${item.name}">
        <span class="hotbar-key">${slot.key}</span>
        ${icon(item.icon)}
        ${count ? `<span class="hotbar-count">${count}</span>` : ''}
        <span class="hotbar-name">${item.name}</span>
      </button>`;
    }).join('');
    this.el.hotbar.querySelectorAll('[data-hotbar]').forEach((btn) => {
      btn.addEventListener('click', () => this.callbacks.onHotbarClick?.(Number(btn.dataset.hotbar)));
      btn.addEventListener('mouseenter', (e) => this.showItemTooltip(e, btn.dataset.id));
      btn.addEventListener('mousemove', (e) => this.moveTooltip(e));
      btn.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  renderInventory(inventory, equippedId, selectedId) {
    const cells = [];
    for (let i = 0; i < 28; i++) {
      const item = inventory[i];
      if (!item) {
        cells.push('<div class="inv-slot" aria-hidden="true"></div>');
        continue;
      }
      const def = ITEMS[item.id];
      const equipped = equippedId === item.id || selectedId === item.id;
      cells.push(`<div class="inv-slot filled${equipped ? ' equipped' : ''}" data-inv="${i}" data-id="${item.id}" role="button" tabindex="0" aria-label="${def.name}">
        ${icon(def.icon)}${item.count > 1 ? `<span class="inv-qty">${item.count}</span>` : ''}
      </div>`);
    }
    this.el.inventory.innerHTML = cells.join('');
    this.el.inventory.querySelectorAll('[data-inv]').forEach((cell) => {
      cell.addEventListener('click', () => this.callbacks.onInventoryClick?.(Number(cell.dataset.inv)));
      cell.addEventListener('mouseenter', (e) => this.showItemTooltip(e, cell.dataset.id));
      cell.addEventListener('mousemove', (e) => this.moveTooltip(e));
      cell.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  renderSkills(skills, activeSkill) {
    this.el.skills.innerHTML = skills.map((s) => {
      const def = { attack: 'attack', woodcutting: 'woodcutting', mining: 'mining', defence: 'defence' }[s.id] || 'attack';
      return `<div class="skill-chip" data-skill="${s.id}">
        <span class="skill-icon">${icon(def)}</span>
        <span class="skill-meta"><span>${s.name}</span><b>${s.level}</b></span>
      </div>`;
    }).join('');
  }

  showItemTooltip(e, id) {
    const def = ITEMS[id];
    if (!def) return;
    this.el.tooltip.innerHTML = `<h4>${def.name}</h4><div class="tip-type">${def.type}</div><p>${def.desc}</p>${def.stat ? `<div class="tip-stat">${def.stat}</div>` : ''}`;
    this.el.tooltip.hidden = false;
    this.moveTooltip(e);
  }
  moveTooltip(e) {
    const pad = 14;
    const rect = this.el.tooltip.getBoundingClientRect();
    let x = e.clientX + 16;
    let y = e.clientY;
    if (x + rect.width > window.innerWidth - pad) x = e.clientX - rect.width - 16;
    this.el.tooltip.style.left = `${x}px`;
    this.el.tooltip.style.top = `${clamp(y, rect.height / 2 + pad, window.innerHeight - rect.height / 2 - pad)}px`;
  }
  hideTooltip() { this.el.tooltip.hidden = true; }

  setQuest(quest) {
    this.el.questTitle.textContent = quest.title;
    this.el.questText.innerHTML = quest.text;
    if (quest.objective) {
      this.el.questObjective.hidden = false;
      const pct = clamp(quest.objective.current / Math.max(1, quest.objective.total), 0, 1);
      this.el.questFill.style.width = `${pct * 100}%`;
      this.el.questCount.textContent = `${quest.objective.current} / ${quest.objective.total} ${quest.objective.label}`;
    } else {
      this.el.questObjective.hidden = true;
    }
    document.getElementById('questPanel').style.display = '';
  }

  setTarget(enemy) {
    if (!enemy) {
      this.el.target.hidden = true;
      return;
    }
    this.el.target.hidden = false;
    this.el.targetName.textContent = enemy.name;
    this.el.targetLevel.textContent = enemy.levelText;
    this.el.targetFill.style.width = `${clamp(enemy.hp / enemy.maxHp, 0, 1) * 100}%`;
    this.el.targetHp.textContent = `${Math.max(0, Math.ceil(enemy.hp))} / ${enemy.maxHp}`;
  }

  setPrompt(text) {
    if (!text) {
      this.el.context.hidden = true;
      return;
    }
    this.el.context.hidden = false;
    this.el.contextLabel.textContent = text;
  }

  setHarvest(label, pct) {
    if (label == null) {
      this.el.harvest.hidden = true;
      return;
    }
    this.el.harvest.hidden = false;
    this.el.harvestLabel.textContent = label;
    this.el.harvestFill.style.width = `${clamp(pct, 0, 1) * 100}%`;
  }

  chat(text, type = 'game', speaker = '') {
    const line = document.createElement('div');
    line.className = `chat-line ${type}`;
    line.dataset.tab = type === 'game' || type === 'exp' || type === 'good' || type === 'bad' ? 'game' : 'all';
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    line.innerHTML = `<span class="stamp">${stamp}</span>${speaker ? `<span class="speaker">${speaker}:</span> ` : ''}<span class="body">${text}</span>`;
    if (this.currentTab !== 'all' && line.dataset.tab !== this.currentTab) line.style.display = 'none';
    this.el.chatLog.appendChild(line);
    while (this.el.chatLog.children.length > 40) this.el.chatLog.removeChild(this.el.chatLog.firstChild);
    this.el.chatLog.scrollTop = this.el.chatLog.scrollHeight;
  }

  toast(text, type = '', glyph = '✦') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `<span class="toast-icon">${glyph}</span><span>${text}</span>`;
    this.el.toasts.appendChild(node);
    setTimeout(() => node.remove(), 5000);
  }

  openDialog({ name, text, portrait = '', actions = [] }) {
    this.el.dialogName.textContent = name;
    this.el.dialogText.innerHTML = text;
    this.el.dialogPortrait.textContent = portrait || name.charAt(0);
    this.el.dialogActions.innerHTML = '';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      if (action.primary) btn.classList.add('primary');
      btn.addEventListener('click', () => {
        if (action.close !== false) this.closeDialog();
        action.onClick?.();
      });
      this.el.dialogActions.appendChild(btn);
    }
    this.el.dialog.hidden = false;
    this.callbacks.onDialogOpen?.();
  }
  closeDialog() {
    this.el.dialog.hidden = true;
    this.callbacks.onDialogClose?.();
  }
  isDialogOpen() { return !this.el.dialog.hidden; }
  isChatFocused() { return document.activeElement === this.el.chatInput; }

  focusChat() { this.el.chatInput.focus(); }

  showLevelUp(skill, level) {
    this.el.levelupSkill.textContent = skill;
    this.el.levelupLevel.textContent = level;
    this.el.levelup.hidden = false;
    clearTimeout(this.levelupTimer);
    this.levelupTimer = setTimeout(() => { this.el.levelup.hidden = true; }, 3200);
  }

  damageFlash() {
    this.el.damageFlash.style.opacity = '0.85';
    setTimeout(() => { this.el.damageFlash.style.opacity = '0'; }, 120);
  }

  showDeath() { this.el.death.hidden = false; }
  hideDeath() { this.el.death.hidden = true; }

  setSoundMuted(muted) {
    this.el.soundIcon.classList.toggle('muted', muted);
    document.getElementById('soundToggle').title = muted ? 'Enable ambient sound' : 'Mute ambient sound';
  }

  showLocation() {
    this.el.locBanner.style.animation = 'none';
    void this.el.locBanner.offsetWidth;
    this.el.locBanner.style.animation = '';
  }
}
