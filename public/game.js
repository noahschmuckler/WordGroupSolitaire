'use strict';
/* Word Groups Solitaire: a calm, limit-free word-sorting solitaire. */

// ---------------------------------------------------------------- data ----
const ALL_CATS = CATEGORY_DATA.trim().split('\n').map(line => {
  const [name, list] = line.split('|');
  return { name: name.trim(), words: list.split(',').map(s => s.trim()).filter(Boolean) };
});
const norm = s => s.toLowerCase();
ALL_CATS.forEach(c => { c.set = new Set(c.words.map(norm)); });

const DIFFS = {
  relaxed:     { label: 'Relaxed',     desc: '5 categories · 4 columns · ~27 cards', cats: 5, min: 4, max: 5, cols: 4, downs: [0, 1, 2, 3], slots: 4 },
  classic:     { label: 'Classic',     desc: '7 categories · 5 columns · ~42 cards', cats: 7, min: 4, max: 6, cols: 5, downs: [0, 1, 2, 3, 4], slots: 4 },
  challenging: { label: 'Challenging', desc: '9 categories · 6 columns · ~60 cards', cats: 9, min: 5, max: 7, cols: 6, downs: [0, 1, 2, 3, 4, 5], slots: 4 },
};

// ----------------------------------------------------------------- rng ----
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

// ------------------------------------------------------------- storage ----
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const settings = Object.assign({ diff: 'classic', highlight: false }, store.get('wgs.settings', {}));
const stats = Object.assign({ played: 0, won: 0 }, store.get('wgs.stats', {}));

// ---------------------------------------------------------- generation ----
function generate(diffKey, seed) {
  const D = DIFFS[diffKey];
  const rnd = mulberry32(seed);
  const sharesWith = (a, b) => ALL_CATS[a].words.some(w => ALL_CATS[b].set.has(norm(w)));

  // Pick categories, leaning toward ones whose words overlap (the fun part).
  const idx = shuffle(ALL_CATS.map((_, i) => i), rnd);
  const chosen = [idx[0]];
  while (chosen.length < D.cats) {
    let next = null;
    if (rnd() < 0.7) {
      const cands = idx.filter(i => !chosen.includes(i) && chosen.some(c => sharesWith(i, c)));
      if (cands.length) next = pick(cands, rnd);
    }
    if (next == null) next = pick(idx.filter(i => !chosen.includes(i)), rnd);
    chosen.push(next);
  }

  // Pick words for each category, preferring a couple of "double meaning" words.
  const dealt = new Set();
  const cats = [];
  const words = [];
  chosen.forEach((ci, j) => {
    const cat = ALL_CATS[ci];
    let n = D.min + Math.floor(rnd() * (D.max - D.min + 1));
    const avail = cat.words.filter(w => !dealt.has(norm(w)));
    const isShared = w => chosen.some(o => o !== ci && ALL_CATS[o].set.has(norm(w)));
    const shared = shuffle(avail.filter(isShared), rnd);
    const plain = shuffle(avail.filter(w => !isShared(w)), rnd);
    const nShared = Math.min(shared.length, 1 + Math.floor(rnd() * 2));
    let mine = shared.slice(0, nShared).concat(plain.slice(0, n - nShared));
    if (mine.length < n) mine = mine.concat(shared.slice(nShared, nShared + (n - mine.length)));
    n = mine.length;
    mine.forEach(w => { dealt.add(norm(w)); words.push({ text: w, home: j }); });
    cats.push({ name: cat.name, target: n, placed: 0, done: false, collected: [] });
  });

  // Build cards. A word's candidates are every in-play category that lists it.
  const cards = [];
  cats.forEach((c, j) => cards.push({ id: cards.length, kind: 'cat', cat: j, text: c.name }));
  words.forEach(w => {
    const cands = chosen.map((ci, j) => ALL_CATS[ci].set.has(norm(w.text)) ? j : -1).filter(j => j >= 0);
    cards.push({ id: cards.length, kind: 'word', text: w.text, cands });
  });

  const deck = shuffle(cards.map(c => c.id), rnd);
  const cols = D.downs.map(nDown => {
    const col = [];
    for (let k = 0; k <= nDown; k++) col.push({ id: deck.pop(), up: k === nDown });
    return col;
  });
  // Make sure at least one category card is visible at the start.
  const tops = cols.map(c => c[c.length - 1]);
  if (!tops.some(t => cards[t.id].kind === 'cat')) {
    const catInDeck = deck.findIndex(id => cards[id].kind === 'cat');
    const t = pick(tops, rnd);
    if (catInDeck >= 0) { const tmp = t.id; t.id = deck[catInDeck]; deck[catInDeck] = tmp; }
  }

  return {
    v: 1, seed, diff: diffKey, cats, cards,
    stock: deck, waste: [], cols,
    slots: Array.from({ length: D.slots }, () => ({ card: null, cat: null, words: [] })),
    doneOrder: [], moves: 0, won: false,
  };
}

