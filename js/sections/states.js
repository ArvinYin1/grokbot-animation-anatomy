// 第 8 节：状态机 —— 原版引擎移植（grok-player）+ 原版提取数据
// 7 个代表状态按钮；「正在播放」显示 player 的真实当前 clip。
// 下方「切换解剖」：一次状态切换里四条机制的时间线——bridge clip 与表情 morph
// 是有 deadline 的贝塞尔（按真实时长填槽），amount / spin 是弹簧实测值（debugFrame）。
import { createGrokBot } from '../vendor/grok-player.js';
import { rafLoop } from '../lib.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return parent ? parent.appendChild(n) : n;
};

const SHOWCASE_STATES = ['idle', 'listening', 'thinking', 'waiting', 'alerting', 'working', 'finished'];
const TL_SPAN = 1.6;         // 时间线窗口（秒）
const BRIDGE_DUR = 0.35;     // ta：bridge clip 时长
const FACE_DUR = 0.28;       // nb：表情 morph 时长

export function init(root) {
  const bot = createGrokBot(root.querySelector('.stage'), { size: 240, state: 'idle', seed: 'states-demo' });
  const btnWrap = root.querySelector('.state-buttons');
  const nowEl = root.querySelector('.clip-now');
  const poolEl = root.querySelector('.clip-pool');

  // ---------- 切换解剖时间线 ----------
  const tl = root.querySelector('.switch-tl');
  const LX = 132, LW = 420, LH = 22, GAP = 8;
  const lanes = [
    { key: 'bridge', label: 'bridge clip', note: '0.35s · 贝塞尔', color: '#2e6bff' },
    { key: 'face', label: '表情 morph', note: '0.28s · face 变化时', color: '#8a5cf6' },
    { key: 'amount', label: 'amount', note: '弹簧实测', color: '#1d9e59' },
    { key: 'spin', label: 'spin 半转身', note: '弹簧实测 · 满槽=π', color: '#e07020' },
  ].map((cfg, i) => {
    const y = 8 + i * (LH + GAP);
    el('text', { x: LX - 8, y: y + LH / 2 + 4, 'text-anchor': 'end', class: 'sw-label' }, tl).textContent = cfg.label;
    el('rect', { x: LX, y, width: LW, height: LH, rx: 5, class: 'sw-track' }, tl);
    const fill = el('rect', { x: LX, y, width: 0, height: LH, rx: 5, style: `fill:${cfg.color}` }, tl);
    el('text', { x: LX + LW + 8, y: y + LH / 2 + 4, class: 'sw-note' }, tl).textContent = cfg.note;
    return { ...cfg, fill, y };
  });

  let t0 = null, spin0 = 0, spinLast = 0;
  for (const id of SHOWCASE_STATES) {
    const btn = document.createElement('button');
    btn.textContent = id;
    btn.setAttribute('aria-pressed', id === 'idle' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      spin0 = spinLast;
      t0 = performance.now();
      bot.setState(id);
      btnWrap.querySelectorAll('button').forEach((b) =>
        b.setAttribute('aria-pressed', b.textContent === id ? 'true' : 'false'));
    });
    btnWrap.appendChild(btn);
  }

  rafLoop(tl, () => {
    const snap = bot.debugFrame();
    if (snap?.morph?.spin != null) spinLast = snap.morph.spin;
    const amount = snap?.morph?.amount ?? 0;
    const el2 = t0 == null ? null : (performance.now() - t0) / 1000;
    const setW = (lane, frac) => {
      const w = Math.min(Math.max(frac, 0), 1) * LW;
      lane.fill.style.display = w < 1 ? 'none' : '';
      lane.fill.setAttribute('width', w.toFixed(1));
    };
    for (const lane of lanes) {
      if (el2 == null) { setW(lane, 0); continue; }
      if (lane.key === 'bridge') setW(lane, el2 / BRIDGE_DUR);
      else if (lane.key === 'face') setW(lane, el2 / FACE_DUR);
      else if (lane.key === 'amount') setW(lane, amount);
      else if (lane.key === 'spin') setW(lane, Math.abs(spinLast - spin0) / Math.PI);
    }
    // 时间刻度
    if (!tl.dataset.ticks) {
      tl.dataset.ticks = '1';
      for (const s of [0.35, 0.7, 1.05, 1.4]) {
        const x = LX + (s / TL_SPAN) * LW;
        el('line', { x1: x, y1: 4, x2: x, y2: 8 + 4 * (LH + GAP) - 4, class: 'sw-tick' }, tl);
        el('text', { x, y: 8 + 4 * (LH + GAP) + 12, 'text-anchor': 'middle', class: 'sw-note' }, tl)
          .textContent = `${s}s`;
      }
    }
  });

  // 真实当前 clip：状态机种子化洗牌抽取的结果
  setInterval(() => {
    nowEl.textContent = `正在播放：${bot.clip ?? '—'}（state: ${bot.state}）`;
  }, 300);

  // idle 的真实 clip 池（来自 grok-recipes.json 的 states.idle.clips）
  fetch('js/vendor/grok-recipes.json')
    .then((r) => r.json())
    .then((data) => {
      const pool = data.states?.idle?.clips ?? [];
      poolEl.textContent = `idle 的 clip 池（真实数据）：[${pool.join(', ')}] —— 种子化洗牌抽取、随机相位起播`;
    })
    .catch(() => { poolEl.textContent = ''; });
}
