'use strict';
/* Pin Pull: the "playable ad" that is actually just a little game.
   Engine (pure, testable in Node) + UI overlay (browser only). */
(function (root) {

// ================================================================ ENGINE ====
const W = 320, H = 540, R = 7, G = 900;
const CUP = { x0: 100, x1: 220, top: 432, bottom: 520 };
const HUES = ['#ff4fa3', '#ffd23f', '#4fe08a', '#a66bff'];

const NECK = { a: [122, 417], b: [266, 417] };
const pinL = y => ({ a: [163, y], b: [24, y] });
const pinR = y => ({ a: [157, y], b: [296, y] });
const pinFull = y => ({ a: [37, y], b: [296, y] });
const div = (y0, y1) => [160, y0, 160, y1];
const L = (kind, floor, n) => ({ kind, x0: 40, x1: 160, floor, n });
const Rt = (kind, floor, n) => ({ kind, x0: 160, x1: 280, floor, n });
const F = (kind, floor, n) => ({ kind, x0: 40, x1: 280, floor, n });

const LEVELS = [
  { Yf: 260, walls: [], pins: [pinFull(190)], groups: [F('color', 190, 12)], frac: 0.75, tip: 'Tap a pin to pull it!' },
  { Yf: 270, walls: [div(30, 205)], pins: [pinL(200), pinR(200), NECK],
    groups: [L('color', 200, 12), Rt('gray', 200, 10)], frac: 0.8, tip: 'Grey balls need colour before they reach the cup.' },
  { Yf: 300, walls: [div(30, 255)], pins: [pinL(140), pinL(250), pinR(250)],
    groups: [L('gray', 140, 10), L('color', 250, 10), Rt('color', 250, 10)], frac: 0.8 },
  { Yf: 300, walls: [div(30, 255)], pins: [pinL(140), pinL(250), pinR(250)],
    groups: [L('water', 140, 12), L('lava', 250, 8), Rt('color', 250, 14)], frac: 0.75, tip: 'Lava burns balls. Water cools lava.' },
  { Yf: 280, walls: [div(30, 230)], pins: [pinL(210), pinR(130), pinR(225), NECK],
    groups: [L('color', 210, 14), Rt('water', 130, 12), Rt('lava', 225, 8)], frac: 0.75 },
  { Yf: 280, walls: [div(30, 235)], pins: [pinL(130), pinL(230), pinR(230), NECK],
    groups: [L('color', 130, 12), L('gray', 230, 8), Rt('gray', 230, 8)], frac: 0.8 },
  { Yf: 300, walls: [div(30, 255)], pins: [pinL(140), pinL(250), pinR(140), pinR(250)],
    groups: [L('water', 140, 10), L('lava', 250, 6), Rt('gray', 140, 10), Rt('color', 250, 12)], frac: 0.75 },
  { Yf: 290, walls: [div(140, 255)], pins: [pinFull(130), pinL(250), pinR(250), NECK],
    groups: [F('color', 130, 14), L('lava', 250, 8), Rt('water', 250, 12)], frac: 0.75 },
  { Yf: 280, walls: [div(30, 226)], pins: [{ a: [163, 222], b: [24, 184] }, { a: [157, 222], b: [296, 184] }, NECK],
    groups: [L('color', 176, 12), Rt('gray', 176, 12)], frac: 0.8 },
  { Yf: 300, walls: [div(30, 255)], pins: [pinL(140), pinL(250), pinR(140), pinR(250), NECK],
    groups: [L('water', 140, 10), L('lava', 250, 6), Rt('gray', 140, 10), Rt('color', 250, 12)], frac: 0.75 },
];

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function buildWorld(levelIndex, opts = {}) {
  const def = LEVELS[levelIndex % LEVELS.length];
  const mirror = !!opts.mirror;
  const rnd = rngFrom(opts.seed || 1);
  const mx = x => mirror ? W - x : x;
  const walls = [];
  const poly = pts => { for (let i = 0; i + 3 < pts.length; i += 2) walls.push({ ax: mx(pts[i]), ay: pts[i + 1], bx: mx(pts[i + 2]), by: pts[i + 3], th: 3 }); };
  poly([40, 30, 40, def.Yf, 130, 410]);
  poly([280, 30, 280, def.Yf, 190, 410]);
  poly([CUP.x0 - 4, CUP.top, CUP.x0, CUP.bottom, CUP.x1, CUP.bottom, CUP.x1 + 4, CUP.top]);
  def.walls.forEach(poly);
  const pins = def.pins.map(p => {
    const ax = mx(p.a[0]), ay = p.a[1], bx = mx(p.b[0]), by = p.b[1];
    const len = Math.hypot(bx - ax, by - ay);
    return { ax, ay, bx, by, dx: (bx - ax) / len, dy: (by - ay) / len, len, off: 0, state: 'in', th: 4 };
  });
  const hueA = Math.floor(rnd() * HUES.length);
  const balls = [];
  let colorGroup = 0;
  def.groups.forEach(g => {
    let x0 = mx(g.x0), x1 = mx(g.x1); if (x0 > x1) [x0, x1] = [x1, x0];
    const hue = g.kind === 'color' ? HUES[(hueA + colorGroup++) % HUES.length] : null;
    const ix0 = x0 + 3 + R + 1.5, ix1 = x1 - 3 - R - 1.5;
    const stepX = 2 * R + 0.6, stepY = 12.4;
    let row = 0, placed = 0;
    while (placed < g.n) {
      const y = g.floor - 4 - R - 1.5 - row * stepY;
      for (let x = ix0 + (row % 2) * R; x <= ix1 + 0.01 && placed < g.n; x += stepX) {
        balls.push({ x: x + (rnd() - 0.5) * 0.6, y, vx: 0, vy: 0, kind: g.kind, hue, alive: true, inCup: false });
        placed++;
      }
      row++;
    }
  });
  const colorable = balls.filter(b => b.kind === 'color' || b.kind === 'gray').length;
  return {
    W, H, R, CUP, walls, pins, balls, def,
    target: Math.max(1, Math.round(colorable * def.frac)),
    colorIn: 0, result: null, reason: '', events: [], time: 0, calm: 0, settled: false, pulled: 0,
  };
}

function pinSeg(p) { return { ax: p.ax + p.dx * p.off, ay: p.ay + p.dy * p.off, bx: p.bx + p.dx * p.off, by: p.by + p.dy * p.off }; }

function collideSeg(b, ax, ay, bx, by, th) {
  const ex = bx - ax, ey = by - ay;
  const l2 = ex * ex + ey * ey;
  let t = l2 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + ex * t, py = ay + ey * t;
  let dx = b.x - px, dy = b.y - py;
  const d2 = dx * dx + dy * dy, min = R + th;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 1e-6;
  const nx = dx / d, ny = dy / d;
  b.x += nx * (min - d); b.y += ny * (min - d);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.25 * vn * nx; b.vy -= 1.25 * vn * ny; }
  b.vx *= 0.996; b.vy *= 0.996;
}

function interact(w, a, b) {
  if (a.inCup || b.inCup) return;
  if (b.kind === 'lava') [a, b] = [b, a];
  if (a.kind === 'lava') {
    if (b.kind === 'color' || b.kind === 'gray') { b.alive = false; w.events.push({ type: 'burn', x: b.x, y: b.y }); }
    else if (b.kind === 'water') { a.kind = 'stone'; b.kind = 'stone'; w.events.push({ type: 'steam', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); }
    else if (b.kind === 'stone') { a.kind = 'stone'; w.events.push({ type: 'steam', x: a.x, y: a.y }); }
    return;
  }
  if (a.kind === 'gray' && b.kind === 'color') { a.kind = 'color'; a.hue = b.hue; w.events.push({ type: 'paint', x: a.x, y: a.y, hue: b.hue }); }
  else if (b.kind === 'gray' && a.kind === 'color') { b.kind = 'color'; b.hue = a.hue; w.events.push({ type: 'paint', x: b.x, y: b.y, hue: a.hue }); }
}

function pull(w, i) {
  const p = w.pins[i];
  if (!p || p.state !== 'in' || w.result) return false;
  p.state = 'moving'; w.pulled++; w.calm = 0; w.settled = false;
  return true;
}

function step(w, dt) {
  const SUB = 4, h = dt / SUB;
  const balls = w.balls;
  for (let s = 0; s < SUB; s++) {
    w.pins.forEach(p => { if (p.state === 'moving') { p.off += 1100 * h; if (p.off >= p.len) { p.off = p.len; p.state = 'gone'; } } });
    for (const b of balls) {
      if (!b.alive) continue;
      b.vy += G * h;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 1100) { b.vx *= 1100 / sp; b.vy *= 1100 / sp; }
      b.x += b.vx * h; b.y += b.vy * h;
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (!a.alive) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (dx > 2 * R + 1 || dx < -2 * R - 1 || dy > 2 * R + 1 || dy < -2 * R - 1) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 < (2 * R + 1) * (2 * R + 1)) interact(w, a, b);
        if (!a.alive) break;
        if (!b.alive || d2 >= 4 * R * R) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, o = (2 * R - d) / 2;
        a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
        const vr = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vr < 0) { const j2 = -1.1 * vr / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny; }
      }
    }
    for (const b of balls) {
      if (!b.alive) continue;
      for (const s2 of w.walls) collideSeg(b, s2.ax, s2.ay, s2.bx, s2.by, s2.th);
      for (const p of w.pins) if (p.state !== 'gone') { const g = pinSeg(p); collideSeg(b, g.ax, g.ay, g.bx, g.by, p.th); }
      if (b.y > H + 40) b.alive = false;
    }
  }
  w.time += dt;
  if (w.result) return;
  // Cup bookkeeping
  let maxV = 0, potential = 0;
  for (const b of balls) {
    if (!b.alive) continue;
    if (!b.inCup && b.y > CUP.top + R && b.x > CUP.x0 - 6 && b.x < CUP.x1 + 6) {
      b.inCup = true;
      if (b.kind === 'color') w.colorIn++;
      else if (b.kind === 'gray') { w.result = 'fail'; w.reason = 'A grey ball got into the cup!'; }
      else if (b.kind === 'lava') { w.result = 'fail'; w.reason = 'Lava in the cup!'; }
    }
    if (b.kind === 'color' || b.kind === 'gray') potential++;
    maxV = Math.max(maxV, Math.abs(b.vx), Math.abs(b.vy));
  }
  if (w.result) return;
  if (w.colorIn >= w.target) { w.result = 'win'; return; }
  if (potential < w.target) { w.result = 'fail'; w.reason = 'Not enough balls left.'; return; }
  const moving = w.pins.some(p => p.state === 'moving');
  w.calm = (maxV < 14 && !moving) ? w.calm + dt : 0;
  w.settled = w.calm > 0.5;
  if (w.settled && w.pins.every(p => p.state === 'gone')) { w.result = 'fail'; w.reason = `Only ${w.colorIn} of ${w.target} made it.`; }
}

