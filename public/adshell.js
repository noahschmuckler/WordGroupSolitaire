'use strict';
/* Shared "playable ad" chrome: overlay, level label, wobbling banner, the
   countdown close button that dodges once, and the result card. */
(function (root) {
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
let dodgedThisSession = false;

function create({ theme = '', rewards = { win: 15, fail: 8, skip: 5 }, onDone, onRetry, onClose }) {
  const ov = document.createElement('div');
  ov.className = 'pp ' + theme;
  ov.innerHTML = `
    <div class="pp-top">
      <span class="pp-chip">AD</span>
      <span class="pp-level"></span>
      <button class="pp-x" aria-label="Close"><span class="pp-count">5</span></button>
    </div>
    <div class="pp-banner"></div>
    <div class="pp-stage"><canvas></canvas></div>
    <div class="pp-tip"></div>
    <div class="pp-result" hidden></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('pp-open');
  const $ = s => ov.querySelector(s);
  const xBtn = $('.pp-x'), resultEl = $('.pp-result');
  let finished = false;

  const api = {
    el: ov, stage: $('.pp-stage'), canvas: $('canvas'),
    setLevel(t) { $('.pp-level').textContent = t; },
    setBanner(t) { $('.pp-banner').textContent = t; },
    setTip(html) { $('.pp-tip').innerHTML = html; },
    get finished() { return finished; },
    hideResult() { resultEl.hidden = true; resultEl.innerHTML = ''; },
    showResult(win, reason) {
      resultEl.innerHTML = win ? `
        <h3>Brilliant! 🎉</h3>
        <p>You're officially in the top 2%.</p>
        <button class="pp-install">INSTALL NOW</button>
        <button class="pp-collect">Collect +${rewards.win} moves</button>` : `
        <h3>So close! 😱</h3>
        <p>${reason}<br><small>99% of players fail this level.</small></p>
        <button class="pp-retry">Try again</button>
        <button class="pp-collect">Collect +${rewards.fail} moves anyway</button>`;
      resultEl.hidden = false;
      const collect = msg => api.finish(win ? 'win' : 'fail', win ? rewards.win : rewards.fail, msg);
      resultEl.querySelector('.pp-collect').onclick = () => collect();
      const inst = resultEl.querySelector('.pp-install');
      if (inst) inst.onclick = () => collect('Good news: it\'s already installed. You\'re playing it.');
      const retry = resultEl.querySelector('.pp-retry');
      if (retry) retry.onclick = () => { api.hideResult(); onRetry && onRetry(); };
    },
    finish(result, reward, msg) {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      onClose && onClose();
      ov.classList.add('pp-out');
      setTimeout(() => { ov.remove(); document.body.classList.remove('pp-open'); }, 250);
      onDone && onDone({ result, reward, message: msg });
    },
  };

  let count = 5;
  const tick = setInterval(() => {
    count--;
    if (count > 0) xBtn.querySelector('.pp-count').textContent = count;
    else { clearInterval(tick); xBtn.innerHTML = '✕'; xBtn.classList.add('ready'); }
  }, 1000);
  xBtn.addEventListener('click', () => {
    if (!xBtn.classList.contains('ready')) return;
    if (!dodgedThisSession) { dodgedThisSession = true; xBtn.classList.add('dodge'); return; }
    api.finish('skip', rewards.skip);
  });
  return api;
}

root.AdShell = { create, store };
})(window);
