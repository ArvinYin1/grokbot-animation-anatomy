// 第 3 节：clip 贝塞尔关键帧 —— 编排动画的数学
// A. 三次贝塞尔缓动游乐场：可拖控制点，预设全部取自真实 clip 数据（y 允许超界 = 过冲）
// B. 活 clip 检视：mini-bot 跑原版引擎，曲线是它此刻正在播放的 clip 的真实轨道，
//    播放头经 debugFrame() 与引擎同步。
import { createGrokBot } from '../vendor/grok-player.js';
import { rafLoop } from '../lib.js';
import { t } from '../i18n/i18n.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return parent ? parent.appendChild(n) : n;
};

// ---------- 与引擎同算法（grok-player.js 的 el/sb/Qa/vt） ----------
const bx = (t, a, b) => { const u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t; };
const bxd = (t, a, b) => { const u = 1 - t; return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b); };
function cubicBezier(x, [x1, y1, x2, y2]) {
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = bx(t, x1, x2) - x, d = bxd(t, x1, x2);
    if (Math.abs(err) < 1e-6 || Math.abs(d) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - err / d));
  }
  return bx(t, y1, y2);
}
function evalTrack(kfs, t, idx, fallback) {
  if (!kfs || kfs.length === 0) return fallback;
  if (t <= kfs[0].t) return kfs[0].v[idx];
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return last.v[idx];
  let i = 0;
  while (i < kfs.length - 2 && kfs[i + 1].t <= t) i++;
  const a = kfs[i], b = kfs[i + 1];
  const p = cubicBezier(Math.min(1, (t - a.t) / Math.max(b.t - a.t, 1e-9)), a.ease);
  return a.v[idx] + (b.v[idx] - a.v[idx]) * p;
}

// 真实缓动预设（全部来自 grok-recipes.json）
const PRESETS = [
  ['默认 nr', [0.42, 0, 0.58, 1]],
  ['bridge dx', [0.4, 0, 0.2, 1]],
  ['表情 tb', [0.4, 0.06, 0.18, 1]],
  ['Idle_B 回弹', [0.87, -0.08, 0.30, 1.02]],
];

const TRACKS = [
  [t('index.js.clip.trackRotYaw'), 'rotation', 1],
  [t('index.js.clip.trackRotPitch'), 'rotation', 0],
  [t('index.js.clip.trackRotRoll'), 'rotation', 2],
  ['position · x', 'position', 0],
  ['position · y', 'position', 1],
  ['squash · x', 'squash', 0],
  ['squash · y', 'squash', 1],
  ['zoom', 'zoom', 0],
  [t('index.js.clip.trackLids'), 'lids', 0],
];

export function init(root) {
  initBezierLab(root);
  initClipLive(root);
}

