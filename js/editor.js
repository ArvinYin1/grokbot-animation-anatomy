// 动画编辑器 v2 —— 主流动画编辑器交互（AE / Rive 式）：
//   底部时间轴：关键帧菱形可拖拽改时刻（吸附网格/其他关键帧，⌘ 关闭吸附）、双击空白添加、
//   单击空白取消选择、空白拖动框选、Shift+点加选/减选、多选整体平移、⌘C/⌘V 复制粘贴、
//   ←/→ 微调（Shift 加速）、Delete 批量删除、Esc 取消选择、⌘Z/⌘⇧Z 撤销重做；
//   播放头可拖 = scrub（引擎 frozenAt 确定性模式逐帧渲染）；
//   右侧检查器：选中关键帧编辑数值 + 可视化贝塞尔缓动；未选中时编辑 clip/状态配置。
// 数据模型与导出格式同 v1：与原引擎 clip/state JSON 完全同构。
import { createGrokBot } from './vendor/grok-player.js';

const $ = (s) => document.querySelector(s);

const TRACKS = [
  { key: 'position', label: '位置 position', comps: ['x', 'y'], step: 0.05, def: [0, 0], hint: '单位：身体半径', color: '#2e6bff' },
  { key: 'rotation', label: '旋转 rotation', comps: ['pitch', 'yaw', 'roll'], step: 1, def: [0, 0, 0], hint: '单位：度', color: '#8a5cf6' },
  { key: 'squash', label: '挤压 squash', comps: ['x 倍率', 'y 倍率'], step: 0.05, def: [1, 1], hint: '1 = 不变形', color: '#0ea5e9' },
  { key: 'scale', label: '缩放 scale', comps: ['倍率'], step: 0.05, def: [1], hint: '1 = 原始大小', color: '#0d9488' },
  { key: 'lids', label: '眼睑 lids', comps: ['闭合'], step: 0.05, def: [0], hint: '0 睁开 → 1 闭合', color: '#e11d48' },
];
const EXPR_TRACK = { key: 'expression', label: '表情事件', color: '#ff8a3d' };
const EASE_PRESETS = [
  ['引擎默认', [0.42, 0, 0.58, 1]],
  ['线性', [0, 0, 1, 1]],
  ['缓入', [0.42, 0, 1, 1]],
  ['缓出', [0, 0, 0.58, 1]],
  ['回弹', [0.34, 1.56, 0.64, 1]],
];

const PPS = 140;      // 时间轴：像素/秒
const LABEL_W = 150;  // 轨道名称列宽

let recipes = null;
let clip = null;                       // 编辑中的 clip（导出格式）
let st = { face: '', morph: '', next: '', holdSeconds: '' };
let sel = null;                        // 主选中关键帧 { track, i }（检查器/拖拽基准）
let selKeys = new Set();               // 全部选中关键帧 'track:i'（排序后索引）
let mode = 'play';                     // 'play'（真引擎循环）| 'scrub'（frozenAt 单帧）
let scrubT = 0;
let liveBot = null, frozenBot = null;
let previewTimer = 0;
let playT0 = 0;                        // play 模式循环相位基准（performance.now()）

const blankClip = () => ({
  name: 'MyClip_A', duration: 4, body: 'sphere', squashAnchor: 0,
  workArea: null, inspect: { bias: -1, follow: true }, tracks: {},
});
const trackDef = (key) => TRACKS.find((t) => t.key === key);

// ---------- 通用帮助 ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v) => String(+Number(v).toFixed(3)); // 显示 2-3 位小数；提交时 parseFloat 保留全精度
const clampT = (t) => Math.min(clip.duration, Math.max(0, t));

// ---------- 选择集 ----------
const kfKey = (track, i) => `${track}:${i}`;
const isSel = (track, i) => selKeys.has(kfKey(track, i));
const firstSel = () => { // 选择集中任取一个作为主选中
  const k0 = [...selKeys][0];
  if (!k0) return null;
  const ci = k0.lastIndexOf(':');
  return { track: k0.slice(0, ci), i: +k0.slice(ci + 1) };
};
function clearSel() {
  if (!selKeys.size) return;
  selKeys.clear(); sel = null;
  renderTimeline(); renderInspector();
}
// 选中关键帧的对象引用（mutation 引起重排后用它恢复选择）
function selRefs() {
  const refs = [];
  for (const key of selKeys) {
    const ci = key.lastIndexOf(':');
    const track = key.slice(0, ci), i = +key.slice(ci + 1);
    const kf = sortedKfs(track)[i];
    if (kf) refs.push({ track, kf });
  }
  return refs;
}
function restoreSel(refs) {
  const list = [];
  for (const { track, kf } of refs) {
    const i = (clip.tracks[track] ?? []).indexOf(kf);
    if (i >= 0) list.push({ track, i });
  }
  selKeys = new Set(list.map(({ track, i }) => kfKey(track, i)));
  sel = list.length ? list[list.length - 1] : null;
}

