// 动画编辑器：编辑 clip 关键帧（与原引擎数据同构的 JSON），
// 通过 createGrokBot 的 opts.data 注入临时状态 _editor，真引擎实时预览。
import { createGrokBot } from './vendor/grok-player.js';

const $ = (s) => document.querySelector(s);

const TRACKS = [
  { key: 'position', label: '位置 position', comps: ['x', 'y'], step: 0.05, def: [0, 0], hint: '单位：身体半径' },
  { key: 'rotation', label: '旋转 rotation', comps: ['pitch', 'yaw', 'roll'], step: 1, def: [0, 0, 0], hint: '单位：度' },
  { key: 'squash', label: '挤压 squash', comps: ['x 倍率', 'y 倍率'], step: 0.05, def: [1, 1], hint: '1 = 不变形' },
  { key: 'scale', label: '缩放 scale（即 zoom）', comps: ['倍率'], step: 0.05, def: [1], hint: '1 = 原始大小' },
  { key: 'lids', label: '眼睑 lids', comps: ['闭合'], step: 0.05, def: [0], hint: '0 睁开 → 1 闭合' },
];
const EASE_PRESETS = [
  ['引擎默认', [0.42, 0, 0.58, 1]],
  ['线性', [0, 0, 1, 1]],
  ['缓入', [0.42, 0, 1, 1]],
  ['缓出', [0, 0, 0.58, 1]],
  ['回弹', [0.34, 1.56, 0.64, 1]],
];

let recipes = null;   // 原始提取数据（只读模板）
let clip = null;      // 正在编辑的 clip（导出格式）
let bot = null;
let previewTimer = 0;

const blankClip = () => ({
  name: 'MyClip_A', duration: 4, body: 'sphere', squashAnchor: 0,
  workArea: null, inspect: { bias: -1, follow: true }, tracks: {},
});

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
  if ($('#st-face').value) s.face = $('#st-face').value;
  if ($('#st-morph').value) s.morph = $('#st-morph').value;
  if ($('#st-next').value) s.next = $('#st-next').value;
  const h = parseFloat($('#st-hold').value);
  if (Number.isFinite(h) && $('#st-next').value) s.holdSeconds = h;
  return s;
}
function updateExport() {
  $('#ed-json').value = JSON.stringify({ clip: exportClip(), state: exportState() }, null, 2);
}

// ---------- 预览：改数据 → 重建真引擎实例 ----------
function schedulePreview() {
  updateExport();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(preview, 400);
}
function preview() {
  if (!recipes || !clip) return;
  updateExport();
  const data = structuredClone(recipes);
  const exp = exportClip();
  const i = data.clips.findIndex((c) => c.name === exp.name);
  if (i >= 0) data.clips[i] = exp; else data.clips.push(exp);
  data.states._editor = exportState();
  bot?.destroy();
  bot = createGrokBot($('#ed-stage'), {
    size: 280, state: '_editor', data, seed: 'editor', follow: $('#ed-follow').checked,
  });
}