// --------------------------------------------------------------- state ----
let S = null;           // current game
let undoStack = [];
const MUTABLE = ['cats', 'stock', 'waste', 'cols', 'slots', 'doneOrder', 'moves', 'won'];
const snapshot = () => JSON.stringify(MUTABLE.reduce((o, k) => (o[k] = S[k], o), {}));
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 1000) undoStack.shift(); }
function save() { store.set('wgs.game', S); store.set('wgs.undo', undoStack.slice(-200)); }

const card = id => S.cards[id];
const activeCands = c => c.cands.filter(j => !S.cats[j].done);

function locate(id) {
  let i = S.stock.indexOf(id); if (i >= 0) return { where: 'stock', i };
  i = S.waste.indexOf(id); if (i >= 0) return { where: 'waste', i };
  for (let c = 0; c < S.cols.length; c++) {
    i = S.cols[c].findIndex(x => x.id === id); if (i >= 0) return { where: 'col', col: c, i };
  }
  for (let s = 0; s < S.slots.length; s++) {
    if (S.slots[s].card === id) return { where: 'slot', slot: s, i: -1 };
    i = S.slots[s].words.indexOf(id); if (i >= 0) return { where: 'slot', slot: s, i };
  }
  return { where: 'done' };
}

// Words not yet sitting in a foundation (and not from a finished category).
function unplacedWords() {
  const out = [];
  const add = id => { if (card(id).kind === 'word') out.push(id); };
  S.stock.forEach(add); S.waste.forEach(add); S.cols.forEach(col => col.forEach(x => add(x.id)));
  return out;
}

// Can every remaining word still be assigned to a category with room? (b-matching)
function matchingExists(words, need) {
  const owners = need.map(() => []);
  const aug = (w, seen) => {
    for (const c of card(w).cands) {
      if (need[c] <= 0 || seen[c]) continue;
      seen[c] = true;
      if (owners[c].length < need[c]) { owners[c].push(w); return true; }
      for (let k = 0; k < owners[c].length; k++) {
        if (aug(owners[c][k], seen)) { owners[c][k] = w; return true; }
      }
    }
    return false;
  };
  for (const w of words) if (!aug(w, new Array(need.length).fill(false))) return false;
  return true;
}
function canAssign(wordIds, c) {
  if (S.cats[c].done) return false;
  if (!wordIds.every(w => card(w).kind === 'word' && card(w).cands.includes(c))) return false;
  const need = S.cats.map(k => k.done ? 0 : k.target - k.placed);
  need[c] -= wordIds.length;
  if (need[c] < 0) return false;
  const ex = new Set(wordIds);
  return matchingExists(unplacedWords().filter(w => !ex.has(w)), need);
}

// A group's shared category options, or null if it is not a coherent group.
function groupSet(ids) {
  const first = card(ids[0]);
  if (first.kind === 'cat') {
    if (S.cats[first.cat].done) return null;
    for (let k = 1; k < ids.length; k++) {
      const c = card(ids[k]);
      if (c.kind !== 'word' || !c.cands.includes(first.cat)) return null;
    }
    return [first.cat];
  }
  let set = activeCands(first);
  for (let k = 1; k < ids.length; k++) {
    const c = card(ids[k]);
    if (c.kind !== 'word') return null;
    set = set.filter(j => c.cands.includes(j));
    if (!set.length) return null;
  }
  return set.length ? set : null;
}