// ---------- 撤销 / 重做 ----------
const UNDO_MAX = 50;
let undoStack = [], redoStack = [];
const snapState = () => JSON.stringify({ clip, st, sel: [...selKeys], anchor: sel });
function pushUndo() {
  if (!clip) return;
  const s = snapState();
  if (undoStack[undoStack.length - 1] === s) return; // 无实际变化不压栈、不清 redo
  undoStack.push(s);
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack = [];
}
// 同一字段的连续输入（键入 / 步进 / 方向键微调）合并为一步：窗口期内的重复 push 忽略
let coKey = null, coTimer = 0;
function pushUndoCo(key) {
  if (key !== coKey) { pushUndo(); coKey = key; }
  clearTimeout(coTimer);
  coTimer = setTimeout(() => { coKey = null; }, 900);
}
function applySnap(s) {
  const o = JSON.parse(s);
  clip = o.clip; st = o.st;
  selKeys = new Set(o.sel ?? []); sel = o.anchor ?? null;
  renderTimeline(); renderInspector(); schedulePreview();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapState());
  applySnap(undoStack.pop());
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapState());
  applySnap(redoStack.pop());
}

// ---------- 模型 → 导出对象 ----------
function exportClip() {
  const c = {
    name: clip.name, duration: clip.duration, body: 'sphere',
    squashAnchor: clip.squashAnchor ?? 0,
    workArea: clip.workArea, inspect: { bias: -1, follow: !!clip.inspect?.follow },
    tracks: {},
  };
  for (const { key } of TRACKS) {
    const kfs = (clip.tracks[key] ?? []).slice().sort((a, b) => a.t - b.t);
    if (kfs.length) c.tracks[key] = kfs;
  }
  const expr = (clip.tracks.expression ?? []).slice().sort((a, b) => a.t - b.t);
  if (expr.length) c.tracks.expression = expr.map((e) =>
    e.cut === false ? { t: e.t, v: e.v, cut: false } : { t: e.t, v: e.v });
  return c;
}
function exportState() {
  const s = { clips: [clip.name] };
  if (st.face) s.face = st.face;
  if (st.morph) s.morph = st.morph;
  if (st.next) s.next = st.next;
  const h = parseFloat(st.holdSeconds);
  if (Number.isFinite(h) && st.next) s.holdSeconds = h;
  return s;
}
function updateExport() {
  $('#ed-json').value = JSON.stringify({ clip: exportClip(), state: exportState() }, null, 2);
}
function buildData() {
  const data = structuredClone(recipes);
  const exp = exportClip();
  const i = data.clips.findIndex((c) => c.name === exp.name);
  if (i >= 0) data.clips[i] = exp; else data.clips.push(exp);
  data.states._editor = exportState();
  return data;
}

// ---------- 预览 ----------
function schedulePreview() {
  updateExport();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(rebuildPreview, 120); // 拖拽中也能跟手（play/scrub 同一防抖）
}
// play 模式当前循环时刻（按循环时长推算；引擎 firstPhase=0 与之对齐）
const loopPhase = () => (clip ? ((performance.now() - playT0) / 1000) % clip.duration : 0);
function rebuildPreview() {
  if (!recipes || !clip) return;
  updateExport();
  if (mode === 'play') {
    const phase = liveBot ? loopPhase() : 0; // 重建前相位，尽量不打断循环
    frozenBot?.destroy(); frozenBot = null;
    liveBot?.destroy();
    liveBot = createGrokBot($('#ed-stage'), {
      size: 280, state: '_editor', data: buildData(), seed: 'editor',
      follow: $('#ed-follow').checked, firstPhase: 0,
    });
    playT0 = performance.now() - phase * 1000;
  } else {
    liveBot?.destroy(); liveBot = null;
    frozenBot?.destroy();
    frozenBot = createGrokBot($('#ed-stage'), {
      size: 280, state: '_editor', data: buildData(), seed: 'editor', frozenAt: scrubT,
    });
  }
}
function setMode(m) {
  if (mode === m) return;
  if (m === 'play') playT0 = performance.now() - scrubT * 1000; // 从 scrub 点继续循环
  mode = m;
  $('#ed-playpause').textContent = m === 'play' ? '⏸ 暂停' : '▶ 播放';
  $('#ed-playhead').style.display = m === 'play' ? 'none' : '';
  updateTimeLabel();
  rebuildPreview();
}
function updateTimeLabel() {
  if (mode !== 'play') $('#ed-time').textContent = `t = ${scrubT.toFixed(2)}s / ${clip.duration}s`;
}
// play 模式时刻读数：rAF 实时刷新循环时刻
(function tick() {
  if (mode === 'play' && clip)
    $('#ed-time').textContent = `t = ${loopPhase().toFixed(2)}s / ${clip.duration}s（循环）`;
  requestAnimationFrame(tick);
})();

