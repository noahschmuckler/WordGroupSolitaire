'use strict';
/* Crowd Run: steer a crowd through maths gates, dodge hazards, out-number the
   enemy at the finish. Engine (pure, testable in Node) + UI (uses AdShell). */
(function (root) {

// ================================================================ ENGINE ====
const W = 320, X0 = 30, X1 = 290, MID = 160, SPEED = 125, LAT = 360;
const SPACING = 5.2, DMAX = 120, GA = Math.PI * (3 - Math.sqrt(5));
const FORM = Array.from({ length: DMAX }, (_, i) => {
  const r = SPACING * Math.sqrt(i + 0.5), a = i * GA;
  return [r * Math.cos(a), r * Math.sin(a)];
});
const shown = n => Math.max(0, Math.min(DMAX, Math.round(n)));
const radius = n => SPACING * Math.sqrt(Math.max(1, shown(n)));

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

function applyOp(n, g) {
  if (g.op === '+') return n + g.v;
  if (g.op === '×') return n * g.v;
  if (g.op === '−') return Math.max(0, n - g.v);
  return Math.ceil(n / g.v);
}
const good = g => g.op === '+' || g.op === '×';

function params(level) {
  if (level <= 1) return { gates: 4, obs: 1, saws: 0, frac: 0.55 };
  if (level <= 2) return { gates: 5, obs: 1, saws: 0, frac: 0.6 };
  if (level <= 4) return { gates: 6, obs: 2, saws: 1, frac: 0.62 };
  if (level <= 7) return { gates: 7, obs: 3, saws: 1, frac: 0.66 };
  return { gates: 8, obs: 4, saws: 2, frac: 0.7 };
}

function randGate(rnd, wantGood) {
  if (wantGood) return rnd() < 0.55 ? { op: '+', v: ri(rnd, 4, 25) } : { op: '×', v: ri(rnd, 2, 3) };
  return rnd() < 0.6 ? { op: '−', v: ri(rnd, 4, 15) } : { op: '÷', v: ri(rnd, 2, 3) };
}

function generate(level, seed) {
  const P = params(level);
  const rnd = rngFrom(seed);
  for (let attempt = 0; attempt < 500; attempt++) {
    const start = 10;
    const rows = [];
    for (let i = 0; i < P.gates; i++) {
      const bothGood = rnd() < 0.3;
      let a = randGate(rnd, true), b = randGate(rnd, bothGood);
      if (bothGood && a.op === b.op) b = a.op === '+' ? { op: '×', v: ri(rnd, 2, 3) } : { op: '+', v: ri(rnd, 8, 25) };
      const [left, right] = rnd() < 0.5 ? [a, b] : [b, a];
      rows.push({ type: 'gate', y: 260 + i * 240, left, right });
    }
    // hazards sit midway between gates
    const gaps = [...Array(P.gates - 1).keys()].sort(() => rnd() - 0.5).slice(0, P.obs);
    gaps.forEach((g, k) => {
      const y = 260 + g * 240 + 120;
      if (k < P.saws) rows.push({ type: 'saw', y, x0: rnd() < 0.5 ? X0 + 20 : MID + 10, w: 110, r: 18, speed: 1.6 + rnd() * 1.2, phase: rnd() * 6.28 });
      else {
        const kind = ri(rnd, 0, 2); // left, right, middle block
        const bw = 120 + ri(rnd, 0, 20);
        const bx0 = kind === 0 ? X0 : kind === 1 ? X1 - bw : MID - bw / 2;
        rows.push({ type: 'block', y, x0: bx0, x1: bx0 + bw });
      }
    });
    rows.sort((a, b) => a.y - b.y);
    let best = start, worst = start;
    rows.forEach(r => { if (r.type === 'gate') { best = Math.max(applyOp(best, r.left), applyOp(best, r.right)); worst = Math.min(applyOp(worst, r.left), applyOp(worst, r.right)); } });
    if (best > 900 || best < 40) continue;
    const enemy = Math.round(best * P.frac);
    if (worst >= enemy * 0.8) continue;
    const length = rows[rows.length - 1].y + 260;
    const course = { rows, start, enemy, best, worst, length, level };
    // Make sure a sensible player arrives with a comfortable lead.
    const sim = newRun(course);
    for (let f = 0; f < 60 * 60 && sim.phase === 'run'; f++) { sim.tx = botTarget(sim, true); step(sim, 1 / 60); sim.events.length = 0; }
    if (sim.phase !== 'battle' || sim.n < enemy * 1.15) continue;
    return course;
  }
  throw new Error('generation failed');
}

function newRun(course) {
  return { course, d: 0, t: 0, cx: MID, tx: MID, n: course.start, enemy: course.enemy, phase: 'run',
    result: null, next: 0, events: [], battleT: 0 };
}

function sawX(r, t) { return r.x0 + r.w / 2 + Math.sin(t * r.speed + r.phase) * r.w / 2; }

// Fraction of the crowd's members whose x falls inside [a, b].
function lostFraction(w, a, b) {
  const D = shown(w.n); if (!D) return 0;
  const sc = 1;
  let hit = 0;
  const xs = [];
  for (let i = 0; i < D; i++) { const x = w.cx + FORM[i][0] * sc; if (x >= a && x <= b) { hit++; xs.push([x, FORM[i][1]]); } }
  return { f: hit / D, xs };
}

function step(w, dt) {
  w.t += dt;
  if (w.phase === 'run') {
    w.d += SPEED * dt;
    const r = radius(w.n);
    const lo = X0 + Math.min(r, 60) * 0.6, hi = X1 - Math.min(r, 60) * 0.6;
    const tx = Math.max(lo, Math.min(hi, w.tx));
    const dx = tx - w.cx, mv = LAT * dt;
    w.cx += Math.abs(dx) < mv ? dx : Math.sign(dx) * mv;
    const rows = w.course.rows;
    while (w.next < rows.length && w.d >= rows[w.next].y) {
      const row = rows[w.next++];
      if (row.type === 'gate') {
        const left = w.cx < MID, g = left ? row.left : row.right;
        const before = w.n;
        w.n = applyOp(w.n, g);
        w.events.push({ type: 'gate', row, left, delta: w.n - before });
      } else {
        let a, b;
        if (row.type === 'block') { a = row.x0; b = row.x1; }
        else { const sx = sawX(row, w.t); a = sx - row.r - 3; b = sx + row.r + 3; }
        const { f, xs } = lostFraction(w, a, b);
        const lost = f > 0 ? Math.max(1, Math.round(w.n * f)) : 0;
        w.n -= lost;
        w.events.push({ type: 'hit', row, lost, xs });
      }
      if (w.n <= 0) { w.n = 0; w.phase = 'done'; w.result = 'fail'; w.reason = 'Your whole crowd got squished!'; return; }
    }
    if (w.d >= w.course.length) { w.phase = 'battle'; w.battleT = 0; }
  } else if (w.phase === 'battle') {
    w.battleT += dt;
    if (w.battleT < 0.6) return;               // crowds charge
    const k = Math.max(1, Math.ceil(Math.min(w.n, w.enemy) * 3 * dt));
    w.n = Math.max(0, w.n - k); w.enemy = Math.max(0, w.enemy - k);
    w.events.push({ type: 'clash', k });
    if (w.enemy <= 0 || w.n <= 0) {
      w.phase = 'done';
      w.result = w.n > 0 ? 'win' : 'fail';
      w.reason = w.result === 'fail' ? 'Their crowd was bigger. 😤' : '';
    }
  }
}

// Reference driver used by tests: aim for the better (or worse) gate, dodge hazards.
function botTarget(w, smart = true) {
  const rows = w.course.rows;
  const row = rows[w.next];
  if (!row) return MID;
  const nextGate = rows.slice(w.next).find(r => r.type === 'gate');
  const gateX = g => {
    if (!g) return MID;
    const l = applyOp(w.n, g.left), r = applyOp(w.n, g.right);
    const left = smart ? l >= r : l < r;
    return left ? (X0 + MID) / 2 : (MID + X1) / 2;
  };
  if (row.type === 'gate') return gateX(row);
  const want = gateX(nextGate);
  const rad = radius(w.n) + 2;
  let a, b;
  if (row.type === 'block') { a = row.x0; b = row.x1; }
  else { const tc = w.t + (row.y - w.d) / SPEED; const sx = sawX(row, tc); a = sx - row.r - 3; b = sx + row.r + 3; }
  if (!smart) return want;
  const cands = [];
  for (let x = X0 + 10; x <= X1 - 10; x += 5) { if (x + rad < a || x - rad > b) cands.push(x); }
  if (!cands.length) return a - X0 > X1 - b ? X0 : X1;
  return cands.reduce((p, c) => Math.abs(c - want) < Math.abs(p - want) ? c : p);
}

const Engine = { W, X0, X1, MID, SPEED, FORM, generate, newRun, step, botTarget, applyOp, sawX, radius, shown, good };
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
if (typeof document === 'undefined') return;

// ==================================================================== UI ====
const BANNERS = ['Only 1% pick the right gate!', 'Choose wisely 🤔', '×2 or +20?? 🧠', 'Can your army win?',
  'BIGGEST CROWD WINS', 'Math was never this fun', 'Don\'t pick the red one!', 'Unstoppable crowd 💪'];
const H = 520, PY = 410;   // player's screen y

function open({ onDone, rewards = { win: 15, fail: 8, skip: 5 } }) {
  const store = AdShell.store;
  const shell = AdShell.create({ theme: 'cr', rewards, onDone, onRetry: () => load(true),
    onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); } });
  const cv = shell.canvas, ctx = cv.getContext('2d');
  let levelNo = store.get('cr.level', 1);
  let course = null, w = null, seed = 1, scale = 1, dpr = 1, raf = 0, fx = [], flashes = [], ended = 0, resultShown = false, started = false;
  const keys = { left: false, right: false };

  function load(retry) {
    if (!retry) seed = (Math.random() * 1e9) | 0;
    course = generate(levelNo, seed);
    w = newRun(course);
    fx = []; flashes = []; ended = 0; resultShown = false; started = false;
    shell.hideResult();
    shell.setLevel(`Level ${levelNo.toLocaleString()} of 9,999`);
    shell.setBanner(BANNERS[(levelNo - 1) % BANNERS.length]);
    shell.setTip(`Drag to steer. Beat their <b>${course.enemy}</b> at the finish!`);
  }
  function resize() {
    const r = shell.stage.getBoundingClientRect();
    scale = Math.min(r.width / W, r.height / H);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  }
  const sy = y => PY - (y - w.d);

  function rr(x, y, ww, hh, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath();
  }
  function person(x, y, color, t, i) {
    const bob = Math.sin(t * 14 + i) * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 3.4, 1.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y + bob, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x - 1, y - 1.2 + bob, 1.3, 0, 7); ctx.fill();
  }
  function bubble(x, y, n, color) {
    const txt = String(n);
    ctx.font = '400 15px "Lilita One", system-ui, sans-serif';
    const tw = ctx.measureText(txt).width + 14;
    ctx.fillStyle = color; rr(x - tw / 2, y - 11, tw, 22, 11); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 1);
  }

  function draw(now) {
    const t = now / 1000;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    // backdrop + track
    ctx.fillStyle = '#7fd4ff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9be37f';
    ctx.fillRect(0, 0, X0 - 6, H); ctx.fillRect(X1 + 6, 0, W - X1 - 6, H);
    ctx.fillStyle = '#f3ecff'; ctx.fillRect(X0, 0, X1 - X0, H);
    ctx.fillStyle = '#e6dcff';
    const off = w.d % 40;
    for (let y = -40; y < H + 40; y += 40) ctx.fillRect(X0, y + off, X1 - X0, 20);
    ctx.fillStyle = '#c7b6ff'; ctx.fillRect(X0 - 6, 0, 6, H); ctx.fillRect(X1, 0, 6, H);
    ctx.strokeStyle = 'rgba(120,90,200,.25)'; ctx.setLineDash([10, 10]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(MID, 0); ctx.lineTo(MID, H); ctx.stroke(); ctx.setLineDash([]);
    // finish + enemy
    const fy = sy(course.length);
    if (fy > -80) {
      for (let i = 0; i < 13; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#222' : '#fff'; ctx.fillRect(X0 + i * 20, fy + j * 10, 20, 10); }
      const ey = fy - 70 + (w.phase === 'battle' ? Math.min(1, w.battleT / 0.6) * 40 : 0);
      const D = Engine.shown(w.enemy);
      for (let i = 0; i < D; i++) person(MID + FORM[i][0], ey - FORM[i][1] * 0.8, '#ff4d6d', t, i + 50);
      if (w.enemy > 0) bubble(MID, ey - Engine.radius(w.enemy) - 18, w.enemy, '#e23a5a');
    }
    // rows
    course.rows.forEach((row, idx) => {
      const y = sy(row.y);
      if (y < -60 || y > H + 60) return;
      if (row.type === 'gate') {
        const passed = idx < w.next;
        [[row.left, X0, MID], [row.right, MID, X1]].forEach(([g, a, b], k) => {
          const chosen = passed && flashes.find(f => f.row === row && f.left === (k === 0));
          ctx.globalAlpha = passed ? (chosen ? Math.max(0, chosen.life) : 0.15) : 1;
          const col = good(g) ? ['rgba(56,176,255,.75)', '#1f7fd1'] : ['rgba(255,77,109,.75)', '#c92a4a'];
          ctx.fillStyle = col[0]; rr(a + 3, y - 30, b - a - 6, 30, 6); ctx.fill();
          ctx.strokeStyle = col[1]; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.font = '400 22px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.strokeText(g.op + g.v, (a + b) / 2, y - 14);
          ctx.fillStyle = '#fff'; ctx.fillText(g.op + g.v, (a + b) / 2, y - 14);
          ctx.globalAlpha = 1;
        });
      } else if (row.type === 'block') {
        ctx.fillStyle = '#5b4a8a'; rr(row.x0, y - 14, row.x1 - row.x0, 14, 4); ctx.fill();
        ctx.fillStyle = '#ffd23f';
        for (let x = row.x0 + 6; x < row.x1 - 4; x += 12) { ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 5, y - 22); ctx.lineTo(x + 10, y - 14); ctx.fill(); }
      } else {
        ctx.strokeStyle = 'rgba(91,74,138,.4)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(row.x0, y - 8); ctx.lineTo(row.x0 + row.w, y - 8); ctx.stroke();
        const x = Engine.sawX(row, w.t);
        ctx.save(); ctx.translate(x, y - 8); ctx.rotate(t * 12);
        ctx.fillStyle = '#c9ced8'; ctx.beginPath();
        for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rad = i % 2 ? row.r : row.r - 5; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7a8090'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#7a8090'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
        ctx.restore();
      }
    });
    // player crowd
    const D = Engine.shown(w.n);
    const charge = w.phase === 'battle' ? -Math.min(1, w.battleT / 0.6) * 30 : 0;
    for (let i = 0; i < D; i++) person(w.cx + FORM[i][0], PY + charge + FORM[i][1] * 0.8, '#3a86ff', t, i);
    if (w.n > 0) bubble(w.cx, PY + charge - Engine.radius(w.n) * 0.8 - 18, w.n, '#2b6fe0');
    // effects
    fx.forEach(f => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 1.5));
      if (f.text) {
        ctx.font = `400 ${f.size}px "Lilita One", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,20,80,.6)'; ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      } else if (f.rect) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = f.color; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
      else { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
    if (!started) {
      ctx.fillStyle = 'rgba(40,20,80,.35)'; ctx.fillRect(0, 0, W, H);
      ctx.font = '400 28px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText('Hold & drag to run!', W / 2, H / 2 - 20);
      ctx.font = '40px system-ui'; ctx.fillText('👆', W / 2 + Math.sin(t * 4) * 40, H / 2 + 30);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (keys.left) w.tx = w.cx - 60; else if (keys.right) w.tx = w.cx + 60;
    if (started && !w.result) step(w, dt);
    else if (w.result) step(w, 0);
    w.events.splice(0).forEach(e => {
      if (e.type === 'gate') {
        flashes.push({ row: e.row, left: e.left, life: 1 });
        fx.push({ text: (e.delta >= 0 ? '+' : '') + e.delta, x: w.cx, y: PY - 60, vy: -40, size: 26, color: e.delta >= 0 ? '#9ff3ff' : '#ff9fb2', life: 0.9, max: 0.9 });
      } else if (e.type === 'hit' && e.lost) {
        e.xs.slice(0, 30).forEach(([x, oy]) => fx.push({ x, y: PY + oy * 0.8, vx: (Math.random() - .5) * 80, vy: -60 - Math.random() * 60, g: 300, r: 2.5, color: '#3a86ff', life: .6, max: .6 }));
        fx.push({ text: '−' + e.lost, x: w.cx, y: PY - 50, vy: -40, size: 24, color: '#ff9fb2', life: 0.9, max: 0.9 });
      } else if (e.type === 'clash') {
        for (let i = 0; i < 2; i++) fx.push({ x: w.cx + (Math.random() - .5) * 60, y: PY - 70 + (Math.random() - .5) * 20, vx: (Math.random() - .5) * 120, vy: -80, g: 300, r: 2.5, color: Math.random() < .5 ? '#3a86ff' : '#ff4d6d', life: .5, max: .5 });
      }
    });
    flashes.forEach(f => { f.life -= dt * 1.5; });
    fx.forEach(f => { f.life -= dt; if (f.vy) f.y += f.vy * dt; if (f.vx) f.x += f.vx * dt; if (f.g) f.vy += f.g * dt; if (f.vr) f.rot += f.vr * dt; });
    fx = fx.filter(f => f.life > 0);
    if (w.result && !resultShown) {
      if (!ended) {
        ended = now;
        if (w.result === 'win') {
          const cols = ['#3a86ff', '#ffd23f', '#4fe08a', '#a66bff', '#ff4fa3', '#fff'];
          for (let i = 0; i < 100; i++) fx.push({ rect: true, x: W / 2, y: PY - 60, vx: (Math.random() - .5) * 420, vy: -200 - Math.random() * 380, g: 600, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, color: cols[i % cols.length], life: 2, max: 2 });
        }
      }
      if (now - ended > (w.result === 'win' ? 1100 : 800)) {
        resultShown = true;
        if (w.result === 'win') { levelNo++; store.set('cr.level', levelNo); shell.showResult(true); }
        else shell.showResult(false, w.reason);
      }
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  // ------- input: drag anywhere steers -------
  let drag = null;
  shell.el.addEventListener('pointerdown', e => {
    if (e.target.closest('.pp-result, .pp-x')) return;
    started = true;
    drag = { x: e.clientX, cx: w.tx };
  });
  function onMove(e) { if (drag) w.tx = drag.cx + (e.clientX - drag.x) / scale * 1.4; }
  function onUp() { drag = null; }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  function onKey(e) {
    const down = e.type === 'keydown';
    if (e.key === 'ArrowLeft') { keys.left = down; started = true; }
    if (e.key === 'ArrowRight') { keys.right = down; started = true; }
  }
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

  root.CrowdRun._debug = () => ({ w, start: () => { started = true; } });
  window.addEventListener('resize', resize);
  load(false);
  requestAnimationFrame(() => { resize(); last = performance.now(); raf = requestAnimationFrame(frame); });
}

root.CrowdRun = { open, Engine };
})(typeof window !== 'undefined' ? window : globalThis);