const Engine = { W, H, R, CUP, LEVELS, buildWorld, step, pull, pinSeg };
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
if (typeof document === 'undefined') return;

// ==================================================================== UI ====
const BANNERS = ['Only 2% can solve this!', 'IMPOSSIBLE LEVEL', 'Genius only 🧠', 'Can you beat it? 🤔',
  '99% FAIL THIS!', 'Your brain will thank you', 'Mom\'s favourite puzzle', 'Too easy? Prove it.'];
const store = AdShell.store;

function open({ onDone, rewards = { win: 15, fail: 8, skip: 5 } }) {
  const shell = AdShell.create({ rewards, onDone, onRetry: () => load(), onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); } });
  const ov = shell.el;
  const cv = shell.canvas;
  const ctx = cv.getContext('2d');
  let raf = 0, world = null, scale = 1, dpr = 1, sprites = {}, particles = [], resultShown = false, resultAt = 0;
  let levelNo = store.get('pp.level', 1);

  function load() {
    const idx = (levelNo - 1) % LEVELS.length;
    world = buildWorld(idx, { mirror: levelNo > 1 && Math.random() < 0.5, seed: (Math.random() * 1e9) | 0 });
    particles = []; resultShown = false; resultAt = 0; shell.hideResult();
    shell.setLevel(`Level ${levelNo.toLocaleString()} of 9,999`);
    shell.setBanner(BANNERS[(levelNo - 1) % BANNERS.length]);
    shell.setTip(world.def.tip || 'Pull the pins in the right order!');
  }

  function resize() {
    const stage = ov.querySelector('.pp-stage');
    const r = stage.getBoundingClientRect();
    scale = Math.min(r.width / W, r.height / H);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
    sprites = {};
  }

  function sprite(key, draw) {
    if (sprites[key]) return sprites[key];
    const pad = 8, s = (2 * R + pad * 2) * scale * dpr;
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(s);
    const g = c.getContext('2d'); g.scale(scale * dpr, scale * dpr); g.translate(R + pad, R + pad);
    draw(g);
    return (sprites[key] = c);
  }
  function ballSprite(b) {
    const key = b.kind === 'color' ? b.hue : b.kind;
    return sprite(key, g => {
      const base = { gray: '#a3a9b2', water: '#6cc8ff', stone: '#5b5f66', lava: '#ff5a1f' }[b.kind] || b.hue;
      if (b.kind === 'lava') { g.shadowColor = '#ffb03a'; g.shadowBlur = 8; }
      const gr = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
      gr.addColorStop(0, b.kind === 'stone' ? '#8a8f97' : '#ffffff');
      gr.addColorStop(0.28, base);
      gr.addColorStop(1, shade(base, -0.35));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
      if (b.kind === 'water') { g.globalAlpha = 0.6; g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, R * 0.55, 0.3, 1.6); g.stroke(); }
      if (b.kind === 'stone') { g.fillStyle = 'rgba(0,0,0,.25)'; [[2, 1], [-2, 3], [1, -2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); }); }
    });
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = v => Math.max(0, Math.min(255, Math.round(v + (f < 0 ? v * f : (255 - v) * f))));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  function draw() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // cup fill + label
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.moveTo(CUP.x0 - 4, CUP.top); ctx.lineTo(CUP.x0, CUP.bottom); ctx.lineTo(CUP.x1, CUP.bottom); ctx.lineTo(CUP.x1 + 4, CUP.top); ctx.fill();
    ctx.font = '700 26px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText(`${Math.min(world.colorIn, world.target)} / ${world.target}`, W / 2, (CUP.top + CUP.bottom) / 2 + 4);
    // balls
    const t = performance.now() / 1000;
    for (const b of world.balls) {
      if (!b.alive) continue;
      const sp = ballSprite(b);
      const sz = sp.width / (scale * dpr);
      let ox = 0, oy = 0;
      if (b.kind === 'lava') { ox = Math.sin(t * 9 + b.x) * 0.3; oy = Math.cos(t * 7 + b.y) * 0.3; }
      ctx.drawImage(sp, b.x - sz / 2 + ox, b.y - sz / 2 + oy, sz, sz);
    }
    // walls (glass)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [['rgba(40,20,90,.35)', 9], ['rgba(255,255,255,.92)', 6]]) {
      ctx.strokeStyle = pass[0]; ctx.lineWidth = pass[1];
      ctx.beginPath(); world.walls.forEach(s => { ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); }); ctx.stroke();
    }
    // pins
    world.pins.forEach((p, i) => {
      if (p.state === 'gone') return;
      const g = pinSeg(p);
      ctx.strokeStyle = '#7a4b00'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(g.ax, g.ay); ctx.lineTo(g.bx, g.by); ctx.stroke();
      ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(g.ax, g.ay); ctx.lineTo(g.bx, g.by); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(g.ax, g.ay - 1.5); ctx.lineTo(g.bx, g.by - 1.5); ctx.stroke();
      const hx = g.bx + p.dx * 9, hy = g.by + p.dy * 9;
      ctx.strokeStyle = '#7a4b00'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, Math.PI * 2); ctx.stroke();
      if (levelNo === 1 && world.pulled === 0 && i === 0) {
        const k = (t * 1.6) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(hx, hy, 12 + k * 18, 0, Math.PI * 2); ctx.stroke();
      }
    });
    // particles
    particles.forEach(q => {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      if (q.rect) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-3, -1.5, 6, 3); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  }

  function spawn(e) {
    if (e.type === 'paint') for (let i = 0; i < 6; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120, r: 1.6, color: e.hue, life: .4, max: .4 });
    if (e.type === 'burn') for (let i = 0; i < 8; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 50, vy: -30 - Math.random() * 50, r: 3 + Math.random() * 3, color: '#3a3a3a', life: .8, max: .8, grow: 6 });
    if (e.type === 'steam') for (let i = 0; i < 5; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 40, vy: -40 - Math.random() * 40, r: 3, color: '#ffffff', life: .7, max: .7, grow: 8 });
  }
  function confetti() {
    const cols = ['#ff4fa3', '#ffd23f', '#4fe08a', '#a66bff', '#6cc8ff', '#ffffff'];
    for (let i = 0; i < 120; i++) particles.push({ x: W / 2, y: CUP.top, vx: (Math.random() - .5) * 520, vy: -250 - Math.random() * 420, rect: true, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, color: cols[i % cols.length], life: 2.2, max: 2.2, g: 600 });
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
    while (acc >= 1 / 60) {
      step(world, 1 / 60); acc -= 1 / 60;
      world.events.splice(0).forEach(spawn);
      particles.forEach(q => { q.life -= 1 / 60; q.x += q.vx / 60; q.y += q.vy / 60; if (q.g) q.vy += q.g / 60; if (q.vr) q.rot += q.vr / 60; if (q.grow) q.r += q.grow / 60; });
      particles = particles.filter(q => q.life > 0);
    }
    if (world.result && !resultShown) {
      if (!resultAt) { resultAt = now; if (world.result === 'win') confetti(); }
      if (now - resultAt > (world.result === 'win' ? 900 : 700)) { resultShown = true; resultAt = 0; showResult(); }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function showResult() {
    const win = world.result === 'win';
    if (win) { levelNo++; store.set('pp.level', levelNo); }
    shell.showResult(win, world.reason);
  }

  cv.addEventListener('pointerdown', e => {
    if (world.result) return;
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
    let best = -1, bd = 26;
    world.pins.forEach((p, i) => {
      if (p.state !== 'in') return;
      const g = pinSeg(p);
      const ex = g.bx + p.dx * 9 - g.ax, ey = g.by + p.dy * 9 - g.ay;
      let t = ((x - g.ax) * ex + (y - g.ay) * ey) / (ex * ex + ey * ey); t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (g.ax + ex * t), y - (g.ay + ey * t));
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) pull(world, best);
  });

  window.addEventListener('resize', resize);
  load();
  requestAnimationFrame(() => { resize(); last = performance.now(); raf = requestAnimationFrame(frame); });
}

root.PinPull = { open, Engine };
})(typeof window !== 'undefined' ? window : globalThis);