// ============================================================
// A. 贝塞尔游乐场
// ============================================================
function initBezierLab(root) {
  const svg = root.querySelector('.bez-canvas');
  const readout = root.querySelector('.bez-readout');
  const W = 560, H = 300;
  const Y0 = 0, Y1 = 1, PAD = 0.32;            // 值域 [-PAD, 1+PAD] 让过冲可见
  const px = (x) => 56 + x * (W - 96);
  const py = (y) => H - 28 - ((y - (Y0 - PAD)) / (1 + 2 * PAD)) * (H - 56);

  // 网格与坐标轴
  for (const y of [0, 1]) {
    el('line', { x1: px(0), y1: py(y), x2: px(1), y2: py(y), class: 'grid out' }, svg);
    el('text', { x: 14, y: py(y) + 4 }, svg).textContent = `y=${y}`;
  }
  el('text', { x: 14, y: py(1 + PAD) + 10, class: 'zone-label' }, svg).textContent = t('index.js.clip.zoneOver');
  el('text', { x: 14, y: py(-PAD) + 4, class: 'zone-label' }, svg).textContent = t('index.js.clip.zoneUnder');
  for (const x of [0, 1]) el('line', { x1: px(x), y1: py(-PAD), x2: px(x), y2: py(1 + PAD), class: 'grid' }, svg);
  el('text', { x: px(0) - 8, y: H - 8 }, svg).textContent = 't=0';
  el('text', { x: px(1) - 8, y: H - 8 }, svg).textContent = 't=1';

  const line1 = el('line', { class: 'handle-line' }, svg);
  const line2 = el('line', { class: 'handle-line' }, svg);
  const curve = el('path', { class: 'bez-curve' }, svg);
  const guide = el('line', { class: 'sweep-guide' }, svg);
  el('circle', { cx: px(0), cy: py(0), r: 5, class: 'anchor' }, svg);
  el('circle', { cx: px(1), cy: py(1), r: 5, class: 'anchor' }, svg);
  const h1 = el('circle', { r: 8, class: 'handle' }, svg);
  const h2 = el('circle', { r: 8, class: 'handle' }, svg);
  const dot = el('circle', { r: 6, class: 'sweep-dot' }, svg);

  let cp = [...PRESETS[0][1]];
  function redraw() {
    let d = '';
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      d += (d ? 'L' : 'M') + px(bx(t, cp[0], cp[2])).toFixed(1) + ' ' + py(bx(t, cp[1], cp[3])).toFixed(1);
    }
    curve.setAttribute('d', d);
    h1.setAttribute('cx', px(cp[0])); h1.setAttribute('cy', py(cp[1]));
    h2.setAttribute('cx', px(cp[2])); h2.setAttribute('cy', py(cp[3]));
    for (const [ln, hx] of [[line1, h1], [line2, h2]]) {
      const anchor = ln === line1 ? [px(0), py(0)] : [px(1), py(1)];
      ln.setAttribute('x1', anchor[0]); ln.setAttribute('y1', anchor[1]);
      ln.setAttribute('x2', hx.getAttribute('cx')); ln.setAttribute('y2', hx.getAttribute('cy'));
    }
    readout.textContent = `ease: [${cp.map((v) => v.toFixed(2)).join(', ')}]`;
  }

  // 拖拽控制点（x 锁定在 [0,1]，y 允许超界）
  let dragging = null;
  const toLocal = (e) => {
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
  };
  for (const [h, ix, iy] of [[h1, 0, 1], [h2, 2, 3]]) {
    h.addEventListener('pointerdown', (e) => { dragging = [ix, iy]; h.setPointerCapture(e.pointerId); });
  }
  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const [mx, my] = toLocal(e);
    cp[dragging[0]] = Math.min(1, Math.max(0, (mx - 56) / (W - 96)));
    cp[dragging[1]] = Math.min(1 + PAD, Math.max(-PAD,
      (H - 28 - my) / (H - 56) * (1 + 2 * PAD) - PAD));
    redraw();
  });
  svg.addEventListener('pointerup', () => { dragging = null; });

  root.querySelectorAll('[data-bez]').forEach((btn, i) => {
    btn.addEventListener('click', () => { cp = [...PRESETS[i][1]]; redraw(); });
  });

  // 扫掠点：t 匀速前进，高度 = ease 输出（直观感受节奏）
  rafLoop(svg, (dt, t) => {
    const T = 2.2, phase = (t % (T + 0.9));
    const tt = Math.min(phase / T, 1);
    const y = cubicBezier(tt, cp);
    dot.setAttribute('cx', px(tt)); dot.setAttribute('cy', py(y));
    dot.setAttribute('opacity', phase > T ? 0 : 1);
    guide.setAttribute('x1', px(tt)); guide.setAttribute('y1', py(y));
    guide.setAttribute('x2', px(tt)); guide.setAttribute('y2', py(0));
    guide.setAttribute('opacity', phase > T ? 0 : 1);
  });
  redraw();
}

