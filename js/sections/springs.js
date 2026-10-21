// 第 5 节：弹簧用在哪 —— amount / swap / spin 三弹簧的实时实测曲线
// 数据全部来自正在运行的原版引擎移植实例的 debugFrame()，不是模拟。
import { createGrokBot } from '../vendor/grok-player.js';
import { rafLoop } from '../lib.js';
import { t } from '../i18n/i18n.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return parent ? parent.appendChild(n) : n;
};

const STATES = [
  ['idle', t('index.js.springs.tipIdle')],
  ['thinking', t('index.js.springs.tipThinking')],
  ['waiting', t('index.js.springs.tipWaiting')],
  ['alerting', t('index.js.springs.tipAlerting')],
];
const SPAN = 6; // 曲线窗口 6 秒

// name, color, 取值 → [0,1] 归一化（目标虚线：amount 由按钮点击记录，swap 恒为 1，spin 无）
const LANES = [
  {
    key: 'amount', label: t('index.js.springs.laneAmount'), color: '#1d9e59',
    norm: (v) => v, fmt: (v) => v.toFixed(3),
  },
  {
    key: 'swap', label: t('index.js.springs.laneSwap'), color: '#2e6bff',
    norm: (v) => v, fmt: (v) => v.toFixed(3),
  },
  {
    key: 'spin', label: t('index.js.springs.laneSpin'), color: '#e07020',
    norm: (v) => wrapPi(v) / Math.PI / 2 + 0.5, // [-π,π] → [0,1]，中间=0
    fmt: (v) => `${(v / Math.PI).toFixed(2)}π`,
  },
];
function wrapPi(v) { const t = v % (2 * Math.PI); return t > Math.PI ? t - 2 * Math.PI : t < -Math.PI ? t + 2 * Math.PI : t; }

export function init(root) {
  const bot = createGrokBot(root.querySelector('.stage'), { size: 190, state: 'idle', seed: 'springs-demo' });
  const btnWrap = root.querySelector('.state-buttons');
  const graphWrap = root.querySelector('.spr-graphs');

  for (const [id, zh] of STATES) {
    const btn = document.createElement('button');
    btn.textContent = id;
    btn.title = zh;
    btn.setAttribute('aria-pressed', id === 'idle' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      bot.setState(id);
      amountTarget = id === 'idle' ? 0 : 1;
      btnWrap.querySelectorAll('button').forEach((b) =>
        b.setAttribute('aria-pressed', b.textContent === id ? 'true' : 'false'));
      for (const lane of lanes) lane.marks.push({ t: lane.now, label: id });
    });
    btnWrap.appendChild(btn);
  }
  let amountTarget = 0;

  // 每条 lane：标签 + 滚动曲线 + 当前值
  const lanes = LANES.map((cfg) => {
    const row = document.createElement('div');
    row.className = 'spr-row';
    const head = document.createElement('div');
    head.className = 'spr-head';
    const lab = document.createElement('span');
    lab.className = 'spr-label';
    lab.style.setProperty('--lane', cfg.color);
    lab.textContent = cfg.label;
    const val = document.createElement('span');
    val.className = 'spr-val mono';
    val.textContent = '—';
    head.append(lab, val);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 560 64');
    svg.setAttribute('class', 'spr-graph');
    el('line', { x1: 0, y1: 32, x2: 560, y2: 32, class: 'spr-axis' }, svg);
    const targetLine = el('line', { x1: 0, x2: 560, class: 'spr-target' }, svg);
    const path = el('path', { class: 'spr-line', style: `stroke:${cfg.color}` }, svg);
    const markG = el('g', {}, svg);
    row.append(head, svg);
    graphWrap.appendChild(row);
    return { ...cfg, hist: [], marks: [], path, val, targetLine, markG, now: 0, lastSpin: 0 };
  });

  let t = 0;
  rafLoop(root.querySelector('.spr-stage'), (dt) => {
    t += dt;
    const snap = bot.debugFrame();
    for (const lane of lanes) {
      lane.now = t;
      let v;
      if (lane.key === 'spin') {
        v = snap?.morph?.spin ?? lane.lastSpin;
        lane.lastSpin = v;
      } else {
        v = snap?.morph?.[lane.key] ?? (lane.key === 'swap' ? 1 : 0);
      }
      lane.hist.push([t, v]);
      while (lane.hist.length && lane.hist[0][0] < t - SPAN) lane.hist.shift();

      const py = (val) => 58 - lane.norm(val) * 52; // [0,1] → y 58..6
      let d = '';
      for (const [ht, hv] of lane.hist) {
        const x = ((ht - (t - SPAN)) / SPAN) * 560;
        d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + py(hv).toFixed(1);
      }
      lane.path.setAttribute('d', d);
      lane.val.textContent = lane.fmt(lane.hist.length ? lane.hist[lane.hist.length - 1][1] : 0);

      // 目标虚线：amount 用按钮记录的目标，swap 恒 1，spin 无目标线
      const tv = lane.key === 'amount' ? amountTarget : lane.key === 'swap' ? 1 : null;
      if (tv != null) {
        lane.targetLine.setAttribute('y1', py(tv)); lane.targetLine.setAttribute('y2', py(tv));
        lane.targetLine.style.display = '';
      } else lane.targetLine.style.display = 'none';

      // 切换事件标记
      lane.markG.textContent = '';
      for (const m of lane.marks) {
        if (m.t < t - SPAN) continue;
        const x = ((m.t - (t - SPAN)) / SPAN) * 560;
        el('line', { x1: x, y1: 4, x2: x, y2: 60, class: 'spr-mark' }, lane.markG);
        el('text', { x: x + 4, y: 12, class: 'spr-mark-label' }, lane.markG).textContent = m.label;
      }
      while (lane.marks.length && lane.marks[0].t < t - SPAN) lane.marks.shift();
    }
  });
}
