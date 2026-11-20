'use strict';
/* Parking Jam: tap cars to drive them out of a gridlocked lot.
   Engine (pure, testable in Node) + UI (browser only, uses AdShell). */
(function (root) {

// ================================================================ ENGINE ====
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const COLORS = ['#ff4d6d', '#ffb703', '#06d6a0', '#4cc9f0', '#9b5de5', '#f15bb5', '#fb8500', '#3a86ff', '#80ed99'];
const PATIENCE = 5;

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const horiz = c => c.dir === 'E' || c.dir === 'W';
function carCells(c) {
  const out = [];
  for (let i = 0; i < c.len; i++) out.push(horiz(c) ? [c.x + i, c.y] : [c.x, c.y + i]);
  return out;
}
function frontCell(c) {
  if (c.dir === 'E') return [c.x + c.len - 1, c.y];
  if (c.dir === 'S') return [c.x, c.y + c.len - 1];
  return [c.x, c.y];
}
function occupancy(cars) {
  const m = new Map();
  cars.forEach(c => { if (!c.gone) carCells(c).forEach(([x, y]) => m.set(x + ',' + y, c)); });
  return m;
}
// First car in this car's way, and how many free cells lie before it.
function blockerOf(lot, c, occ = occupancy(lot.cars)) {
  const [dx, dy] = DIRS[c.dir];
  let [x, y] = frontCell(c), gap = 0;
  for (;;) {
    x += dx; y += dy;
    if (x < 0 || y < 0 || x >= lot.cols || y >= lot.rows) return null;
    const o = occ.get(x + ',' + y);
    if (o) return { car: o, gap };
    gap++;
  }
}
// Peel off free cars round by round. Returns rounds needed, or -1 if stuck.
function solveDepth(lot) {
  const cars = lot.cars.map(c => ({ ...c, gone: false }));
  const tmp = { ...lot, cars };
  let left = cars.length, depth = 0;
  while (left) {
    const occ = occupancy(cars);
    const free = cars.filter(c => !c.gone && !blockerOf(tmp, c, occ));
    if (!free.length) return -1;
    free.forEach(c => { c.gone = true; });
    left -= free.length; depth++;
  }
  return depth;
}

function params(level) {
  if (level <= 1) return { cols: 5, rows: 5, n: 6, depth: 2 };
  if (level <= 3) return { cols: 6, rows: 6, n: 9, depth: 3 };
  if (level <= 6) return { cols: 6, rows: 7, n: 12, depth: 4 };
  if (level <= 10) return { cols: 7, rows: 8, n: 15, depth: 4 };
  return { cols: 7, rows: 8, n: 17, depth: 5 };
}

function generate(level, seed) {
  const P = params(level);
  const rnd = rngFrom(seed);
  let best = null, bestDepth = -1;
  for (let attempt = 0; attempt < 400; attempt++) {
    const cars = [];
    const occ = new Set();
    for (let t = 0; t < 600 && cars.length < P.n; t++) {
      const len = rnd() < 0.25 ? 3 : 2;
      const h = rnd() < 0.5;
      const dir = h ? (rnd() < 0.5 ? 'E' : 'W') : (rnd() < 0.5 ? 'N' : 'S');
      const x = Math.floor(rnd() * (P.cols - (h ? len - 1 : 0)));
      const y = Math.floor(rnd() * (P.rows - (h ? 0 : len - 1)));
      const c = { id: cars.length, x, y, len, dir };
      const cells = carCells(c);
      if (cells.some(([cx, cy]) => occ.has(cx + ',' + cy))) continue;
      cells.forEach(([cx, cy]) => occ.add(cx + ',' + cy));
      cars.push(c);
    }
    if (cars.length < P.n) continue;
    const lot = { cols: P.cols, rows: P.rows, cars };
    // Repair deadlocks by turning a stuck car around, a few times.
    let d = solveDepth(lot);
    for (let fix = 0; d < 0 && fix < 12; fix++) {
      const stuck = cars.filter(c => blockerOf(lot, c));
      const c = stuck[Math.floor(rnd() * stuck.length)];
      c.dir = { N: 'S', S: 'N', E: 'W', W: 'E' }[c.dir];
      d = solveDepth(lot);
    }
    if (d > bestDepth) { best = lot; bestDepth = d; }
    if (d >= P.depth) break;
  }
  best.cars.forEach((c, i) => { c.id = i; c.color = COLORS[Math.floor(rnd() * COLORS.length)]; c.gone = false; });
  best.depth = bestDepth;
  best.patience = PATIENCE;
  best.bumps = 0;
  return best;
}

// Player taps a car: returns { type: 'exit' } or { type: 'bump', blocker, gap }.
function tap(lot, car) {
  if (car.gone || lot.bumps >= lot.patience) return null;
  const b = blockerOf(lot, car);
  if (!b) { car.gone = true; return { type: 'exit' }; }
  lot.bumps++;
  return { type: 'bump', blocker: b.car, gap: b.gap };
}
const won = lot => lot.cars.every(c => c.gone);
const lost = lot => lot.bumps >= lot.patience;

const Engine = { generate, tap, won, lost, solveDepth, blockerOf, carCells, params };
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
if (typeof document === 'undefined') return;

// ==================================================================== UI ====
const BANNERS = ['Only 1% can clear this lot!', 'Rush hour MADNESS 🚗', 'Can you escape? 🤔', 'Genius drivers only 🧠',
  'IMPOSSIBLE PARKING', 'My dad couldn\'t do this', 'Satisfying!! 😍', 'Just one more level…'];
const ANGLE = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };

function open({ onDone, rewards = { win: 15, fail: 8, skip: 5 } }) {
  const store = AdShell.store;
  const shell = AdShell.create({ theme: 'pj', rewards, onDone, onRetry: () => load(true), onClose: () => { cancelAnimationFrame(raf); clearInterval(busT); window.removeEventListener('resize', resize); } });
  const cv = shell.canvas, ctx = cv.getContext('2d');
  let levelNo = store.get('pj.level', 1);
  let lot = null, seed = 0, raf = 0, cell = 40, dpr = 1, anim = {}, fx = [], ended = 0, resultShown = false, bus = 15, busT = 0;

  function load(retry) {
    if (!retry) seed = (Math.random() * 1e9) | 0;
    lot = generate(levelNo, seed);
    anim = {}; fx = []; ended = 0; resultShown = false;
    lot.cars.forEach(c => { anim[c.id] = { off: 0, v: 0, mode: 'park', t: 0, shake: 0 }; });
    shell.hideResult();
    shell.setLevel(`Level ${levelNo.toLocaleString()} of 9,999`);
    shell.setBanner(BANNERS[(levelNo - 1) % BANNERS.length]);
    bus = 15; clearInterval(busT);
    busT = setInterval(() => { bus = Math.max(0, bus - 1); tip(); if (!bus) clearInterval(busT); }, 1000);
    resize(); tip();
  }
  function tip() {
    const faces = '😊'.repeat(lot.patience - lot.bumps) + '😡'.repeat(lot.bumps);
    const busTxt = bus > 0 ? `🚌 Bus leaves in 0:${String(bus).padStart(2, '0')}` : '🚌 Bus left. It\'s fine.';
    shell.setTip(levelNo === 1 && !lot.cars.some(c => c.gone) && !lot.bumps
      ? 'Tap a car to drive it out. Don\'t crash!'
      : `<span class="pj-patience">Patience ${faces}</span> <span class="pj-bus">${busTxt}</span>`);
  }

  function resize() {
    if (!lot) return;
    const r = shell.stage.getBoundingClientRect();
    cell = Math.floor(Math.min(64, r.width / (lot.cols + 2), r.height / (lot.rows + 2)));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = cell * (lot.cols + 2), h = cell * (lot.rows + 2);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }

  // -------- drawing --------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shadeHex(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }
  function drawCar(c, cx, cy) {
    const L = c.len * cell - cell * 0.2, Wd = cell * 0.7;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ANGLE[c.dir]);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(-L / 2 + 2, -Wd / 2 + 3, L, Wd, cell * 0.16); ctx.fill();
    // wheels
    ctx.fillStyle = '#1d1d24';
    const wl = cell * 0.22, ww = cell * 0.1;
    [-L / 2 + cell * 0.18, L / 2 - cell * 0.4].forEach(x => { [-Wd / 2 - ww * 0.4, Wd / 2 - ww * 0.6].forEach(y => { rr(x, y, wl, ww, 2); ctx.fill(); }); });
    if (c.len === 3) {
      // truck: cargo box + cab
      const cab = cell * 0.85;
      ctx.fillStyle = '#f4f1ea'; rr(-L / 2, -Wd / 2, L - cab - cell * 0.04, Wd, cell * 0.08); ctx.fill();
      ctx.fillStyle = c.color; ctx.fillRect(-L / 2 + cell * 0.12, -cell * 0.06, L - cab - cell * 0.3, cell * 0.12);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5; rr(-L / 2, -Wd / 2, L - cab - cell * 0.04, Wd, cell * 0.08); ctx.stroke();
      ctx.fillStyle = c.color; rr(L / 2 - cab, -Wd / 2, cab, Wd, cell * 0.16); ctx.fill();
      ctx.strokeStyle = shadeHex(c.color, -0.35); rr(L / 2 - cab, -Wd / 2, cab, Wd, cell * 0.16); ctx.stroke();
      ctx.fillStyle = '#bfe9ff'; rr(L / 2 - cab * 0.45, -Wd / 2 + cell * 0.08, cab * 0.28, Wd - cell * 0.16, 3); ctx.fill();
    } else {
      const g = ctx.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
      g.addColorStop(0, shadeHex(c.color, 0.25)); g.addColorStop(0.5, c.color); g.addColorStop(1, shadeHex(c.color, -0.2));
      ctx.fillStyle = g; rr(-L / 2, -Wd / 2, L, Wd, cell * 0.2); ctx.fill();
      ctx.strokeStyle = shadeHex(c.color, -0.4); ctx.lineWidth = 1.5; ctx.stroke();
      // windows + roof
      ctx.fillStyle = '#bfe9ff';
      rr(L * 0.08, -Wd / 2 + cell * 0.09, L * 0.17, Wd - cell * 0.18, 4); ctx.fill();
      rr(-L * 0.36, -Wd / 2 + cell * 0.12, L * 0.11, Wd - cell * 0.24, 3); ctx.fill();
      ctx.fillStyle = shadeHex(c.color, 0.15); rr(-L * 0.24, -Wd / 2 + cell * 0.1, L * 0.31, Wd - cell * 0.2, 4); ctx.fill();
    }
    // direction chevron
    const ax = c.len === 3 ? -L / 2 + (L - cell * 0.85) / 2 : -L * 0.08, s2 = cell * 0.17;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = cell * 0.1;
    ctx.beginPath(); ctx.moveTo(ax - s2 * 0.5, -s2); ctx.lineTo(ax + s2 * 0.6, 0); ctx.lineTo(ax - s2 * 0.5, s2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = cell * 0.06;
    ctx.beginPath(); ctx.moveTo(ax - s2 * 0.5, -s2); ctx.lineTo(ax + s2 * 0.6, 0); ctx.lineTo(ax - s2 * 0.5, s2); ctx.stroke();
    // headlights
    ctx.fillStyle = '#fff6b0';
    [-Wd / 2 + cell * 0.1, Wd / 2 - cell * 0.18].forEach(y => { rr(L / 2 - cell * 0.09, y, cell * 0.07, cell * 0.08, 2); ctx.fill(); });
    ctx.restore();
  }

  function draw(now) {
    const W = cv.width / dpr, H = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // road
    ctx.fillStyle = '#3a3d4a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.setLineDash([cell * 0.3, cell * 0.25]);
    ctx.strokeRect(cell * 0.5, cell * 0.5, W - cell, H - cell);
    ctx.setLineDash([]);
    // lot
    ctx.fillStyle = '#5c6070'; rr(cell - 4, cell - 4, lot.cols * cell + 8, lot.rows * cell + 8, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < lot.cols; i++) { ctx.moveTo(cell + i * cell, cell + 4); ctx.lineTo(cell + i * cell, cell + lot.rows * cell - 4); }
    for (let j = 1; j < lot.rows; j++) { ctx.moveTo(cell + 4, cell + j * cell); ctx.lineTo(cell + lot.cols * cell - 4, cell + j * cell); }
    ctx.stroke();
    // cars: parked first, moving on top
    const list = lot.cars.filter(c => anim[c.id].mode !== 'done').sort((a, b) => (anim[a.id].mode === 'exit') - (anim[b.id].mode === 'exit'));
    list.forEach(c => {
      const a = anim[c.id];
      const cells = carCells(c);
      let cx = cell + (cells[0][0] + cells[cells.length - 1][0] + 1) / 2 * cell;
      let cy = cell + (cells[0][1] + cells[cells.length - 1][1] + 1) / 2 * cell;
      const [dx, dy] = DIRS[c.dir];
      cx += dx * a.off * cell; cy += dy * a.off * cell;
      if (a.shake > 0) { cx += Math.sin(now / 18) * a.shake * cell * 0.08; cy += Math.cos(now / 15) * a.shake * cell * 0.08; }
      drawCar(c, cx, cy);
      a.cx = cx; a.cy = cy;
    });
    // effects
    fx.forEach(f => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 1.5));
      if (f.text) {
        ctx.font = `${f.size || cell * 0.5}px "Lilita One", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (f.stroke) { ctx.lineWidth = 4; ctx.strokeStyle = '#3a1450'; ctx.strokeText(f.text, f.x, f.y); }
        ctx.fillStyle = f.color || '#fff'; ctx.fillText(f.text, f.x, f.y);
      } else if (f.rect) {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = f.color; ctx.fillRect(-4, -2, 8, 4); ctx.restore();
      } else { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  }

  // -------- animation --------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const W = cv.width / dpr, H = cv.height / dpr;
    lot.cars.forEach(c => {
      const a = anim[c.id];
      if (a.shake > 0) a.shake = Math.max(0, a.shake - dt * 3);
      if (a.mode === 'exit') {
        a.v = Math.min(a.v + 40 * dt, 24); a.off += a.v * dt;
        if (Math.random() < 0.3 && a.cx != null && a.v < 18) {
          const [dx, dy] = DIRS[c.dir];
          fx.push({ x: a.cx - dx * c.len * cell * 0.5, y: a.cy - dy * c.len * cell * 0.5, r: cell * 0.06, grow: cell * 0.3, color: 'rgba(230,230,240,.45)', life: 0.3, max: 0.3 });
        }
        if (a.cx != null && (a.cx < -cell * 3 || a.cy < -cell * 3 || a.cx > W + cell * 3 || a.cy > H + cell * 3)) a.mode = 'done';
      } else if (a.mode === 'bump') {
        a.t += dt;
        const reach = a.gap + 0.12, tf = 0.13, tb = 0.22;
        if (a.t < tf) a.off = reach * (a.t / tf) * (a.t / tf);
        else if (a.t < tf + tb) { if (!a.hit) { a.hit = true; hit(c, a); } a.off = reach * (1 - (a.t - tf) / tb); }
        else { a.off = 0; a.mode = 'park'; }
      }
    });
    fx.forEach(f => { f.life -= dt; if (f.vy) f.y += f.vy * dt; if (f.vx) f.x += f.vx * dt; if (f.g) f.vy += f.g * dt; if (f.grow) f.r += f.grow * dt; if (f.vr) f.rot += f.vr * dt; });
    fx = fx.filter(f => f.life > 0);

    if (!resultShown && (won(lot) || lost(lot))) {
      const settled = lot.cars.every(c => anim[c.id].mode === 'done' || anim[c.id].mode === 'park');
      if (settled) {
        if (!ended) { ended = now; if (won(lot)) confetti(W, H); }
        if (now - ended > (won(lot) ? 900 : 600)) {
          resultShown = true; clearInterval(busT);
          if (won(lot)) { levelNo++; store.set('pj.level', levelNo); shell.showResult(true); }
          else shell.showResult(false, 'The neighbours called the police. 🚓');
        }
      }
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  function hit(c, a) {
    const b = anim[a.blocker.id];
    b.shake = 1;
    const [dx, dy] = DIRS[c.dir];
    const hx = (a.cx || 0) + dx * c.len * cell * 0.5, hy = (a.cy || 0) + dy * c.len * cell * 0.5;
    fx.push({ text: 'HONK!', x: hx, y: hy - cell * 0.4, vy: -cell * 1.2, color: '#fff7b0', stroke: true, size: cell * 0.42, life: 0.8, max: 0.8 });
    fx.push({ text: '💢', x: b.cx || hx, y: (b.cy || hy) - cell * 0.5, vy: -cell * 0.6, size: cell * 0.5, life: 1, max: 1 });
    if (navigator.vibrate) try { navigator.vibrate(40); } catch { /* ignore */ }
    tip();
  }
  function confetti(W, H) {
    const cols = ['#ff4d6d', '#ffb703', '#06d6a0', '#4cc9f0', '#9b5de5', '#ffffff'];
    for (let i = 0; i < 110; i++) fx.push({ rect: true, x: W / 2, y: H * 0.6, vx: (Math.random() - .5) * W * 1.6, vy: -H * (0.6 + Math.random() * 0.9), g: H * 1.4, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, color: cols[i % cols.length], life: 2.2, max: 2.2 });
  }

  // -------- input --------
  cv.addEventListener('pointerdown', e => {
    if (resultShown || lost(lot)) return;
    const r = cv.getBoundingClientRect();
    const gx = Math.floor((e.clientX - r.left) / cell) - 1, gy = Math.floor((e.clientY - r.top) / cell) - 1;
    const car = lot.cars.find(c => !c.gone && anim[c.id].mode !== 'bump' && carCells(c).some(([x, y]) => x === gx && y === gy));
    if (!car) return;
    const res = tap(lot, car);
    if (!res) return;
    const a = anim[car.id];
    if (res.type === 'exit') { a.mode = 'exit'; a.v = 2; tip(); }
    else { Object.assign(a, { mode: 'bump', t: 0, gap: res.gap, blocker: res.blocker, hit: false }); }
  });

  root.ParkJam._debug = () => ({ lot, cell, anim });
  window.addEventListener('resize', resize);
  requestAnimationFrame(() => { load(false); last = performance.now(); raf = requestAnimationFrame(frame); });
}

root.ParkJam = { open, Engine };
})(typeof window !== 'undefined' ? window : globalThis);