// The movable unit that starts at a given card, or null.
function unitAt(id) {
  const L = locate(id);
  if (L.where === 'waste') return L.i === S.waste.length - 1 ? { from: L, ids: [id] } : null;
  if (L.where === 'col') {
    const col = S.cols[L.col];
    if (!col[L.i].up) return null;
    const ids = col.slice(L.i).map(x => x.id);
    return groupSet(ids) ? { from: L, ids } : null;
  }
  return null;
}

// Category options of the coherent run sitting on top of a column.
function topRunSet(col) {
  let best = null;
  for (let i = col.length - 1; i >= 0 && col[i].up; i--) {
    const set = groupSet(col.slice(i).map(x => x.id));
    if (!set) break;
    best = set;
  }
  return best;
}

function canDrop(unit, target) {
  const ids = unit.ids;
  const first = card(ids[0]);
  if (target.type === 'col') {
    if (unit.from.where === 'col' && unit.from.col === target.col) return false;
    const col = S.cols[target.col];
    if (!col.length) return true;
    if (first.kind === 'cat') return false;
    const top = col[col.length - 1];
    if (!top.up) return false;
    const tset = topRunSet(col);
    const uset = groupSet(ids);
    return !!(tset && uset && tset.some(j => uset.includes(j)));
  }
  if (target.type === 'slot') {
    const slot = S.slots[target.slot];
    if (slot.cat == null) {
      if (first.kind !== 'cat') return false;
      return ids.length === 1 || canAssign(ids.slice(1), first.cat);
    }
    if (first.kind === 'cat') return false;
    return canAssign(ids, slot.cat);
  }
  return false;
}

function removeUnit(unit) {
  const L = unit.from;
  if (L.where === 'waste') S.waste.pop();
  else if (L.where === 'col') {
    const col = S.cols[L.col];
    col.splice(L.i);
    const top = col[col.length - 1];
    if (top && !top.up) { top.up = true; fx.flip.add(top.id); }
  }
}

function doMove(unit, target) {
  if (!canDrop(unit, target)) return false;
  pushUndo();
  removeUnit(unit);
  if (target.type === 'col') {
    unit.ids.forEach(id => S.cols[target.col].push({ id, up: true }));
  } else {
    const slot = S.slots[target.slot];
    let ids = unit.ids;
    if (card(ids[0]).kind === 'cat') { slot.card = ids[0]; slot.cat = card(ids[0]).cat; ids = ids.slice(1); }
    const cat = S.cats[slot.cat];
    ids.forEach(id => { slot.words.push(id); cat.placed++; });
    if (cat.placed >= cat.target) {
      cat.done = true;
      cat.collected = slot.words.map(id => card(id).text);
      S.doneOrder.push(slot.cat);
      fx.vanish.add(slot.card); slot.words.forEach(id => fx.vanish.add(id));
      fx.toast = `${cat.name} complete!`;
      slot.card = null; slot.cat = null; slot.words = [];
    } else {
      fx.pop.add(slot.card);
    }
  }
  S.moves++;
  if (S.cats.every(c => c.done) && !S.won) {
    S.won = true; stats.won++; store.set('wgs.stats', stats);
    const wonGame = S; setTimeout(() => { if (S === wonGame) showWin(); }, 700);
  }
  return true;
}

function draw() {
  if (!S.stock.length && !S.waste.length) { toast('The deck is empty.'); return; }
  pushUndo();
  if (S.stock.length) S.waste.push(S.stock.pop());
  else { S.stock = S.waste.reverse(); S.waste = []; }
  S.moves++;
  commit();
}

function undo() {
  if (!undoStack.length) { toast('Nothing to undo.'); return; }
  Object.assign(S, JSON.parse(undoStack.pop()));
  selection = null;
  commit();
}