// ============================================================
// B. 活 clip 轨道检视
// ============================================================
function initClipLive(root) {
  const stage = root.querySelector('.clip-stage');
  const bot = createGrokBot(stage, { size: 150, state: 'idle', seed: 'clip-demo' });
  const nameEl = root.querySelector('.clip-live-name');
  const sel = root.querySelector('[data-track]');
  const svg = root.querySelector('.clip-curve');
  const W = 560, H = 150, L = 44, R = 12, T = 10, B = 24;

  for (const [label] of TRACKS) {
    const o = document.createElement('option');
    o.textContent = label;
    sel.appendChild(o);
  }

  let recipes = null;
  fetch('js/vendor/grok-recipes.json').then((r) => r.json()).then((d) => { recipes = d; }).catch(() => {});

  // lids 轨道 = expression 轨道里 v:"blink" 事件经 gx 编译的三段关键帧
  function lidsOf(clip, C) {
    const out = [];
    for (const e of clip.tracks?.expression ?? []) {
      if (e.v !== 'blink') continue;
      out.push(
        { t: e.t, v: [0], ease: C.ease.nr },
        { t: e.t + C.durations.blink * 0.45, v: [1], ease: C.ease.nr },
        { t: e.t + C.durations.blink, v: [0], ease: C.ease.nr },
      );
    }
    return out.sort((a, b) => a.t - b.t);
  }

  let curClip = null, curvePath = null, kfGroup = null, playhead = null, playDot = null;
  const ALIAS = { scale: 'zoom', pos: 'position', rot: 'rotation', scl: 'squash', expr: 'expression' };

  function buildCurve(clip, trackName, idx) {
    svg.textContent = '';
    const C = recipes.constants;
    const rawName = ALIAS[trackName] ?? trackName;
    const kfs = trackName === 'lids'
      ? lidsOf(clip, C)
      : (clip.tracks?.[trackName] ?? []).map((k) => ({ t: k.t, v: k.v, ease: k.ease ?? C.ease.nr }));
    const dur = clip.duration;
    const px = (t) => L + (t / dur) * (W - L - R);

    if (kfs.length === 0) {
      el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'empty-label' }, svg)
        .textContent = `${t('index.js.clip.emptyPre')}${rawName}${t('index.js.clip.emptyPost')}`;
      return () => 0;
    }

    // 值域（含采样点，吸收过冲极值）
    let lo = Infinity, hi = -Infinity;
    const samples = [];
    for (let i = 0; i <= 220; i++) {
      const t = (i / 220) * dur;
      const v = evalTrack(kfs, t, idx, 0);
      samples.push([t, v]);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.18;
    lo -= pad; hi += pad;
    const py = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

    let d = '';
    for (const [t, v] of samples) d += (d ? 'L' : 'M') + px(t).toFixed(1) + ' ' + py(v).toFixed(1);
    curvePath = el('path', { d, class: 'clip-track-curve' }, svg);

    kfGroup = el('g', {}, svg);
    for (const k of kfs) {
      const kx = px(k.t), ky = py(k.v[idx]);
      el('path', {
        d: `M${kx} ${ky - 5}L${kx + 5} ${ky}L${kx} ${ky + 5}L${kx - 5} ${ky}Z`, class: 'kf-diamond',
      }, kfGroup).appendChild(document.createElementNS(SVGNS, 'title'))
        .textContent = `t=${k.t.toFixed(2)}s v=${k.v[idx].toFixed(2)} ease=[${k.ease.map((n) => +n.toFixed(2)).join(',')}]`;
    }
    el('text', { x: 4, y: py(hi - pad) + 4, class: 'axis-label' }, svg).textContent = (hi - pad).toFixed(2);
    el('text', { x: 4, y: py(lo + pad) + 4, class: 'axis-label' }, svg).textContent = (lo + pad).toFixed(2);
    el('text', { x: W - R, y: H - 8, 'text-anchor': 'end', class: 'axis-label' }, svg).textContent = `${dur}s`;

    playhead = el('line', { y1: T, y2: H - B, class: 'clip-playhead' }, svg);
    playDot = el('circle', { r: 4.5, class: 'clip-playdot' }, svg);
    return (t) => {
      const v = evalTrack(kfs, t, idx, 0);
      playhead.setAttribute('x1', px(t)); playhead.setAttribute('x2', px(t));
      playDot.setAttribute('cx', px(t)); playDot.setAttribute('cy', py(v));
      return v;
    };
  }

  let updatePlayhead = null;
  rafLoop(root.querySelector('.clip-live'), () => {
    if (!recipes) return;
    const snap = bot.debugFrame();
    if (!snap || !snap.clip) return;
    if (snap.clip !== curClip || updatePlayhead === null) {
      curClip = snap.clip;
      const clip = recipes.clips.find((c) => c.name === curClip);
      if (!clip) return;
      const [, trackName, idx] = TRACKS[sel.selectedIndex];
      updatePlayhead = buildCurve(clip, trackName, idx);
    }
    const time = Math.min(snap.time, snap.duration);
    const v = updatePlayhead(time);
    nameEl.textContent = `${snap.clip} · t=${time.toFixed(2)}s · ${t('index.js.clip.valueEq')}${v.toFixed(3)}`;
  });

  sel.addEventListener('change', () => { curClip = null; }); // 强制重建曲线
}
