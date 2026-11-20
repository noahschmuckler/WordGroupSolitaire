'use strict';
/* Draw to Save: draw one line to shield a napping dog from a bee swarm.
   Engine (pure, testable in Node) + UI (browser only, uses AdShell). */
(function (root) {

// ================================================================ ENGINE ====
const W = 320, H = 480;
const DOG = { rx: 22, ry: 15 };          // dog hit ellipse
const NO_DRAW = 12;                      // extra margin you can't draw inside
const BEE_R = 4, LINE_TH = 2.5;

const flat = y => [[0, y, W, y]];
const LEVELS = [
  { ground: flat(400), dog: 205, hives: [[70, 110]], bees: 12, ink: 300, time: 8, tip: 'Draw ONE line to protect the doge!' },
  { ground: flat(400), dog: 110, hives: [[260, 100]], bees: 16, ink: 220, time: 9 },
  { ground: flat(400), dog: 160, hives: [[50, 100], [270, 100]], bees: 20, ink: 200, time: 10, tip: 'Two hives! Cover both sides.' },
  { ground: flat(400), dog: 160, hives: [[160, 80]], bees: 20, ink: 160, time: 10 },
  { ground: flat(445), ledges: [[110, 300, 230, 300]], dog: 170, dogOn: 300, hives: [[50, 130]], bees: 22, ink: 190, time: 10, tip: 'The ledge has your back. Literally.' },
  { ground: [[0, 400, 110, 400, 130, 445, 210, 445, 230, 400, 320, 400]], dog: 170, dogOn: 445, hives: [[270, 100]], bees: 24, ink: 150, time: 10, tip: 'Less ink. Use the hole!' },
  { ground: flat(400), dog: 280, hives: [[50, 110]], bees: 24, ink: 150, time: 10, tip: 'The edge of the screen is a wall.' },
  { ground: flat(400), dog: 225, hives: [[40, 318]], stump: true, bees: 26, ink: 180, time: 10 },
  { ground: flat(400), dog: 160, hives: [[40, 120], [280, 120]], bees: 28, ink: 170, time: 10 },
  { ground: [[0, 400, 100, 400, 160, 362, 220, 400, 320, 400]], dog: 160, dogOn: 362, hives: [[40, 100], [160, 70], [280, 100]], bees: 30, ink: 250, time: 10, tip: 'Final boss: three hives.' },
];

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function buildWorld(index, opts = {}) {
  const def = LEVELS[index % LEVELS.length];
  const m = opts.mirror ? x => W - x : x => x;
  const mp = pl => pl.map((v, i) => i % 2 ? v : m(v));
  const ground = def.ground.map(mp);
  const ledges = (def.ledges || []).map(mp);
  const segs = [];
  [...ground, ...ledges].forEach(pl => { for (let i = 0; i + 3 < pl.length; i += 2) segs.push([pl[i], pl[i + 1], pl[i + 2], pl[i + 3]]); });
  const base = def.dogOn || ground[0][1];
  return {
    W, H, def, ground, ledges, segs, mirror: !!opts.mirror,
    dog: { x: m(def.dog), y: base - DOG.ry - 1, base },
    hives: def.hives.map(([x, y]) => ({ x: m(x), y })),
    ink: def.ink, inkLeft: def.ink, stroke: [], phase: 'draw',
    bees: [], spawned: 0, total: def.bees, time: 0, duration: def.time,
    result: null, rnd: rngFrom(opts.seed || 1), stung: null,
  };
}

function inNoDraw(w, x, y) {
  const dx = (x - w.dog.x) / (DOG.rx + NO_DRAW), dy = (y - w.dog.y) / (DOG.ry + NO_DRAW);
  return dx * dx + dy * dy < 1;
}
// Returns false when the stroke has to end (out of ink or touched the dog zone).
function addPoint(w, x, y) {
  if (w.phase !== 'draw') return false;
  x = Math.max(0, Math.min(W, x)); y = Math.max(0, Math.min(H, y));
  if (inNoDraw(w, x, y)) return false;
  const s = w.stroke;
  if (!s.length) { s.push([x, y]); return true; }
  const [lx, ly] = s[s.length - 1];
  let d = Math.hypot(x - lx, y - ly);
  if (d < 4) return true;
  if (d > w.inkLeft) { const k = w.inkLeft / d; x = lx + (x - lx) * k; y = ly + (y - ly) * k; d = w.inkLeft; }
  s.push([x, y]); w.inkLeft -= d;
  return w.inkLeft > 0.5;
}
function release(w) {
  if (w.phase !== 'draw') return false;
  if (w.ink - w.inkLeft < 12) { w.stroke = []; w.inkLeft = w.ink; return false; }
  w.phase = 'swarm';
  for (let i = 1; i < w.stroke.length; i++) w.segs.push([...w.stroke[i - 1], ...w.stroke[i], 'ink']);
  return true;
}

function collide(b, s) {
  const [ax, ay, bx, by] = s;
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + ex * t, py = ay + ey * t;
  const dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy, min = BEE_R + LINE_TH;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
  b.x += nx * (min - d); b.y += ny * (min - d);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.3 * vn * nx; b.vy -= 1.3 * vn * ny; }
}

function step(w, dt) {
  if (w.phase !== 'swarm' || w.result) { w.time += w.phase === 'done' ? dt : 0; return; }
  const rnd = w.rnd, dog = w.dog;
  w.time += dt;
  // release bees over the first 1.5s
  const want = Math.min(w.total, Math.ceil(w.total * Math.min(1, w.time / 1.5)));
  while (w.spawned < want) {
    const h = w.hives[w.spawned % w.hives.length];
    const a = rnd() * Math.PI * 2;
    w.bees.push({ x: h.x + Math.cos(a) * 4, y: h.y + 6 + Math.sin(a) * 4, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 + 30,
      wa: rnd() * 6.28, sp: 105 + rnd() * 35, id: w.spawned });
    w.spawned++;
  }
  const SUB = 4, h = dt / SUB, bees = w.bees;
  for (let s = 0; s < SUB; s++) {
    for (const b of bees) {
      const tx = dog.x - b.x, ty = dog.y - b.y, d = Math.hypot(tx, ty) || 1;
      b.wa += (rnd() - 0.5) * 14 * h;
      const dx = tx / d * b.sp + Math.cos(b.wa) * 55, dy = ty / d * b.sp + Math.sin(b.wa) * 55;
      b.vx += (dx - b.vx) * 3 * h; b.vy += (dy - b.vy) * 3 * h;
      const sp = Math.hypot(b.vx, b.vy), mx = b.sp * 1.35;
      if (sp > mx) { b.vx *= mx / sp; b.vy *= mx / sp; }
      b.x += b.vx * h; b.y += b.vy * h;
    }
    for (let i = 0; i < bees.length; i++) for (let j = i + 1; j < bees.length; j++) {
      const a = bees[i], c = bees[j], dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < 64 && d2 > 1e-6) { const d = Math.sqrt(d2), o = (8 - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o; }
    }
    for (const b of bees) {
      for (const sg of w.segs) collide(b, sg);
      if (b.x < BEE_R) { b.x = BEE_R; b.vx = Math.abs(b.vx); }
      if (b.x > W - BEE_R) { b.x = W - BEE_R; b.vx = -Math.abs(b.vx); }
      if (b.y < BEE_R) { b.y = BEE_R; b.vy = Math.abs(b.vy); }
      if (b.y > H - BEE_R) { b.y = H - BEE_R; b.vy = -Math.abs(b.vy); }
      const ex = (b.x - dog.x) / (DOG.rx + BEE_R), ey = (b.y - dog.y) / (DOG.ry + BEE_R);
      if (ex * ex + ey * ey < 1) { w.result = 'fail'; w.stung = b; w.phase = 'done'; return; }
    }
  }
  if (w.time >= w.duration) { w.result = 'win'; w.phase = 'done'; }
}

const Engine = { W, H, LEVELS, DOG, NO_DRAW, buildWorld, addPoint, release, step, inNoDraw };
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
if (typeof document === 'undefined') return;

// ==================================================================== UI ====
const BANNERS = ['99% can\'t save the doge! 🐶', 'Draw ONE line', 'Save the doge!!', 'Only geniuses save him 🧠',
  'He is SO sleepy', 'Bees are angry today 🐝', 'Can you save him? 😭', 'Impossible doge level'];

function open({ onDone, rewards = { win: 15, fail: 8, skip: 5 } }) {
  const store = AdShell.store;
  const shell = AdShell.create({ theme: 'ds', rewards, onDone, onRetry: () => load(true),
    onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); } });
  const cv = shell.canvas, ctx = cv.getContext('2d');
  let levelNo = store.get('ds.level', 1);
  let w = null, scale = 1, dpr = 1, raf = 0, fx = [], drawing = false, ended = 0, resultShown = false, mirror = false, seed = 1;

  function load(retry) {
    if (!retry) { mirror = levelNo > 1 && Math.random() < 0.5; seed = (Math.random() * 1e9) | 0; }
    w = buildWorld((levelNo - 1) % LEVELS.length, { mirror, seed });
    fx = []; ended = 0; resultShown = false; drawing = false;
    shell.hideResult();
    shell.setLevel(`Level ${levelNo.toLocaleString()} of 9,999`);
    shell.setBanner(BANNERS[(levelNo - 1) % BANNERS.length]);
    shell.setTip(w.def.tip || 'Draw a line, then survive the swarm!');
  }
  function resize() {
    const r = shell.stage.getBoundingClientRect();
    scale = Math.min(r.width / W, r.height / H);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  }

  // ------- scene -------
  function drawScene(t) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#9fdcff'); sky.addColorStop(1, '#e9f8ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    [[60, 50, 1], [230, 34, .8], [180, 150, .6]].forEach(([x, y, s]) => {
      [[0, 0, 20], [18, -6, 16], [34, 2, 14], [-16, 4, 12]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); });
    });
    // ground
    w.ground.forEach(pl => {
      ctx.beginPath(); ctx.moveTo(pl[0], H);
      for (let i = 0; i < pl.length; i += 2) ctx.lineTo(pl[i], pl[i + 1]);
      ctx.lineTo(pl[pl.length - 2], H); ctx.closePath();
      const g = ctx.createLinearGradient(0, 360, 0, H); g.addColorStop(0, '#86d86f'); g.addColorStop(1, '#4fae5a');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#3f9442'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath(); for (let i = 0; i < pl.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pl[i], pl[i + 1]); ctx.stroke();
    });
    w.ledges.forEach(pl => {
      const x0 = Math.min(pl[0], pl[2]), x1 = Math.max(pl[0], pl[2]), y = pl[1];
      ctx.fillStyle = '#9b6a3c'; roundRect(x0, y, x1 - x0, 16, 6); ctx.fill();
      ctx.fillStyle = '#7fd06a'; roundRect(x0 - 2, y - 2, x1 - x0 + 4, 7, 4); ctx.fill();
    });
    // branches / stump + hives
    w.hives.forEach(hv => {
      ctx.strokeStyle = '#8a5a2b'; ctx.lineCap = 'round';
      if (w.def.stump) { ctx.fillStyle = '#8a5a2b'; ctx.fillRect(hv.x - 8, hv.y + 14, 16, w.dog.base - hv.y - 14); }
      else {
        ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(hv.x + (hv.x < W / 2 ? -40 : 40), 0); ctx.quadraticCurveTo(hv.x, hv.y - 40, hv.x, hv.y - 18); ctx.stroke();
      }
      const shake = w.phase === 'swarm' && w.time < 1.5 ? Math.sin(t * 60) * 1.5 : 0;
      drawHive(hv.x + shake, hv.y);
    });
  }
  function roundRect(x, y, ww, hh, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath();
  }
  function drawHive(x, y) {
    const bands = [[-12, 9], [-4, 13], [5, 14], [13, 10]];
    bands.forEach(([dy, rx], i) => {
      ctx.fillStyle = i % 2 ? '#f7c548' : '#f2a93b'; ctx.strokeStyle = '#b8751a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y + dy, rx, 6, 0, 0, 7); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.ellipse(x, y + 6, 4, 3, 0, 0, 7); ctx.fill();
  }

  function drawDog(t) {
    const d = w.dog, face = mirror ? 1 : -1; // head on the left unless mirrored
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(-face, 1);
    const shiver = w.phase === 'swarm' ? Math.sin(t * 50) * 0.6 : 0;
    ctx.translate(shiver, 0);
    // tail
    ctx.strokeStyle = '#d98e45'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const wag = w.result === 'win' ? Math.sin(t * 20) * 6 : 0;
    ctx.beginPath(); ctx.moveTo(-18, 2); ctx.quadraticCurveTo(-30, -8 + wag, -22, -14 + wag); ctx.stroke();
    // body
    ctx.fillStyle = '#eaa860'; ctx.beginPath(); ctx.ellipse(0, 3, 20, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fbe3c2'; ctx.beginPath(); ctx.ellipse(2, 9, 13, 5, 0, 0, 7); ctx.fill();
    // paws
    ctx.fillStyle = '#fbe3c2'; [[10, 13], [17, 12]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 5, 3, 0, 0, 7); ctx.fill(); });
    // head
    ctx.fillStyle = '#eaa860'; ctx.beginPath(); ctx.arc(16, -4, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#fbe3c2'; ctx.beginPath(); ctx.ellipse(22, 0, 7, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8702f'; ctx.beginPath(); ctx.moveTo(8, -11); ctx.lineTo(10, -22); ctx.lineTo(16, -14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(17, -14); ctx.lineTo(23, -22); ctx.lineTo(24, -11); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(27, -1, 2.2, 0, 7); ctx.fill();
    // eyes
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.6; ctx.fillStyle = '#222';
    if (w.result === 'fail') { [[14, -6], [20, -6]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x - 2, y + 2); ctx.stroke(); }); }
    else if (w.result === 'win') { [[14, -6], [20, -6]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y + 1, 2.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }); }
    else if (w.phase === 'swarm') { [[14, -6], [20, -6]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 7); ctx.fill(); }); }
    else { [[14, -5], [20, -5]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y - 1, 2.2, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }); }
    if (w.phase === 'swarm') { ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.moveTo(8, -14); ctx.quadraticCurveTo(5, -8, 8, -7); ctx.quadraticCurveTo(11, -8, 8, -14); ctx.fill(); }
    ctx.restore();
    // Zzz / reactions
    ctx.font = '700 13px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center';
    if (w.phase === 'draw') {
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.6) + i / 3) % 1;
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#4a5a8a';
        ctx.fillText('z', d.x - face * 18 - face * k * 14, d.y - 22 - k * 26);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawBee(b, t) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    const flap = Math.sin(t * 50 + b.id) * 0.5 + 0.5;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.ellipse(-1, -4, 3.2, 2 + flap * 1.2, -0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-1, 4, 3.2, 2 + flap * 1.2, 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2116'; ctx.fillRect(-2.5, -3.4, 1.6, 6.8); ctx.fillRect(0.6, -3.5, 1.6, 7);
    ctx.beginPath(); ctx.arc(4.2, 0, 1.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawHud(t) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (w.phase === 'draw') {
      const bw = 150, x = W / 2 - bw / 2, y = 14;
      ctx.fillStyle = 'rgba(40,30,70,.25)'; roundRect(x, y, bw, 12, 6); ctx.fill();
      const f = w.inkLeft / w.ink;
      ctx.fillStyle = f > 0.25 ? '#5b3cf5' : '#ff4f6d'; roundRect(x, y, Math.max(12, bw * f), 12, 6); ctx.fill();
      ctx.font = '14px system-ui'; ctx.fillText('✏️', x - 12, y + 6);
    } else {
      const left = Math.max(0, Math.ceil(w.duration - w.time));
      ctx.font = '400 34px "Lilita One", system-ui, sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = '#3a1450'; ctx.fillStyle = '#fff';
      const txt = w.result === 'win' ? 'SAVED!' : w.result === 'fail' ? 'OUCH!' : String(left);
      ctx.strokeText(txt, W / 2, 34); ctx.fillText(txt, W / 2, 34);
    }
  }

  function drawHint(t) {
    if (levelNo !== 1 || w.phase !== 'draw' || w.stroke.length) return;
    const d = w.dog, r = 50, k = (t * 0.45) % 1;
    ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(91,60,245,.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(d.x, d.base, r, Math.PI, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const a = Math.PI + Math.PI * k;
    ctx.font = '34px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('👆', d.x + Math.cos(a) * r + 4, d.base + Math.sin(a) * r - 2);
  }

  function draw(now) {
    const t = now / 1000;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    drawScene(t);
    // no-draw zone hint while drawing
    if (w.phase === 'draw' && drawing) {
      ctx.fillStyle = 'rgba(255,80,100,.12)'; ctx.strokeStyle = 'rgba(255,80,100,.5)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(w.dog.x, w.dog.y, DOG.rx + NO_DRAW, DOG.ry + NO_DRAW, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
    drawDog(t);
    // the ink line
    if (w.stroke.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 7;
      ctx.beginPath(); w.stroke.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 2) : ctx.moveTo(x, y + 2))); ctx.stroke();
      ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 5;
      ctx.beginPath(); w.stroke.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
    w.bees.forEach(b => drawBee(b, t));
    drawHint(t);
    fx.forEach(f => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 1.5));
      if (f.text) { ctx.font = `${f.size}px "Lilita One", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
      else { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = f.color; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    });
    ctx.globalAlpha = 1;
    drawHud(t);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const was = w.result;
    step(w, dt);
    if (!was && w.result) {
      if (w.result === 'win') {
        confetti();
        for (let i = 0; i < 5; i++) fx.push({ text: '❤️', x: w.dog.x + (Math.random() - .5) * 30, y: w.dog.y - 20, vy: -30 - Math.random() * 30, size: 14, color: '#f44', life: 1.6, max: 1.6 });
      } else {
        fx.push({ text: '💥', x: w.stung.x, y: w.stung.y, vy: -10, size: 26, color: '#fff', life: 1, max: 1 });
        if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch { /* ignore */ }
      }
    }
    if (w.result === 'win') w.bees.forEach(b => { b.vy -= 400 * dt; b.y += b.vy * dt; b.x += b.vx * dt; });
    fx.forEach(f => { f.life -= dt; if (f.vy) f.y += f.vy * dt; if (f.vx) f.x += f.vx * dt; if (f.g) f.vy += f.g * dt; if (f.vr) f.rot += f.vr * dt; });
    fx = fx.filter(f => f.life > 0);
    if (w.result && !resultShown) {
      if (!ended) ended = now;
      if (now - ended > (w.result === 'win' ? 1200 : 900)) {
        resultShown = true;
        if (w.result === 'win') { levelNo++; store.set('ds.level', levelNo); shell.showResult(true); }
        else shell.showResult(false, 'The doge got stung! 😭');
      }
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  function confetti() {
    const cols = ['#ff4fa3', '#ffd23f', '#4fe08a', '#a66bff', '#6cc8ff', '#ffffff'];
    for (let i = 0; i < 100; i++) fx.push({ x: w.dog.x, y: w.dog.y, vx: (Math.random() - .5) * 420, vy: -200 - Math.random() * 380, g: 600, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, color: cols[i % cols.length], life: 2, max: 2 });
  }

  // ------- input -------
  const toWorld = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]; };
  cv.addEventListener('pointerdown', e => {
    if (w.phase !== 'draw') return;
    const [x, y] = toWorld(e);
    if (inNoDraw(w, x, y)) { fx.push({ text: '🚫', x, y, vy: -20, size: 18, color: '#fff', life: .6, max: .6 }); return; }
    drawing = true; w.stroke = []; w.inkLeft = w.ink;
    try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    addPoint(w, x, y);
  });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const [x, y] = toWorld(ev);
      if (!addPoint(w, x, y)) { finishStroke(); break; }
    }
  });
  const finishStroke = () => { if (!drawing) return; drawing = false; release(w); };
  cv.addEventListener('pointerup', finishStroke);
  cv.addEventListener('pointercancel', finishStroke);

  root.DrawSave._debug = () => w;
  window.addEventListener('resize', resize);
  load(false);
  requestAnimationFrame(() => { resize(); last = performance.now(); raf = requestAnimationFrame(frame); });
}

root.DrawSave = { open, Engine };
})(typeof window !== 'undefined' ? window : globalThis);