// ---------- 时间轴 ----------
function tlWidth() {
  return Math.max($('#ed-tl').clientWidth - LABEL_W, clip.duration * PPS + 60);
}
function renderTimeline() {
  const W = tlWidth();
  // 标尺
  let ruler = `<div class="ed2-corner" style="width:${LABEL_W}px"></div><div class="ed2-ruler-track" style="width:${W}px">`;
  for (let t = 0; t <= clip.duration + 1e-6; t += 0.5) {
    const major = Math.abs(t - Math.round(t)) < 1e-6;
    ruler += `<i class="${major ? 'major' : ''}" style="left:${t * PPS}px"></i>`;
    if (major) ruler += `<b style="left:${t * PPS + 4}px">${Math.round(t)}s</b>`;
  }
  $('#ed-ruler').innerHTML = ruler + '</div>';
  // workArea（rest 帧）高亮色带：start → end（缺省 = duration）
  const wa = $('#ed-workarea');
  if (clip.workArea && Number.isFinite(+clip.workArea.start)) {
    const w0 = +clip.workArea.start, w1 = Number.isFinite(+clip.workArea.end) ? +clip.workArea.end : clip.duration;
    wa.style.display = '';
    wa.style.left = `${LABEL_W + w0 * PPS}px`;
    wa.style.width = `${Math.max(0, w1 - w0) * PPS}px`;
  } else wa.style.display = 'none';
  // 轨道
  const lanes = [...TRACKS, EXPR_TRACK].map((tr) => {
    const kfs = (clip.tracks[tr.key] ?? []).slice().sort((a, b) => a.t - b.t);
    const dots = kfs.map((kf, i) =>
      `<i class="ed2-kf${tr.key === 'expression' ? ' expr' : ''}${isSel(tr.key, i) ? ' sel' : ''}" ` +
      `style="left:${kf.t * PPS}px;--kc:${tr.color}" data-track="${tr.key}" data-i="${i}" ` +
      `title="${tr.key === 'expression' ? `${esc(kf.v)} · ` : ''}t=${kf.t.toFixed(2)}s"></i>`).join('');
    return `<div class="ed2-lane">
      <div class="ed2-lane-label" style="width:${LABEL_W}px">
        <i style="background:${tr.color}"></i>${tr.label}
        <button class="ed2-add" data-add="${tr.key}" title="在播放头处添加">+</button>
      </div>
      <div class="ed2-lane-track" data-lane="${tr.key}" style="width:${W}px">${dots}</div>
    </div>`;
  }).join('');
  $('#ed-lanes').innerHTML = lanes;
  positionPlayhead();
}
function positionPlayhead() {
  $('#ed-playhead').style.left = `${LABEL_W + scrubT * PPS}px`;
}
// 显示用的排序索引（模型数组保持插入序，渲染/选中用排序后索引）
function sortedKfs(track) {
  return (clip.tracks[track] ?? []).slice().sort((a, b) => a.t - b.t);
}
// 在指定轨道、指定时刻添加关键帧并选中（t 统一 clamp 到 [0, duration]）
function addKfAt(track, t) {
  t = clampT(+t.toFixed(3));
  const list = clip.tracks[track] ??= [];
  if (track === 'expression') list.push({ t, v: 'blink' });
  else { const tr = trackDef(track); list.push({ t, v: [...tr.def], ease: [...EASE_PRESETS[0][1]] }); }
  list.sort((a, b) => a.t - b.t);
  const i = list.findIndex((k) => k.t === t);
  selKeys = new Set([kfKey(track, i)]); sel = { track, i };
  renderTimeline(); renderInspector(); schedulePreview();
}

// 拖拽吸附：0.05s 网格 / 其他关键帧时刻，±3px 内吸附（返回吸附后的 t）
function snapT(t, exclude) {
  let best = null, bestD = 3 / PPS + 1e-9;
  const g = Math.round(t / 0.05) * 0.05;
  if (Math.abs(g - t) < bestD) { best = g; bestD = Math.abs(g - t); }
  for (const arr of Object.values(clip.tracks))
    for (const kf of arr ?? []) {
      if (exclude?.has(kf)) continue;
      const d = Math.abs(kf.t - t);
      if (d < bestD) { best = kf.t; bestD = d; }
    }
  return best ?? t;
}

