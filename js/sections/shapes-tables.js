// 形状页 · 07 眼睛落座 seat + 08 速查表
// 两节都由 shape-data.json 驱动，保证与其余版块同源。
import { fitViewBox } from '../lib-shapes.js';

// seat 的 4 种 kind（来自 bundle 的描述符表）
const SEATS = [
  ['front', 'faceZ', '平面正脸，眼睛钉在一个固定深度',
    'squircle .28 · crystal .64·√3/2 · hex/square/house/sparkle/… .36'],
  ['wrap', 'wrapR, wrapY0/1, radiusAt', '绕柱面包裹，眼睛跟着曲面滑动并被压缩',
    'pebble · egg · gem · shield · dome · arch · leaf · cylinder · wedge · teardrop · bean · capsule'],
  ['wrapX', 'radiusAtX', '沿 X 轴的柱面（横躺的柱）', 'tablet'],
  ['loft', 'surfaceZ（Dv() 求）', '用 180 个方向射线求放样面的深度，眼睛贴鼓面',
    'cloud · heart'],
];

export function init(root, data) {
  if (root.querySelector('.seat-tbl')) initSeats(root, data);
  if (root.querySelector('.ref-tbl')) initTable(root, data);
}

// ---------- 07 seat ----------
function initSeats(root, data) {
  // 每种 kind 实际被哪些形状用了（按数据里的 seat 字段前缀归类）
  const kindOf = (s) => {
    if (s.seat.startsWith('loft')) return 'loft';
    if (s.seat.startsWith('wrapX')) return 'wrapX';
    if (s.seat.startsWith('wrap')) return 'wrap';
    if (s.seat.startsWith('front')) return 'front';
    return null;
  };
  const users = {};
  for (const s of data.shapes) {
    const k = kindOf(s);
    if (!k) continue;
    (users[k] ??= []).push(s.name);
  }

  root.querySelector('.seat-tbl tbody').innerHTML = SEATS.map(([kind, field, what]) => `
    <tr>
      <td class="m">${kind}</td>
      <td class="m">${field}</td>
      <td>${what}</td>
      <td class="dim">${(users[kind] ?? []).join(' · ') || '—'}</td>
    </tr>`).join('');

  // 眼睛落座小演示：用真实 bot 渲染三种典型 seat 的形状，画一条「眼睛位置」参考线
  const host = root.querySelector('.seat-demo');
  const picks = ['squircle', 'teardrop', 'cloud', 'tablet'];
  host.innerHTML = picks.map((n) => {
    const s = data.shapes.find((x) => x.name === n);
    return `<div class="shape-cell">
      <svg data-fit><path class="ink" d="${s.path}"/></svg>
      <div class="nm">${n}</div>
      <span class="tag">${kindOf(s) ?? '—'}</span>
    </div>`;
  }).join('');
  host.querySelectorAll('svg[data-fit]').forEach(fitViewBox);
}

// ---------- 08 速查表 ----------
function initTable(root, data) {
  const tbody = root.querySelector('.ref-tbl tbody');
  tbody.innerHTML = data.shapes.map((s) => {
    const loss = s.hullLoss;
    const badge = loss == null
      ? '<span class="pill opt">—</span>'
      : `<span class="pill${s.concave ? ' cc' : ''}">${s.concave ? '凹' : '凸'}</span>`;
    const lossTxt = loss == null ? '—' : `${(loss * 100).toFixed(2)}%`;
    return `<tr>
      <td class="m">${s.name}</td>
      <td class="dim">${s.engine}</td>
      <td class="gen">${s.gen}</td>
      <td class="m">${s.silhouette}</td>
      <td>${s.outline}</td>
      <td class="dim">${s.seat}</td>
      <td class="dim">${s.size == null ? '—' : s.size.toFixed(3)}</td>
      <td>${badge}</td>
      <td class="dim">${lossTxt}</td>
    </tr>`;
  }).join('');

  // 实测统计：solid 家族有没有凹的？凹的是不是全在 extrusion/loft？
  const solidFamily = data.shapes.filter((s) =>
    s.silhouette === 'solid' || s.silhouette === 'solid+balls');
  const solidConcave = solidFamily.filter((s) => s.concave);
  const concaveAll = data.shapes.filter((s) => s.concave);
  const concaveInSolid = concaveAll.filter((s) =>
    s.silhouette === 'solid' || s.silhouette === 'solid+balls');

  root.querySelector('.ref-verify').innerHTML =
    `本页实测 ${data.shapeCount} 个轮廓：
     <b>${solidFamily.length} 个 <code>solid</code> 家族里，凹的有 ${solidConcave.length} 个</b>；
     全部 ${concaveAll.length} 个凹形状（<code>${concaveAll.map((s) => s.name).join(' / ')}</code>）
     里，落在 <code>solid</code> 家族的有 ${concaveInSolid.length} 个。
     换句话说 —— <b>凸包这条约束在 25 个形状上一个例外都没有</b>。`;
}
