// 动画编辑器 v2 —— 主流动画编辑器交互（AE / Rive 式）：
//   底部时间轴：关键帧菱形可拖拽改时刻、点击空白添加、Delete 删除；
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
let sel = null;                        // 选中的关键帧 { track, i }
let mode = 'play';                     // 'play'（真引擎循环）| 'scrub'（frozenAt 单帧）
let scrubT = 0;
let liveBot = null, frozenBot = null;
let previewTimer = 0;

const blankClip = () => ({
  name: 'MyClip_A', duration: 4, body: 'sphere', squashAnchor: 0,
  workArea: null, inspect: { bias: -1, follow: true }, tracks: {},
});
const trackDef = (key) => TRACKS.find((t) => t.key === key);

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
  previewTimer = setTimeout(rebuildPreview, mode === 'play' ? 400 : 120);
}
function rebuildPreview() {
  if (!recipes || !clip) return;
  updateExport();
  if (mode === 'play') {
    frozenBot?.destroy(); frozenBot = null;
    liveBot?.destroy();
    liveBot = createGrokBot($('#ed-stage'), {
      size: 280, state: '_editor', data: buildData(), seed: 'editor',
      follow: $('#ed-follow').checked, firstPhase: 0,
    });
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
  mode = m;
  $('#ed-playpause').textContent = m === 'play' ? '⏸ 暂停' : '▶ 播放';
  $('#ed-playhead').style.display = m === 'play' ? 'none' : '';
  updateTimeLabel();
  rebuildPreview();
}
function updateTimeLabel() {
  $('#ed-time').textContent = mode === 'play' ?
    '循环播放中' : `t = ${scrubT.toFixed(2)}s / ${clip.duration}s`;
}

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
  // 轨道
  const lanes = [...TRACKS, EXPR_TRACK].map((tr) => {
    const kfs = (clip.tracks[tr.key] ?? []).slice().sort((a, b) => a.t - b.t);
    const dots = kfs.map((kf, i) =>
      `<i class="ed2-kf${sel && sel.track === tr.key && sel.i === i ? ' sel' : ''}" ` +
      `style="left:${kf.t * PPS}px;--kc:${tr.color}" data-track="${tr.key}" data-i="${i}" ` +
      `title="t=${kf.t.toFixed(2)}s"></i>`).join('');
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

// ---------- 检查器 ----------
function renderInspector() {
  const el = $('#ed-inspector');
  if (sel) return renderKfInspector(el, sel.track, sortedKfs(sel.track)[sel.i]);
  el.innerHTML = `
    <h3 class="ed-h">Clip 配置</h3>
    <div class="ed-form">
      <label>从现有 clip 开始
        <select data-ins="template"><option value="">（从空白开始）</option>
          ${recipes.clips.map((c) => `<option ${c.name === clip.name ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select></label>
      <label>名称 <input type="text" data-ins="name" value="${clip.name}"></label>
      <label>时长（秒） <input type="number" data-ins="duration" min="0.2" step="0.1" value="${clip.duration}"></label>
      <label>squashAnchor <input type="number" data-ins="anchor" min="0" max="1" step="0.05" value="${clip.squashAnchor ?? 0}"></label>
      <label>rest 帧时刻 <input type="number" data-ins="rest" min="0" step="0.1" placeholder="（空 = 0）"
        value="${clip.workArea ? clip.workArea.start : ''}"></label>
      <label class="ed-check"><input type="checkbox" data-ins="follow" ${clip.inspect?.follow !== false ? 'checked' : ''}>
        允许视线跟随（inspect.follow）</label>
    </div>
    <h3 class="ed-h">状态配置（state）</h3>
    <div class="ed-form">
      <label>表情 face <select data-ins="face"><option value="">（无）</option>
        ${recipes.expressionNames.map((n) => `<option ${st.face === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>morph 装饰 <select data-ins="morph"><option value="">（无）</option>
        ${Object.keys(recipes.constants.morph.stateMap).map((n) => `<option ${st.morph === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>播完自动转移 next <select data-ins="next"><option value="">（无）</option>
        ${Object.keys(recipes.states).map((n) => `<option ${st.next === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>停留秒数 holdSeconds <input type="number" data-ins="hold" min="0" step="0.1"
        placeholder="（空 = 立即）" value="${st.holdSeconds}"></label>
    </div>
    <p class="hint">点击时间轴上的菱形可编辑单个关键帧；点空白处取消选择回到本面板。</p>`;
}

function renderKfInspector(el, track, kf) {
  if (!kf) { sel = null; return renderInspector(); }
  const tr = trackDef(track);
  if (track === 'expression') {
    const names = [...recipes.expressionNames, 'blink'];
    el.innerHTML = `
      <h3 class="ed-h">表情事件 · t=${kf.t.toFixed(2)}s</h3>
      <div class="ed-form">
        <label>t（秒） <input type="number" data-kf="t" step="0.05" min="0" value="${kf.t}"></label>
        <label>表情 <select data-kf="name">
          ${names.map((n) => `<option ${n === kf.v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="ed-check"><input type="checkbox" data-kf="cut" ${kf.cut === false ? 'checked' : ''}>
          经由闭眼过渡（through-blink）</label>
      </div>
      <p class="hint">blink 会被引擎展开成 0.26s 眨眼（45% 处闭合）。</p>
      <div class="controls"><button data-kf="delete">删除此事件</button></div>`;
    return;
  }
  const ease = kf.ease ?? EASE_PRESETS[0][1];
  el.innerHTML = `
    <h3 class="ed-h">${tr.label} · 关键帧 t=${kf.t.toFixed(2)}s</h3>
    <div class="ed-form">
      <label>t（秒） <input type="number" data-kf="t" step="0.05" min="0" value="${kf.t}"></label>
      ${tr.comps.map((c, j) => `<label>${c} <input type="number" data-kf="v${j}"
        step="${tr.step}" value="${kf.v[j] ?? tr.def[j]}"></label>`).join('')}
    </div>
    <h3 class="ed-h">缓动（进入下一段）</h3>
    <div class="ed2-ease-row">
      <svg id="ed-bezier" viewBox="0 0 160 120"></svg>
      <div>
        <select data-kf="epreset"><option value="">自定义</option>
          ${EASE_PRESETS.map(([n], k) => `<option value="${k}">${n} [${EASE_PRESETS[k][1]}]</option>`).join('')}
        </select>
        <div class="ed-ease-nums">${ease.map((e, j) =>
          `<input type="number" data-kf="e${j}" step="0.01" value="${e}">`).join('')}</div>
        <p class="hint">拖曲线上的两个手柄。</p>
      </div>
    </div>
    <div class="controls"><button data-kf="delete">删除此关键帧</button></div>`;
  drawBezier(ease);
}

// ---------- 贝塞尔曲线编辑器 ----------
function drawBezier(ease) {
  const svg = $('#ed-bezier');
  if (!svg) return;
  const X = (v) => 16 + v * 128, Y = (v) => 104 - v * 76; // y 允许少量超界（回弹）
  const [x1, y1, x2, y2] = ease;
  svg.innerHTML = `
    <line x1="16" y1="104" x2="144" y2="104" class="bz-grid"/>
    <line x1="16" y1="28" x2="144" y2="28" class="bz-grid"/>
    <line x1="16" y1="104" x2="144" y2="28" class="bz-grid dash"/>
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(x1)}" y2="${Y(y1)}" class="bz-arm"/>
    <line x1="${X(1)}" y1="${Y(1)}" x2="${X(x2)}" y2="${Y(y2)}" class="bz-arm"/>
    <path d="M${X(0)} ${Y(0)} C${X(x1)} ${Y(y1)} ${X(x2)} ${Y(y2)} ${X(1)} ${Y(1)}" class="bz-curve"/>
    <circle data-h="0" cx="${X(x1)}" cy="${Y(y1)}" r="6" class="bz-handle"/>
    <circle data-h="1" cx="${X(x2)}" cy="${Y(y2)}" r="6" class="bz-handle"/>`;
  svg.querySelectorAll('.bz-handle').forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const px = (ev.clientX - r.left) * (160 / r.width), py = (ev.clientY - r.top) * (120 / r.height);
        const vx = Math.min(1, Math.max(0, (px - 16) / 128));
        const vy = Math.min(1.45, Math.max(-0.45, (104 - py) / 76));
        const kf2 = sel && sortedKfs(sel.track)[sel.i];
        if (!kf2) return;
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

  // 菱形：选中 + 拖拽改时刻
  tl.addEventListener('pointerdown', (e) => {
    const kfEl = e.target.closest('.ed2-kf');
    if (!kfEl) return;
    e.preventDefault();
    const track = kfEl.dataset.track;
    let i = +kfEl.dataset.i;
    sel = { track, i };
    renderTimeline(); renderInspector();
    const lane = tl.querySelector(`[data-lane="${track}"]`);
    const kf = () => sortedKfs(track)[i];
    let moved = false;
    const move = (ev) => {
      const r = lane.getBoundingClientRect();
      const t = Math.min(clip.duration, Math.max(0, (ev.clientX - r.left) / PPS));
      const k = kf();
      if (!k) return;
      k.t = +t.toFixed(3);
      moved = true;
      kfEl.style.left = `${k.t * PPS}px`;
      kfEl.title = `t=${k.t.toFixed(2)}s`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) {
        const k = kf();
        const sorted = clip.tracks[track].slice().sort((a, b) => a.t - b.t);
        clip.tracks[track] = sorted;
        sel = { track, i: sorted.indexOf(k) };
        renderTimeline(); renderInspector(); schedulePreview();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // 点轨道空白：添加关键帧；点 label：只取消选择
  tl.addEventListener('click', (e) => {
    if (e.target.closest('.ed2-kf') || e.target.closest('.ed2-add')) return;
    const lane = e.target.closest('[data-lane]');
    if (lane) {
      const track = lane.dataset.lane;
      const r = lane.getBoundingClientRect();
      const t = +Math.min(clip.duration, Math.max(0, (e.clientX - r.left) / PPS)).toFixed(3);
      const list = clip.tracks[track] ??= [];
      if (track === 'expression') list.push({ t, v: 'blink' });
      else { const tr = trackDef(track); list.push({ t, v: [...tr.def], ease: [...EASE_PRESETS[0][1]] }); }
      list.sort((a, b) => a.t - b.t);
      sel = { track, i: list.findIndex((k) => k.t === t) };
      renderTimeline(); renderInspector(); schedulePreview();
    } else if (!e.target.closest('#ed-ruler')) {
      sel = null; renderTimeline(); renderInspector();
    }
  });

  // 轨道 label 上的 + ：在播放头处添加
  tl.addEventListener('click', (e) => {
    const add = e.target.closest('.ed2-add');
    if (!add) return;
    const track = add.dataset.add;
    const t = mode === 'scrub' ? scrubT : 0;
    const list = clip.tracks[track] ??= [];
    if (track === 'expression') list.push({ t, v: 'blink' });
    else { const tr = trackDef(track); list.push({ t, v: [...tr.def], ease: [...EASE_PRESETS[0][1]] }); }
    list.sort((a, b) => a.t - b.t);
    sel = { track, i: list.findIndex((k) => k.t === t) };
    renderTimeline(); renderInspector(); schedulePreview();
  });

  // Delete 删除选中关键帧
  window.addEventListener('keydown', (e) => {
    if ((e.key !== 'Delete' && e.key !== 'Backspace') || !sel) return;
    if (e.target.closest('input, textarea, select')) return;
    const k = sortedKfs(sel.track)[sel.i];
    const arr = clip.tracks[sel.track];
    arr.splice(arr.indexOf(k), 1);
    sel = null;
    renderTimeline(); renderInspector(); schedulePreview();
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
        clip = structuredClone(src); sel = null;
        renderTimeline(); renderInspector(); schedulePreview(); return;
      }
      if (ins === 'name') clip.name = e.target.value || 'MyClip_A';
      else if (ins === 'duration') { clip.duration = Math.max(0.2, parseFloat(e.target.value) || 4); renderTimeline(); }
      else if (ins === 'anchor') clip.squashAnchor = Math.min(1, Math.max(0, parseFloat(e.target.value) || 0));
      else if (ins === 'rest') {
        const v = parseFloat(e.target.value);
        clip.workArea = Number.isFinite(v) ? { start: v, end: clip.duration } : null;
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
    if (kfF === 't') {
      kf.t = Math.max(0, parseFloat(e.target.value) || 0);
      clip.tracks[sel.track].sort((a, b) => a.t - b.t);
      sel = { track: sel.track, i: sortedKfs(sel.track).indexOf(kf) };
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
    if (e.target.dataset.kf !== 'delete' || !sel) return;
    const k = sortedKfs(sel.track)[sel.i];
    const arr = clip.tracks[sel.track];
    arr.splice(arr.indexOf(k), 1);
    sel = null;
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
      if (!c || typeof c.name !== 'string' || !c.tracks) throw new Error('缺少 clip 字段');
      clip = c; sel = null;
      if (obj.state) {
        st.face = obj.state.face ?? ''; st.morph = obj.state.morph ?? '';
        st.next = obj.state.next ?? ''; st.holdSeconds = obj.state.holdSeconds ?? '';
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