// ---------- 检查器 ----------
function renderInspector() {
  const el = $('#ed-inspector');
  if (selKeys.size > 1) {
    el.innerHTML = `
      <h3 class="ed-h">已选 ${selKeys.size} 个关键帧</h3>
      <p class="hint">拖动任一选中菱形可整体平移（保持相对间隔）；←/→ 整体微调；
        ⌘C 复制、⌘V 粘贴到播放头；Esc 取消选择。</p>
      <div class="controls"><button data-kf="delete">删除这 ${selKeys.size} 个关键帧</button></div>`;
    return;
  }
  if (sel) return renderKfInspector(el, sel.track, sortedKfs(sel.track)[sel.i]);
  el.innerHTML = `
    <h3 class="ed-h">Clip 配置</h3>
    <div class="ed-form">
      <label>从现有 clip 开始
        <select data-ins="template"><option value="">（从空白开始）</option>
          ${recipes.clips.map((c) => `<option ${c.name === clip.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select></label>
      <label>名称 <input type="text" data-ins="name" value="${esc(clip.name)}"></label>
      <label>时长（秒） <input type="number" data-ins="duration" min="0.2" step="0.1" value="${fmt(clip.duration)}"></label>
      <label>squashAnchor <input type="number" data-ins="anchor" min="0" max="1" step="0.05" value="${fmt(clip.squashAnchor ?? 0)}"></label>
      <label>rest 帧时刻 <input type="number" data-ins="rest" min="0" step="0.1" placeholder="（空 = 0）"
        value="${clip.workArea ? fmt(clip.workArea.start) : ''}"></label>
      <label class="ed-check"><input type="checkbox" data-ins="follow" ${clip.inspect?.follow !== false ? 'checked' : ''}>
        允许视线跟随（inspect.follow）</label>
    </div>
    <h3 class="ed-h">状态配置（state）</h3>
    <div class="ed-form">
      <label>表情 face <select data-ins="face"><option value="">（无）</option>
        ${recipes.expressionNames.map((n) => `<option ${st.face === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>morph 装饰 <select data-ins="morph"><option value="">（无）</option>
        ${Object.keys(recipes.constants.morph.stateMap).map((n) => `<option ${st.morph === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>播完自动转移 next <select data-ins="next"><option value="">（无）</option>
        ${Object.keys(recipes.states).map((n) => `<option ${st.next === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>停留秒数 holdSeconds <input type="number" data-ins="hold" min="0" step="0.1"
        placeholder="（空 = 立即）" value="${esc(st.holdSeconds)}"></label>
    </div>
    <p class="hint">点击时间轴上的菱形可编辑单个关键帧；单击空白处取消选择回到本面板。</p>`;
}

function renderKfInspector(el, track, kf) {
  if (!kf) { selKeys.delete(kfKey(track, sel.i)); sel = null; return renderInspector(); }
  const tr = trackDef(track);
  if (track === 'expression') {
    const names = [...recipes.expressionNames, 'blink'];
    el.innerHTML = `
      <h3 class="ed-h">表情事件 · t=${kf.t.toFixed(2)}s</h3>
      <div class="ed-form">
        <label>t（秒） <input type="number" data-kf="t" step="0.05" min="0" value="${fmt(kf.t)}"></label>
        <label>表情 <select data-kf="name">
          ${names.map((n) => `<option ${n === kf.v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="ed-check"><input type="checkbox" data-kf="cut" ${kf.cut === false ? 'checked' : ''}>
          经由闭眼过渡（through-blink）</label>
      </div>
      <p class="hint">blink 会被引擎展开成 0.26s 眨眼（45% 处闭合）。</p>
      <div class="controls"><button data-kf="delete">删除此事件</button></div>`;
    return;
  }
  const ease = kf.ease ?? EASE_PRESETS[0][1];
  // 当前 ease 与某预设一致时回显预设名，否则显示「自定义」
  const presetIdx = EASE_PRESETS.findIndex(([, p]) => p.every((v, j) => Math.abs(v - ease[j]) < 1e-6));
  el.innerHTML = `
    <h3 class="ed-h">${esc(tr.label)} · 关键帧 t=${kf.t.toFixed(2)}s</h3>
    <div class="ed-form">
      <label>t（秒） <input type="number" data-kf="t" step="0.05" min="0" value="${fmt(kf.t)}"></label>
      ${tr.comps.map((c, j) => `<label>${esc(c)} <input type="number" data-kf="v${j}"
        step="${tr.step}" value="${fmt(kf.v[j] ?? tr.def[j])}"></label>`).join('')}
    </div>
    <h3 class="ed-h">缓动（进入下一段）</h3>
    <div class="ed2-ease-row">
      <svg id="ed-bezier" viewBox="0 0 240 160"></svg>
      <div>
        <select data-kf="epreset"><option value="" ${presetIdx < 0 ? 'selected' : ''}>自定义</option>
          ${EASE_PRESETS.map(([n, p], k) => `<option value="${k}" ${k === presetIdx ? 'selected' : ''}>${n} [${p}]</option>`).join('')}
        </select>
        <div class="ed-ease-nums">${ease.map((e, j) =>
          `<input type="number" data-kf="e${j}" step="0.01" value="${fmt(e)}">`).join('')}</div>
        <p class="hint">拖曲线上的两个手柄。</p>
      </div>
    </div>
    <div class="controls"><button data-kf="delete">删除此关键帧</button></div>`;
  drawBezier(ease);
}

// ---------- 贝塞尔曲线编辑器 ----------
// 画布 240×160：X ∈ [20, 220] 映射 t ∈ [0, 1]；Y 基线 128、64px/单位（v ∈ [-0.45, 1.45] 均可视）
function drawBezier(ease) {
  const svg = $('#ed-bezier');
  if (!svg) return;
  const X = (v) => 20 + v * 200, Y = (v) => 128 - v * 64;
  const HR = 7; // 手柄半径；绘制坐标钳到画布内（留半径余量）
  const cx = (v) => Math.min(240 - HR, Math.max(HR, X(v)));
  const cy = (v) => Math.min(160 - HR, Math.max(HR, Y(v)));
  const [x1, y1, x2, y2] = ease;
  svg.innerHTML = `
    <line x1="20" y1="128" x2="220" y2="128" class="bz-grid"/>
    <line x1="20" y1="64" x2="220" y2="64" class="bz-grid"/>
    <line x1="20" y1="128" x2="220" y2="64" class="bz-grid dash"/>
    <line x1="${X(0)}" y1="${Y(0)}" x2="${cx(x1)}" y2="${cy(y1)}" class="bz-arm"/>
    <line x1="${X(1)}" y1="${Y(1)}" x2="${cx(x2)}" y2="${cy(y2)}" class="bz-arm"/>
    <path d="M${X(0)} ${Y(0)} C${X(x1)} ${Y(y1)} ${X(x2)} ${Y(y2)} ${X(1)} ${Y(1)}" class="bz-curve"/>
    <circle data-h="0" cx="${cx(x1)}" cy="${cy(y1)}" r="${HR}" class="bz-handle"/>
    <circle data-h="1" cx="${cx(x2)}" cy="${cy(y2)}" r="${HR}" class="bz-handle"/>`;
  svg.querySelectorAll('.bz-handle').forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      let pushed = false; // 首次真正移动才压快照
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const px = (ev.clientX - r.left) * (240 / r.width), py = (ev.clientY - r.top) * (160 / r.height);
        const vx = Math.min(1, Math.max(0, (px - 20) / 200));
        const vy = Math.min(1.45, Math.max(-0.45, (128 - py) / 64));
        const kf2 = sel && sortedKfs(sel.track)[sel.i];
        if (!kf2) return;
        if (!pushed) { pushUndo(); pushed = true; }
        kf2.ease ??= [...EASE_PRESETS[0][1]];
        kf2.ease[+h.dataset.h * 2] = +vx.toFixed(3);
        kf2.ease[+h.dataset.h * 2 + 1] = +vy.toFixed(3);
        drawBezier(kf2.ease); // 重画（手柄事件随之重建）
        schedulePreview();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        renderInspector();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  });
}

// ---------- 时间轴交互 ----------
function bindTimeline() {
  const tl = $('#ed-tl');

  // 标尺拖动 = scrub
  $('#ed-ruler').addEventListener('pointerdown', (e) => {
    setMode('scrub');
    const track = e.currentTarget.querySelector('.ed2-ruler-track');
    const move = (ev) => {
      const r = track.getBoundingClientRect();
      scrubT = Math.min(clip.duration, Math.max(0, (ev.clientX - r.left) / PPS));
      positionPlayhead(); updateTimeLabel(); schedulePreview();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    move(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // 菱形：点选 / Shift 加选减选 / 拖拽改时刻（多选整体平移，按住 Cmd 临时关闭吸附）
  tl.addEventListener('pointerdown', (e) => {
    const kfEl = e.target.closest('.ed2-kf');
    if (!kfEl) return;
    e.preventDefault();
    const track = kfEl.dataset.track;
    const i = +kfEl.dataset.i;
    const key = kfKey(track, i);
    if (e.shiftKey) { // 加选 / 减选，不进入拖拽
      if (selKeys.has(key)) {
        selKeys.delete(key);
        if (sel && sel.track === track && sel.i === i) sel = firstSel();
      } else { selKeys.add(key); sel = { track, i }; }
      renderTimeline(); renderInspector(); return;
    }
    if (!selKeys.has(key)) selKeys = new Set([key]); // 点中未选中的 = 单选它
    sel = { track, i };
    renderTimeline(); renderInspector();
    const lane = tl.querySelector(`[data-lane="${track}"]`);
    const anchorKf = sortedKfs(track)[i];
    if (!anchorKf) return;
    // 全部选中关键帧（含拖拽基准）：对象引用 + 起始时刻 + DOM 元素
    const members = [];
    for (const k of selKeys) {
      const ci = k.lastIndexOf(':');
      const tr = k.slice(0, ci), ii = +k.slice(ci + 1);
      const kf = sortedKfs(tr)[ii];
      if (kf) members.push({
        track: tr, kf, t0: kf.t,
        el: tl.querySelector(`.ed2-kf[data-track="${tr}"][data-i="${ii}"]`),
      });
    }
    let moved = false, pushed = false;
    const anchorT0 = anchorKf.t;
    const move = (ev) => {
      const r = lane.getBoundingClientRect();
      let t = (ev.clientX - r.left) / PPS;
      if (!ev.metaKey && !ev.ctrlKey) t = snapT(t, new Set(members.map((m) => m.kf)));
      const t0s = members.map((m) => m.t0);
      // 整体平移：dt 钳制保证所有成员留在 [0, duration]，相对间隔不变
      const dt = Math.min(clip.duration - Math.max(...t0s),
        Math.max(-Math.min(...t0s), clampT(t) - anchorT0));
      if (!pushed) { pushUndo(); pushed = true; } // 首次真正移动才压快照
      for (const m of members) {
        m.kf.t = +(m.t0 + dt).toFixed(3);
        if (m.el) { m.el.style.left = `${m.kf.t * PPS}px`; m.el.title = `t=${m.kf.t.toFixed(2)}s`; }
      }
      moved = true;
      schedulePreview(); // 拖拽中实时预览（内部已防抖）
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) {
        for (const tr of new Set(members.map((m) => m.track)))
          clip.tracks[tr] = clip.tracks[tr].slice().sort((a, b) => a.t - b.t);
        restoreSel(members);
        const ai = (clip.tracks[track] ?? []).indexOf(anchorKf);
        if (ai >= 0) sel = { track, i: ai };
        renderTimeline(); renderInspector(); schedulePreview();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // 框选：轨道空白按下拖动超过 4px 判定为框选（与单击取消选择、双击添加共存）
  let suppressClick = false;
  tl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.ed2-kf') || e.target.closest('.ed2-add') || e.target.closest('#ed-ruler')) return;
    const startX = e.clientX, startY = e.clientY;
    let box = null, active = false;
    const move = (ev) => {
      if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      if (!active) {
        active = true;
        box = document.createElement('div');
        box.className = 'ed2-marquee';
        tl.appendChild(box);
      }
      const r = tl.getBoundingClientRect();
      const x = (v) => v - r.left + tl.scrollLeft, y = (v) => v - r.top + tl.scrollTop;
      box.style.left = `${Math.min(x(startX), x(ev.clientX))}px`;
      box.style.top = `${Math.min(y(startY), y(ev.clientY))}px`;
      box.style.width = `${Math.abs(ev.clientX - startX)}px`;
      box.style.height = `${Math.abs(ev.clientY - startY)}px`;
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      box?.remove();
      if (!active) return;
      suppressClick = true; // 阻止紧随的 click 把刚框选的选择清掉
      const mx0 = Math.min(startX, ev.clientX), mx1 = Math.max(startX, ev.clientX);
      const my0 = Math.min(startY, ev.clientY), my1 = Math.max(startY, ev.clientY);
      const list = [];
      tl.querySelectorAll('[data-lane]').forEach((laneEl) => {
        const r = laneEl.getBoundingClientRect();
        if (r.bottom < my0 || r.top > my1) return;
        const track = laneEl.dataset.lane;
        sortedKfs(track).forEach((kf, i) => {
          const kx = r.left + kf.t * PPS;
          if (kx >= mx0 && kx <= mx1) list.push({ track, i });
        });
      });
      selKeys = new Set(list.map(({ track, i }) => kfKey(track, i)));
      sel = list.length ? list[list.length - 1] : null;
      renderTimeline(); renderInspector();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // 单击轨道/面板空白：取消选择（回到 clip 配置面板）
  tl.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    if (e.target.closest('.ed2-kf') || e.target.closest('.ed2-add') || e.target.closest('#ed-ruler')) return;
    clearSel();
  });

  // 双击轨道空白：在该时刻添加关键帧（Rive 范式）
  tl.addEventListener('dblclick', (e) => {
    if (e.target.closest('.ed2-kf') || e.target.closest('.ed2-add') || e.target.closest('#ed-ruler')) return;
    const lane = e.target.closest('[data-lane]');
    if (!lane) return;
    const r = lane.getBoundingClientRect();
    pushUndo();
    addKfAt(lane.dataset.lane, (e.clientX - r.left) / PPS);
  });

  // 轨道 label 上的 + ：在播放头处添加（play 模式先跳到当前循环时刻的 scrub 状态）
  tl.addEventListener('click', (e) => {
    const add = e.target.closest('.ed2-add');
    if (!add) return;
    pushUndo();
    if (mode !== 'scrub') { scrubT = clampT(+loopPhase().toFixed(3)); setMode('scrub'); }
    addKfAt(add.dataset.add, scrubT);
  });

  // Esc 取消选择；Delete 批量删除；←/→ 微调 ±0.01s、Shift+←/→ ±0.1s（多选整体平移）
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'Escape') { clearSel(); return; }
    if (!selKeys.size) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      pushUndo();
      for (const { track, kf } of selRefs()) {
        const arr = clip.tracks[track];
        const j = arr.indexOf(kf);
        if (j >= 0) arr.splice(j, 1);
      }
      selKeys.clear(); sel = null;
      renderTimeline(); renderInspector(); schedulePreview();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const refs = selRefs();
      if (!refs.length) return;
      e.preventDefault();
      pushUndoCo(`nudge:${[...selKeys].sort().join(',')}`);
      const d = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowRight' ? 1 : -1);
      const t0s = refs.map((r) => r.kf.t);
      const dt = Math.min(clip.duration - Math.max(...t0s), Math.max(-Math.min(...t0s), d));
      for (const r of refs) r.kf.t = clampT(+(r.kf.t + dt).toFixed(3));
      for (const tr of new Set(refs.map((r) => r.track)))
        clip.tracks[tr] = clip.tracks[tr].slice().sort((a, b) => a.t - b.t);
      const aTrack = sel?.track, aKf = refs.find((r) => r.track === aTrack)?.kf;
      restoreSel(refs);
      if (aKf) sel = { track: aTrack, i: clip.tracks[aTrack].indexOf(aKf) };
      renderTimeline(); renderInspector(); schedulePreview();
    }
  });
}

// ---------- 检查器 / 表单事件（委托） ----------
function bindInspector() {
  const el = $('#ed-inspector');
  const onEdit = (e) => {
    const ins = e.target.dataset.ins, kfF = e.target.dataset.kf;
    if (ins) {
      if (ins === 'template') {
        const src = recipes.clips.find((c) => c.name === e.target.value);
        if (!src) return;
        if (!confirm('切换模板将丢弃当前编辑，确定吗？')) { renderInspector(); return; }
        pushUndo();
        clip = structuredClone(src); sel = null; selKeys.clear();
        renderTimeline(); renderInspector(); schedulePreview(); return;
      }
      pushUndoCo(`ins:${ins}`);
      if (ins === 'name') clip.name = e.target.value || 'MyClip_A';
      else if (ins === 'duration') {
        clip.duration = Math.max(0.2, parseFloat(e.target.value) || 4);
        // duration 改小：所有轨道里 t > duration 的关键帧钳到 duration（导出永远 t ≤ duration）
        let clamped = 0;
        for (const arr of Object.values(clip.tracks))
          for (const kf of arr ?? []) if (kf.t > clip.duration) { kf.t = clip.duration; clamped++; }
        if (clamped) {
          const refs = selRefs();
          for (const k of Object.keys(clip.tracks))
            clip.tracks[k] = clip.tracks[k].slice().sort((a, b) => a.t - b.t);
          restoreSel(refs);
        }
        renderTimeline();
      }
      else if (ins === 'anchor') clip.squashAnchor = Math.min(1, Math.max(0, parseFloat(e.target.value) || 0));
      else if (ins === 'rest') {
        const v = parseFloat(e.target.value);
        clip.workArea = Number.isFinite(v) ? { start: v, end: clip.duration } : null;
        renderTimeline(); // workArea 色带即时刷新
      } else if (ins === 'follow') clip.inspect = { bias: -1, follow: e.target.checked };
      else if (ins === 'face') st.face = e.target.value;
      else if (ins === 'morph') st.morph = e.target.value;
      else if (ins === 'next') st.next = e.target.value;
      else if (ins === 'hold') st.holdSeconds = e.target.value;
      schedulePreview(); return;
    }
    if (!kfF || !sel) return;
    const kf = sortedKfs(sel.track)[sel.i];
    if (!kf) return;
    pushUndoCo(`kf:${sel.track}:${sel.i}:${kfF}`);
    if (kfF === 't') {
      kf.t = clampT(parseFloat(e.target.value) || 0);
      clip.tracks[sel.track].sort((a, b) => a.t - b.t);
      const ni = sortedKfs(sel.track).indexOf(kf);
      sel = { track: sel.track, i: ni };
      selKeys = new Set([kfKey(sel.track, ni)]);
      renderTimeline(); renderInspector();
    } else if (kfF.startsWith('v')) kf.v[+kfF.slice(1)] = parseFloat(e.target.value) || 0;
    else if (/^e\d$/.test(kfF)) { kf.ease ??= [...EASE_PRESETS[0][1]]; kf.ease[+kfF.slice(1)] = parseFloat(e.target.value) || 0; drawBezier(kf.ease); }
    else if (kfF === 'epreset' && e.target.value !== '') { kf.ease = [...EASE_PRESETS[+e.target.value][1]]; renderInspector(); }
    else if (kfF === 'name') kf.v = e.target.value;
    else if (kfF === 'cut') kf.cut = e.target.checked ? false : undefined;
    schedulePreview();
  };
  el.addEventListener('change', onEdit);
  el.addEventListener('input', (e) => { if (e.target.dataset.kf?.startsWith('v')) onEdit(e); });
  el.addEventListener('click', (e) => {
    if (e.target.dataset.kf !== 'delete' || !selKeys.size) return;
    pushUndo();
    for (const { track, kf } of selRefs()) {
      const arr = clip.tracks[track];
      const j = arr.indexOf(kf);
      if (j >= 0) arr.splice(j, 1);
    }
    selKeys.clear(); sel = null;
    renderTimeline(); renderInspector(); schedulePreview();
  });
}

// ---------- 导出 / 导入 / 走带 ----------
function bindStatic() {
  $('#ed-playpause').addEventListener('click', () => setMode(mode === 'play' ? 'scrub' : 'play'));
  $('#ed-follow').addEventListener('change', rebuildPreview);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.closest('input, textarea, select')) {
      e.preventDefault(); setMode(mode === 'play' ? 'scrub' : 'play');
    }
  });
  // Cmd/Ctrl+Z 撤销，Cmd/Ctrl+Shift+Z 或 Cmd/Ctrl+Y 重做（输入框聚焦时不劫持）
  window.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k !== 'z' && k !== 'y') return;
    if (e.target.closest('input, textarea, select')) return;
    e.preventDefault();
    if (k === 'y' || (k === 'z' && e.shiftKey)) redo(); else undo();
  });
  // Cmd/Ctrl+C 复制选中关键帧；Cmd/Ctrl+V 在播放头/scrub 时刻粘贴（输入框聚焦时不劫持）
  window.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k !== 'c' && k !== 'v') return;
    if (e.target.closest('input, textarea, select')) return;
    if (k === 'c') {
      if (!selKeys.size) return;
      e.preventDefault();
      const items = selRefs().map(({ track, kf }) => ({ track, kf: structuredClone(kf) }));
      navigator.clipboard.writeText(JSON.stringify({ __edKfs: items })).catch(() => {});
      return;
    }
    e.preventDefault();
    navigator.clipboard.readText().then((txt) => {
      let items;
      try {
        const o = JSON.parse(txt);
        if (!Array.isArray(o?.__edKfs)) return;
        items = o.__edKfs.filter((it) =>
          (trackDef(it.track) || it.track === 'expression') && it.kf && Number.isFinite(+it.kf.t));
        if (!items.length) return;
      } catch { return; }
      pushUndo();
      const target = mode === 'scrub' ? scrubT : clampT(+loopPhase().toFixed(3)); // 与「+」一致：play 模式对齐循环相位
      const tMin = Math.min(...items.map((it) => +it.kf.t));
      const pasted = [];
      for (const { track, kf } of items) {
        const list = clip.tracks[track] ??= [];
        let t = clampT(+kf.t + target - tMin);
        // 重叠错开 0.001s；到达 duration 边界仍重叠时保留重叠落点（保证必然终止）
        while (list.some((k) => Math.abs(k.t - t) < 1e-9)) {
          if (t + 0.001 > clip.duration) break;
          t = +(t + 0.001).toFixed(3);
        }
        list.push(kf); kf.t = t;
        pasted.push({ track, kf });
      }
      for (const tr of new Set(pasted.map((p) => p.track)))
        clip.tracks[tr] = clip.tracks[tr].slice().sort((a, b) => a.t - b.t);
      restoreSel(pasted);
      renderTimeline(); renderInspector(); schedulePreview();
    }).catch(() => {});
  });
  $('#ed-copy').addEventListener('click', async (e) => {
    await navigator.clipboard.writeText($('#ed-json').value);
    e.target.textContent = '已复制 ✓'; setTimeout(() => { e.target.textContent = '复制 JSON'; }, 1200);
  });
  const dl = (name, obj) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#ed-dl-clip').addEventListener('click', () => dl(`${clip.name}.clip.json`, exportClip()));
  $('#ed-dl-state').addEventListener('click', () => dl(`${clip.name}.state.json`, exportState()));
  $('#ed-import').addEventListener('click', () => {
    try {
      const obj = JSON.parse($('#ed-json').value);
      const c = obj.clip ?? obj;
      if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('不是有效的 clip 对象');
      if (typeof c.name !== 'string' || !c.name) throw new Error('缺少 clip.name');
      if (!Number.isFinite(+c.duration) || +c.duration <= 0) throw new Error('缺少有效的 duration');
      if (!c.tracks || typeof c.tracks !== 'object' || Array.isArray(c.tracks)) throw new Error('缺少 tracks');
      pushUndo();
      clip = c; sel = null; selKeys.clear();
      clip.duration = +clip.duration;
      // 逐轨道校验：剔除非法关键帧，t 统一 clamp 到 [0, duration]
      for (const k of Object.keys(clip.tracks)) {
        const arr = clip.tracks[k];
        if (!Array.isArray(arr)) { delete clip.tracks[k]; continue; }
        clip.tracks[k] = arr
          .filter((kf) => kf && typeof kf === 'object' && Number.isFinite(+kf.t))
          .map((kf) => { kf.t = clampT(+kf.t); return kf; })
          .sort((a, b) => a.t - b.t);
      }
      if (obj.state) {
        const s = obj.state;
        st.face = typeof s.face === 'string' ? s.face : '';
        st.morph = typeof s.morph === 'string' ? s.morph : '';
        st.next = typeof s.next === 'string' ? s.next : '';
        st.holdSeconds = Number.isFinite(+s.holdSeconds) ? s.holdSeconds : '';
      }
      renderTimeline(); renderInspector(); schedulePreview();
    } catch (err) { alert(`JSON 解析失败：${err.message}`); }
  });
}

// ---------- 启动 ----------
fetch('js/vendor/grok-recipes.json')
  .then((r) => r.json())
  .then((j) => {
    recipes = j;
    clip = blankClip();
    // ?clip=Idle_B 直接以某条真实 clip 起步（也便于测试与分享）
    const preset = new URLSearchParams(location.search).get('clip');
    const src = preset && j.clips.find((c) => c.name === preset);
    if (src) clip = structuredClone(src);
    bindStatic(); bindTimeline(); bindInspector();
    renderTimeline(); renderInspector(); setMode('play');
    updateTimeLabel(); rebuildPreview();
  });