// Smart destination for a tapped-twice card.
function autoTarget(unit) {
  const first = card(unit.ids[0]);
  const targets = [];
  S.slots.forEach((s, i) => { if (s.cat != null) targets.push({ type: 'slot', slot: i }); });
  if (first.kind === 'cat') S.slots.forEach((s, i) => { if (s.cat == null) targets.push({ type: 'slot', slot: i }); });
  S.cols.forEach((c, i) => { if (c.length) targets.push({ type: 'col', col: i }); });
  const wholeCol = unit.from.where === 'col' && unit.from.i === 0;
  if (!wholeCol) S.cols.forEach((c, i) => { if (!c.length) targets.push({ type: 'col', col: i }); });
  return targets.find(t => canDrop(unit, t)) || null;
}

// ---------------------------------------------------------------- hint ----
function findHint() {
  const units = [];
  if (S.waste.length) units.push(unitAt(S.waste[S.waste.length - 1]));
  S.cols.forEach(col => col.forEach((x, i) => { if (x.up) { const u = unitAt(x.id); if (u) units.push(u); } }));
  const slotT = S.slots.map((_, i) => ({ type: 'slot', slot: i }));
  const colT = S.cols.map((_, i) => ({ type: 'col', col: i }));
  const ok = (u, t) => u && canDrop(u, t);

  for (const u of units) for (const t of slotT) if (S.slots[t.slot].cat != null && ok(u, t)) return { u, t };
  for (const u of units) if (card(u.ids[0]).kind === 'cat') for (const t of slotT) if (S.slots[t.slot].cat == null && ok(u, t)) return { u, t };
  for (const u of units) {
    if (u.from.where !== 'col') continue;
    const col = S.cols[u.from.col];
    const firstUp = col.findIndex(x => x.up);
    if (u.from.i !== firstUp) continue;
    const reveals = firstUp > 0;
    for (const t of colT) {
      const dest = S.cols[t.col];
      if (!dest.length && !reveals) continue;
      if (ok(u, t)) return { u, t };
    }
  }
  const w = units.find(u => u.from.where === 'waste');
  if (w) for (const t of colT) if (S.cols[t.col].length && ok(w, t)) return { u: w, t };
  if (w && card(w.ids[0]).kind === 'cat') for (const t of colT) if (!S.cols[t.col].length && ok(w, t)) return { u: w, t };
  if (S.stock.length || S.waste.length) return { draw: true };
  return null;
}
function showHint() {
  clearSelection();
  const h = findHint();
  if (!h) { toast('No moves found. Try undo, or deal again.'); return; }
  if (h.draw) { flash(stockSpot); toast(S.stock.length ? 'Try drawing from the deck.' : 'Tap the deck to recycle it.'); return; }
  h.u.ids.forEach(id => flash(els[id]));
  flash(targetEl(h.t));
}
function flash(el) {
  if (!el) return;
  el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint');
  setTimeout(() => el.classList.remove('hint'), 2100);
}

// ------------------------------------------------------------ rendering ----
const board = document.getElementById('board');
let els = [];            // card elements by id
let slotSpots = [], colSpots = [], stockSpot = null, wasteSpot = null, stockBadge = null;
let L = null;            // last layout geometry
let pos = {};            // last positions by id
let firstPaint = true;
const fx = { flip: new Set(), vanish: new Set(), pop: new Set(), toast: null };
let selection = null;    // a unit

function build() {
  board.innerHTML = '';
  els = S.cards.map(c => {
    const el = document.createElement('div');
    el.className = 'card ' + c.kind;
    el.dataset.id = c.id;
    const face = document.createElement('div');
    face.className = 'face';
    const w = document.createElement('div');
    w.className = 'w'; w.textContent = c.text;
    face.appendChild(w);
    if (c.kind === 'cat') {
      const cnt = document.createElement('div'); cnt.className = 'count'; face.appendChild(cnt);
      const last = document.createElement('div'); last.className = 'last'; face.appendChild(last);
    }
    el.appendChild(face);
    return el;
  });
  const mk = (cls, html) => { const d = document.createElement('div'); d.className = 'spot ' + cls; d.innerHTML = html || ''; board.appendChild(d); return d; };
  slotSpots = S.slots.map((_, i) => { const d = mk('slot', 'Category'); d.dataset.slot = i; return d; });
  wasteSpot = mk('waste');
  stockSpot = mk('stock');
  colSpots = S.cols.map((_, i) => { const d = mk('col'); d.dataset.col = i; return d; });
  els.forEach(el => board.appendChild(el));
  stockBadge = document.createElement('div'); stockBadge.className = 'badge'; board.appendChild(stockBadge);
  pos = {}; firstPaint = true;
}