// ---------- 轨道 UI ----------
function trackBlock(tr) {
  const kfs = clip.tracks[tr.key] ?? [];
  const laneDots = kfs.map((kf) =>
    `<i style="left:${(kf.t / Math.max(clip.duration, 1e-6)) * 100}%"></i>`).join('');
  const rows = kfs.map((kf, i) => {
    const vals = tr.comps.map((c, j) =>
      `<td><label class="ed-mini">${c}<input type="number" step="${tr.step}" value="${kf.v[j] ?? tr.def[j]}"
        data-track="${tr.key}" data-i="${i}" data-field="v${j}"></label></td>`).join('');
    const presetOpts = EASE_PRESETS.map(([n], k) => `<option value="${k}">${n}</option>`).join('');
    const easeInputs = (kf.ease ?? EASE_PRESETS[0][1]).map((e, j) =>
      `<input type="number" step="0.01" value="${e}" data-track="${tr.key}" data-i="${i}" data-field="e${j}">`)
      .join('');
    return `<tr>
      <td><input class="ed-t" type="number" step="0.05" min="0" value="${kf.t}"
        data-track="${tr.key}" data-i="${i}" data-field="t"></td>
      ${vals}
      <td><select data-track="${tr.key}" data-i="${i}" data-field="epreset">
        <option value="">自定义</option>${presetOpts}</select>
        <span class="ed-ease">${easeInputs}</span></td>
      <td><button class="ed-del" data-track="${tr.key}" data-i="${i}" title="删除关键帧">✕</button></td>
    </tr>`;
  }).join('');
  return `<div class="ed-track" data-block="${tr.key}">
    <div class="ed-track-head">
      <b>${tr.label}</b><span class="hint">${tr.hint}</span>
      <button data-add="${tr.key}">+ 关键帧</button>
    </div>
    <div class="ed-lane">${laneDots}</div>
    ${kfs.length ? `<table class="ed-table"><thead><tr>
      <th>t(秒)</th>${tr.comps.map(() => '<th>值</th>').join('')}<th>缓动（进入下一段）</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table>` : '<p class="hint">无关键帧</p>'}
  </div>`;
}

