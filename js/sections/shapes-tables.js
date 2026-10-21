// 形状页 · 07 眼睛落座 seat + 08 速查表
// 两节都由 shape-data.json 驱动，保证与其余版块同源。
import { fitViewBox } from '../lib-shapes.js';
import { t } from '../i18n/i18n.js';

// seat 的 4 种 kind（来自 bundle 的描述符表）
const SEATS = [
  ['front', 'faceZ', t('shapes.js.seats.frontWhat'),
    'squircle .28 · crystal .64·√3/2 · hex/square/house/sparkle/… .36'],
  ['wrap', 'wrapR, wrapY0/1, radiusAt', t('shapes.js.seats.wrapWhat'),
    'pebble · egg · gem · shield · dome · arch · leaf · cylinder · wedge · teardrop · bean · capsule'],
  ['wrapX', 'radiusAtX', t('shapes.js.seats.wrapXWhat'), 'tablet'],
  ['loft', t('shapes.js.seats.loftField'), t('shapes.js.seats.loftWhat'),
    'cloud · heart'],
];

// shape-data.json 的 gen/outline 字段是分析注记（中文）；英文模式下按短语替换
const DATA_PHRASES = [
  ['球体特例（弧线路径）', 'shapes.js.data.sphereSpecial'],
  ['弧线路径（特例）', 'shapes.js.data.arcSpecial'],
  ['六圆并集（非 Mv 表）', 'shapes.js.data.sixCircles'],
  ['不在 Mv 表', 'shapes.js.data.notInMv'],
  ['凸包 pi()', 'shapes.js.data.hullPi'],
  ['环间四边形', 'shapes.js.data.ringQuads'],
  ['射线并集（球链）', 'shapes.js.data.rayUnion'],
  ['环缝合 eS()', 'shapes.js.data.ringStitch'],
];
const trData = (s) =>
  typeof s === 'string'
    ? DATA_PHRASES.reduce((out, [zh, key]) => out.replaceAll(zh, t(key)), s)
    : s;

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
  host.querySelectorAll('svg[data-fit]').forEach((svg) => fitViewBox(svg));
}

// ---------- 08 速查表 ----------
function initTable(root, data) {
  const tbody = root.querySelector('.ref-tbl tbody');
  tbody.innerHTML = data.shapes.map((s) => {
    const loss = s.hullLoss;
    const badge = loss == null
      ? '<span class="pill opt">—</span>'
      : `<span class="pill${s.concave ? ' cc' : ''}">${s.concave ? t('shapes.js.badge.concave') : t('shapes.js.badge.convex')}</span>`;
    const lossTxt = loss == null ? '—' : `${(loss * 100).toFixed(2)}%`;
    return `<tr>
      <td class="m">${s.name}</td>
      <td class="dim">${s.engine}</td>
      <td class="gen">${trData(s.gen)}</td>
      <td class="m">${s.silhouette}</td>
      <td>${trData(s.outline)}</td>
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
    `${t('shapes.js.table.verify1')}${data.shapeCount}${t('shapes.js.table.verify2')}` +
    `<b>${t('shapes.js.table.verify3a')}${solidFamily.length}${t('shapes.js.table.verify3b')}<code>solid</code>${t('shapes.js.table.verify3c')}${solidConcave.length}${t('shapes.js.table.verify3d')}</b>${t('shapes.js.table.verify4')}${concaveAll.length}${t('shapes.js.table.verify5')}<code>${concaveAll.map((s) => s.name).join(' / ')}</code>${t('shapes.js.table.verify6')}<code>solid</code>${t('shapes.js.table.verify7')}${concaveInSolid.length}${t('shapes.js.table.verify8')}<b>${t('shapes.js.table.verify9')}</b>${t('shapes.js.table.verify10')}`;
}