function computeLayout() {
  const D = DIFFS[S.diff];
  const W = board.clientWidth;
  const n = Math.max(D.cols, D.slots + 2);
  const gap = Math.max(4, Math.min(12, Math.round(W * 0.014)));
  const pad = gap + 2;
  const cw = Math.floor(Math.min(104, (W - 2 * pad - (n - 1) * gap) / n));
  const ch = Math.round(cw * 1.28);
  const fs = Math.max(12, Math.min(22, cw * 0.2));
  const topY = pad + 4;
  const tabY = topY + ch + Math.max(14, gap * 2.5);
  const rowW = n * cw + (n - 1) * gap;
  const x0 = Math.round((W - rowW) / 2);
  const slotX = i => x0 + i * (cw + gap);
  const stockX = x0 + rowW - cw;
  const wasteX = stockX - cw - gap;
  const colsW = D.cols * cw + (D.cols - 1) * gap;
  const cx0 = Math.round((W - colsW) / 2);
  const colX = i => cx0 + i * (cw + gap);
  const upOff = Math.round(Math.max(22, fs * 1.15 + 11));
  const downOff = Math.max(7, Math.round(ch * 0.09));
  const avail = Math.max(ch * 2.5, window.innerHeight - board.getBoundingClientRect().top - window.scrollY - tabY - pad - 8);
  return { W, cw, ch, fs, gap, pad, topY, tabY, slotX, stockX, wasteX, colX, upOff, downOff, avail };
}

function fitFont(el, text, cw, base, isCat) {
  const longest = Math.max(...text.split(/\s+/).map(t => t.length));
  const inner = cw - 9;
  const perChar = 0.5;  // Barlow Condensed average glyph width (em)
  let size = Math.min(base * (isCat ? 0.82 : 1), inner / (Math.max(longest, 3) * perChar));
  if (!isCat && text.length * perChar * size <= inner) size = Math.min(base, size);
  el.style.fontSize = Math.max(9, size).toFixed(1) + 'px';
}