function expressionBlock() {
  const evs = clip.tracks.expression ?? [];
  const names = [...recipes.expressionNames, 'blink'];
  const rows = evs.map((e, i) => `<tr>
    <td><input class="ed-t" type="number" step="0.05" min="0" value="${e.t}"
      data-track="expression" data-i="${i}" data-field="t"></td>
    <td><select data-track="expression" data-i="${i}" data-field="name">
      ${names.map((n) => `<option ${n === e.v ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
    <td><label class="ed-mini"><input type="checkbox" data-track="expression" data-i="${i}"
      data-field="cut" ${e.cut === false ? 'checked' : ''}> 经由闭眼过渡</label></td>
    <td><button class="ed-del" data-track="expression" data-i="${i}">✕</button></td>
  </tr>`).join('');
  return `<div class="ed-track">
    <div class="ed-track-head">
      <b>表情事件 expression</b><span class="hint">blink 会被引擎展开成 0.26s 眨眼</span>
      <button data-add="expression">+ 事件</button>
    </div>
    <div class="ed-lane">${evs.map((e) =>
      `<i class="expr" style="left:${(e.t / Math.max(clip.duration, 1e-6)) * 100}%"></i>`).join('')}</div>
    ${evs.length ? `<table class="ed-table"><thead><tr><th>t(秒)</th><th>表情</th><th></th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>` : '<p class="hint">无事件</p>'}
  </div>`;
}

function renderTracks() {
  $('#ed-tracks').innerHTML =
    TRACKS.map(trackBlock).join('') + expressionBlock();
}

function syncMetaInputs() {
  $('#cl-name').value = clip.name;
  $('#cl-duration').value = clip.duration;
  $('#cl-anchor').value = clip.squashAnchor ?? 0;
  $('#cl-rest').value = clip.workArea ? clip.workArea.start : '';
  $('#cl-follow').checked = clip.inspect?.follow !== false;
}

// ---------- 事件 ----------
function bindStatic() {
  // clip 元信息
  $('#cl-name').addEventListener('input', (e) => { clip.name = e.target.value || 'MyClip_A'; schedulePreview(); });
  $('#cl-duration').addEventListener('change', (e) => {
    clip.duration = Math.max(0.2, parseFloat(e.target.value) || 4);
    renderTracks(); schedulePreview();
  });
  $('#cl-anchor').addEventListener('change', (e) => {
    clip.squashAnchor = Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)); schedulePreview();
  });
  $('#cl-rest').addEventListener('change', (e) => {
    const v = parseFloat(e.target.value);
    clip.workArea = Number.isFinite(v) ? { start: v, end: clip.duration } : null; schedulePreview();
  });
  $('#cl-follow').addEventListener('change', (e) => {
    clip.inspect = { bias: -1, follow: e.target.checked }; schedulePreview();
  });
  // 模板
  $('#cl-template').addEventListener('change', (e) => {
    const src = recipes.clips.find((c) => c.name === e.target.value);
    if (!src) return;
    clip = structuredClone(src);
    syncMetaInputs(); renderTracks(); schedulePreview();
  });
  // 状态配置
  for (const id of ['#st-face', '#st-morph', '#st-next', '#st-hold'])
    $(id).addEventListener('change', schedulePreview);
  $('#ed-follow').addEventListener('change', preview);
  $('#ed-replay').addEventListener('click', preview);

  // 轨道表格（事件委托）
  $('#ed-tracks').addEventListener('change', onTrackEdit);
  $('#ed-tracks').addEventListener('click', (e) => {
    const add = e.target.dataset.add;
    if (add) {
      const tr = TRACKS.find((t) => t.key === add);
      const list = clip.tracks[add] ??= [];
      if (add === 'expression') list.push({ t: Math.min(clip.duration / 2, clip.duration), v: 'blink' });
      else list.push({ t: Math.min((list.at(-1)?.t ?? 0) + 0.5, clip.duration), v: [...tr.def], ease: [...EASE_PRESETS[0][1]] });
      renderTracks(); schedulePreview();
      return;
    }
    if (e.target.classList.contains('ed-del')) {
      clip.tracks[e.target.dataset.track].splice(+e.target.dataset.i, 1);
      renderTracks(); schedulePreview();
    }
  });

  // 导出 / 导入
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
      clip = c;
      if (obj.state) {
        $('#st-face').value = obj.state.face ?? '';
        $('#st-morph').value = obj.state.morph ?? '';
        $('#st-next').value = obj.state.next ?? '';
        $('#st-hold').value = obj.state.holdSeconds ?? '';
      }
      syncMetaInputs(); renderTracks(); schedulePreview();
    } catch (err) { alert(`JSON 解析失败：${err.message}`); }
  });
}

function onTrackEdit(e) {
  const d = e.target.dataset;
  if (!d.track) return;
  const kf = clip.tracks[d.track]?.[+d.i];
  if (!kf) return;
  if (d.field === 't') { kf.t = Math.max(0, parseFloat(e.target.value) || 0); renderTracks(); }
  else if (d.field?.startsWith('v')) kf.v[+d.field.slice(1)] = parseFloat(e.target.value) || 0;
  else if (d.field?.startsWith('e') && d.field.length === 2) {
    kf.ease ??= [...EASE_PRESETS[0][1]];
    kf.ease[+d.field.slice(1)] = parseFloat(e.target.value) || 0;
  } else if (d.field === 'epreset' && e.target.value !== '') {
    kf.ease = [...EASE_PRESETS[+e.target.value][1]];
    renderTracks();
  } else if (d.field === 'name') kf.v = e.target.value;
  else if (d.field === 'cut') kf.cut = e.target.checked ? false : undefined;
  schedulePreview();
}

// ---------- 启动 ----------
fetch('js/vendor/grok-recipes.json')
  .then((r) => r.json())
  .then((j) => {
    recipes = j;
    clip = blankClip();
    $('#cl-template').innerHTML = '<option value="">（从空白开始）</option>' +
      j.clips.map((c) => `<option>${c.name}</option>`).join('');
    $('#st-face').innerHTML = '<option value="">（无）</option>' +
      j.expressionNames.map((n) => `<option>${n}</option>`).join('');
    $('#st-morph').innerHTML = '<option value="">（无）</option>' +
      Object.keys(j.constants.morph.stateMap).map((n) => `<option>${n}</option>`).join('');
    $('#st-next').innerHTML = '<option value="">（无）</option>' +
      Object.keys(j.states).map((n) => `<option>${n}</option>`).join('');
    syncMetaInputs(); bindStatic(); renderTracks(); preview();
  });