function render() {
  L = computeLayout();
  const { cw, ch } = L;
  board.style.setProperty('--cw', cw + 'px');
  const place = (el, x, y, w = cw, h = ch) => {
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  slotSpots.forEach((d, i) => { place(d, L.slotX(i), L.topY); d.style.fontSize = Math.max(8, Math.min(11, cw / 7.5)) + 'px'; });
  place(stockSpot, L.stockX, L.topY);
  place(wasteSpot, L.wasteX, L.topY);
  stockBadge.textContent = S.stock.length || '';
  stockBadge.style.display = S.stock.length ? '' : 'none';
  stockBadge.style.transform = `translate(${L.stockX + cw - 4}px, ${L.topY + 4}px) translateX(-100%)`;
  stockSpot.innerHTML = S.stock.length ? '' :
    (S.waste.length ? '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>' : 'Empty');

  S.cards.forEach(c => {
    const el = els[c.id];
    if (el._cw !== cw) {
      el.style.width = cw + 'px'; el.style.height = ch + 'px';
      fitFont(el.firstChild.firstChild, c.text, cw, L.fs, c.kind === 'cat');
      el._cw = cw; el._lh = 0;
    }
  });
  S.cards.forEach(c => { const el = els[c.id]; if (!el._lh) el._lh = el.firstChild.firstChild.offsetHeight || L.fs * 1.1; });

  const P = {};
  // stock
  S.stock.forEach((id, i) => { P[id] = { x: L.stockX, y: L.topY, z: 10 + i, up: false, flat: i < S.stock.length - 1 }; });
  // waste: show top three slightly fanned
  const wn = S.waste.length;
  S.waste.forEach((id, i) => {
    const k = Math.max(0, i - (wn - 3));
    const off = Math.min(wn, 3) > 1 ? k * Math.min(10, cw * 0.12) : 0;
    P[id] = { x: L.wasteX - (Math.min(wn, 3) - 1) * Math.min(10, cw * 0.12) + off, y: L.topY, z: 10 + i, up: true, flat: i < wn - 3 };
  });
  // slots
  S.slots.forEach((s, i) => {
    s.words.forEach((id, k) => { P[id] = { x: L.slotX(i), y: L.topY, z: 10 + k, up: true, flat: true }; });
    if (s.card != null) P[s.card] = { x: L.slotX(i), y: L.topY, z: 200, up: true };
  });
  // columns (compress if tall)
  let maxBottom = L.tabY + L.ch;
  S.cols.forEach((col, c) => {
    const nDown = col.filter(x => !x.up).length;
    const nUp = col.length - nDown;
    const dOff = L.downOff;
    const strip = x => Math.max(L.upOff, Math.ceil(els[x.id]._lh + 12));
    let upSum = 0;
    col.forEach((x, i) => { if (x.up && i < col.length - 1) upSum += strip(x); });
    const h = nDown * dOff + upSum + ch;
    let scale = 1;
    if (h > L.avail && upSum > 0) scale = Math.max(0.55, (L.avail - ch - nDown * dOff) / upSum);
    let y = L.tabY;
    col.forEach((x, i) => {
      P[x.id] = { x: L.colX(c), y, z: 10 + i, up: x.up };
      y += x.up ? Math.round(strip(x) * scale) : dOff;
    });
    const bottom = (col.length ? P[col[col.length - 1].id].y : L.tabY) + ch;
    maxBottom = Math.max(maxBottom, bottom);
    place(colSpots[c], L.colX(c), L.tabY);
    colSpots[c]._zone = { x: L.colX(c) - L.gap / 2, y: L.tabY - 6, w: cw + L.gap, h: bottom - L.tabY + ch * 0.6 };
  });
  slotSpots.forEach((d, i) => { d._zone = { x: L.slotX(i) - 4, y: L.topY - 4, w: cw + 8, h: ch + 8 }; });
  board.style.height = Math.ceil(maxBottom + L.pad + ch * 0.5) + 'px';

  // done cards
  S.cards.forEach(c => { if (!P[c.id]) P[c.id] = { gone: true, z: 1 }; });

  // apply to elements
  S.cards.forEach(c => {
    const el = els[c.id];
    const p = P[c.id];
    const old = pos[c.id];
    el.classList.toggle('down', !p.gone && !p.up);
    if (c.kind === 'cat') {
      const k = S.cats[c.cat];
      el.querySelector('.count').textContent = `${k.placed} / ${k.target}`;
      const slot = S.slots.find(s => s.card === c.id);
      el.querySelector('.last').textContent = slot && slot.words.length ? card(slot.words[slot.words.length - 1]).text : '';
    }
    if (p.gone) {
      if (fx.vanish.has(c.id)) { el.classList.add('pop'); setTimeout(() => el.classList.add('gone'), 380); }
      else el.classList.add('gone');
      el.style.zIndex = 1;
      pos[c.id] = p;
      return;
    }
    el.classList.remove('gone', 'pop');
    el.classList.toggle('flat', !!p.flat);
    const moved = !old || old.gone || old.x !== p.x || old.y !== p.y;
    if (moved && !firstPaint) {
      el.style.zIndex = 1000 + p.z;
      clearTimeout(el._zt);
      el._zt = setTimeout(() => { el._zt = null; el.style.zIndex = pos[c.id] && !pos[c.id].gone ? pos[c.id].z : 1; }, 300);
    } else if (!el._zt) {
      el.style.zIndex = p.z;
    }
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    if (fx.flip.has(c.id)) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); }
    if (fx.pop.has(c.id)) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 520); }
    pos[c.id] = p;
  });
  firstPaint = false;
  fx.flip.clear(); fx.vanish.clear(); fx.pop.clear();
  if (fx.toast) { toast(fx.toast); fx.toast = null; }

  // selection + targets
  els.forEach(el => el.classList.remove('sel', 'target'));
  [...slotSpots, ...colSpots].forEach(d => d.classList.remove('target'));
  if (selection) {
    selection.ids.forEach(id => els[id].classList.add('sel'));
    if (settings.highlight) allTargets().forEach(t => { if (canDrop(selection, t)) { const e = targetEl(t); e && e.classList.add('target'); } });
  }

  document.getElementById('groupsDone').textContent = `${S.doneOrder.length}/${S.cats.length}`;
  document.getElementById('moveCount').textContent = S.moves;
  document.getElementById('btnUndo').disabled = !undoStack.length;
}

function allTargets() {
  return [...S.slots.map((_, i) => ({ type: 'slot', slot: i })), ...S.cols.map((_, i) => ({ type: 'col', col: i }))];
}
function targetEl(t) {
  if (t.type === 'slot') { const s = S.slots[t.slot]; return s.card != null ? els[s.card] : slotSpots[t.slot]; }
  const col = S.cols[t.col];
  return col.length ? els[col[col.length - 1].id] : colSpots[t.col];
}

function commit() { save(); render(); }

// --------------------------------------------------------------- input ----
function clearSelection() { if (selection) { selection = null; render(); } }
function shake(ids) {
  ids.forEach(id => { const el = els[id]; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); });
}
function targetFromLoc(Lc) {
  if (Lc.where === 'col') return { type: 'col', col: Lc.col };
  if (Lc.where === 'slot') return { type: 'slot', slot: Lc.slot };
  return null;
}

function tapCard(id) {
  const Lc = locate(id);
  if (Lc.where === 'stock') { selection = null; draw(); return; }
  if (selection) {
    if (selection.ids.includes(id)) {
      const t = autoTarget(selection);
      const u = selection; selection = null;
      if (t && doMove(u, t)) commit(); else { render(); shake(u.ids); }
      return;
    }
    const t = targetFromLoc(Lc);
    if (t && doMove(selection, t)) { selection = null; commit(); return; }
    const u = unitAt(id);
    if (u) { selection = u; render(); return; }
    const old = selection; selection = null; render(); shake(old.ids);
    return;
  }
  const u = unitAt(id);
  if (u) { selection = u; render(); }
}

function tapSpot(spot) {
  if (spot === stockSpot) { selection = null; draw(); return; }
  if (!selection) return;
  let t = null;
  if (spot.dataset.slot != null) t = { type: 'slot', slot: +spot.dataset.slot };
  if (spot.dataset.col != null) t = { type: 'col', col: +spot.dataset.col };
  if (t && doMove(selection, t)) { selection = null; commit(); }
  else { const old = selection; selection = null; render(); shake(old.ids); }
}

let drag = null;
board.addEventListener('pointerdown', e => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const cardEl = e.target.closest('.card');
  const spot = e.target.closest('.spot');
  drag = { x0: e.clientX, y0: e.clientY, cardEl, spot, active: false, pid: e.pointerId };
  if (cardEl) {
    const id = +cardEl.dataset.id;
    const u = unitAt(id);
    if (u) drag.unit = u;
  }
});
board.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pid) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.active) {
    if (!drag.unit || Math.hypot(dx, dy) < 6) return;
    drag.active = true;
    try { board.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (selection) { selection = null; render(); }
    drag.base = drag.unit.ids.map(id => ({ id, x: pos[id].x, y: pos[id].y }));
    drag.unit.ids.forEach((id, k) => { const el = els[id]; el.classList.add('dragging'); el.style.zIndex = 5000 + k; });
  }
  drag.dx = dx; drag.dy = dy;
  drag.base.forEach(b => { els[b.id].style.transform = `translate(${b.x + dx}px, ${b.y + dy}px)`; });
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.pid)) return;
  const d = drag; drag = null;
  if (!d.active) {
    if (e && e.type === 'pointerup') {
      if (d.cardEl) tapCard(+d.cardEl.dataset.id);
      else if (d.spot) tapSpot(d.spot);
      else clearSelection();
    }
    return;
  }
  d.unit.ids.forEach(id => { els[id].classList.remove('dragging'); });
  // Pick the drop zone with the most overlap; try candidates in that order.
  const b = d.base[0];
  const r = { x: b.x + d.dx, y: b.y + d.dy, w: L.cw, h: L.ch };
  const zones = [];
  const overlap = z => Math.max(0, Math.min(r.x + r.w, z.x + z.w) - Math.max(r.x, z.x)) * Math.max(0, Math.min(r.y + r.h, z.y + z.h) - Math.max(r.y, z.y));
  slotSpots.forEach((s, i) => zones.push({ t: { type: 'slot', slot: i }, a: overlap(s._zone) }));
  colSpots.forEach((s, i) => zones.push({ t: { type: 'col', col: i }, a: overlap(s._zone) }));
  const order = zones.filter(z => z.a > 0).sort((a, b2) => b2.a - a.a);
  const moved = order.some(z => doMove(d.unit, z.t));
  if (moved) commit();
  else {
    render();
    const isSelf = order.length && order[0].t.type === 'col' && d.unit.from.where === 'col' && order[0].t.col === d.unit.from.col;
    if (order.length && !isSelf) shake(d.unit.ids);
  }
}
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', e => { if (drag && drag.active) { drag.dx = 0; drag.dy = 0; } endDrag(e); });
document.addEventListener('pointerdown', e => { if (!board.contains(e.target) && !e.target.closest('.bar') && !e.target.closest('dialog')) clearSelection(); });

document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key.toLowerCase() === 'h') showHint();
  else if (e.key === ' ') { e.preventDefault(); selection = null; draw(); }
  else if (e.key === 'Escape') clearSelection();
});

let toastT = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ------------------------------------------------------------- dialogs ----
const dlgNew = document.getElementById('dlgNew');
const dlgHelp = document.getElementById('dlgHelp');
const dlgWin = document.getElementById('dlgWin');

function openNew() {
  const box = document.getElementById('diffChoices');
  box.innerHTML = Object.entries(DIFFS).map(([k, d]) => `
    <label class="choice"><input type="radio" name="diff" value="${k}" ${k === settings.diff ? 'checked' : ''}>
      <span><b>${d.label}</b><small>${d.desc}</small></span></label>`).join('');
  document.getElementById('optHighlight').checked = settings.highlight;
  dlgNew.showModal();
}
dlgNew.addEventListener('close', () => {
  settings.highlight = document.getElementById('optHighlight').checked;
  if (dlgNew.returnValue === 'deal') {
    const r = dlgNew.querySelector('input[name=diff]:checked');
    if (r) settings.diff = r.value;
    store.set('wgs.settings', settings);
    newGame(settings.diff);
  } else {
    store.set('wgs.settings', settings);
    render();
  }
});
dlgWin.addEventListener('close', () => { if (dlgWin.returnValue === 'again') openNew(); });
dlgHelp.addEventListener('close', () => store.set('wgs.seenHelp', true));

function showWin() {
  const esc = s => s.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  document.getElementById('winSummary').textContent =
    `${DIFFS[S.diff].label} deal finished in ${S.moves} moves. Games won: ${stats.won}.`;
  document.getElementById('winList').innerHTML = S.doneOrder.map(j => {
    const c = S.cats[j];
    return `<div><b>${esc(c.name)}</b>: ${c.collected.map(esc).join(', ')}</div>`;
  }).join('');
  dlgWin.showModal();
}

document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnHint').addEventListener('click', showHint);
document.getElementById('btnNew').addEventListener('click', openNew);
document.getElementById('btnHelp').addEventListener('click', () => dlgHelp.showModal());

// --------------------------------------------------------------- start ----
function newGame(diffKey) {
  const seed = (Math.random() * 2 ** 31) >>> 0;
  S = generate(diffKey, seed);
  undoStack = [];
  selection = null;
  stats.played++; store.set('wgs.stats', stats);
  build();
  commit();
}

function resume() {
  const g = store.get('wgs.game', null);
  if (g && g.v === 1 && DIFFS[g.diff] && Array.isArray(g.cards)) {
    S = g;
    undoStack = store.get('wgs.undo', []) || [];
    build();
    render();
    return true;
  }
  return false;
}

let rT = null;
window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (S) { els.forEach(el => { el._cw = 0; }); render(); } }, 80); });

if (!resume()) newGame(settings.diff);
if (!store.get('wgs.seenHelp', false)) dlgHelp.showModal();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { els.forEach(el => { el._cw = 0; }); render(); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
