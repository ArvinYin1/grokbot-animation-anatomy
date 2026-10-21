// 形状页 · 01 流水线 + 03 分组画廊 + 04 凸包约束
// 三个版块共用同一份 shape-data.json（main 里 fetch 一次传入）。
import { hull, ptsOf, polyD, hasArc, fitViewBox } from '../lib-shapes.js';
import { t } from '../i18n/i18n.js';

const GALLERY_GROUPS = [
  ['solid', t('shapes.js.gallery.solidHow'), t('shapes.js.gallery.solidNote'), 'solid'],
  ['extrusion', t('shapes.js.gallery.extrusionHow'), t('shapes.js.gallery.extrusionNote'), 'extrusion'],
  ['loft', t('shapes.js.gallery.loftHow'), t('shapes.js.gallery.loftNote'), 'loft'],
];

// silhouette 归类：solid 家族 = solid + solid+balls（球链也走凸包语义）
const familyOf = (s) => (s.silhouette === 'solid+balls' ? 'solid' : s.silhouette);

// 凸包演示用的形状：凹的 + 几个凸的做对照
const HULL_SET = ['sparkle', 'star', 'clover', 'flower', 'house', 'cloud',
  'heart', 'square', 'teardrop', 'egg'];

const STAGES = [
  ['Mv[name]()', t('shapes.js.pipeline.stageMv'), '每个形状一个函数，只吃 2~3 个数字'],
  ['Kr(name)', t('shapes.js.pipeline.stageKr'), '得到 {path, ring, top, bottom, beltRadius…}'],
  ['mt(name)', t('shapes.js.pipeline.stageMt'), '手写 SVG path 解析器 is() + 自适应细分'],
  ['Iv[name]()', t('shapes.js.pipeline.stageIv'), '{size, silhouette, seat}；silhouette 有 3 种 kind'],
  ['Zv()', t('shapes.js.pipeline.stageZv'), '凸包 / 环间四边形 / 环缝合 —— 凸凹分水岭'],
  ['&lt;path d&gt;', t('shapes.js.pipeline.stageSvg'), '再乘 squash / offset 矩阵，眼睛按 seat 落座'],
];

// 展示代码里的中文注释：英文模式按片段替换（zh 原样）
const CODE_PHRASES = [
  ['Mv 表：每个形状一个生成器，参数只有 2~3 个数字', 'shapes.js.code.mvTable'],
  ['唯一手写的', 'shapes.js.code.handwritten'],
  ['后处理', 'shapes.js.code.postProcess'],
  ['is()：手写 path 解析 + 自适应细分', 'shapes.js.code.isParser'],
  ['solid + 圆角板', 'shapes.js.code.solidRounded'],
  ['→ 凸包 pi()', 'shapes.js.code.toHull'],
  ['extrusion：逐环投影，环间连四边形', 'shapes.js.code.extrusionQuad'],
  ['Andrew 单调链', 'shapes.js.code.monotoneChain'],
];
const trCode = (s) => CODE_PHRASES.reduce((out, [zh, key]) => out.replaceAll(zh, t(key)), s);

const STAGE_CODE = [
  `// Mv 表：每个形状一个生成器，参数只有 2~3 个数字
hex:   () => eh(114, 6, 20, Math.PI/6)
cloud: () => th([[x-62,x+26,56], [x+62,x+26,54],
                 [x,x+34,62], [x-24,x-30,62], [x+38,x-26,54]])
squircle: () => El(107, 107, 3.2)
heart: () => "M79.4511 11.5693C94.8767…"   // 唯一手写的`,

  `function Kr(e) {
  const t = Al.get(e);
  if (t != null) return t;
  const n = cc(Mv[e]());   // 后处理
  Al.set(e, n);
  return n;
}`,

  `// is()：手写 path 解析 + 自适应细分
const d = (f, h) => {
  const p = Math.max(2, Math.ceil(h / t));
  for (let g = 1; g <= p; g++) r.push(f(g / p));
};`,

  `Iv = {
  pebble:   () => qn(1.2168, "pebble"),              // solid
  hex:      () => Bn(1.2519, Jt(mt("hex"))),         // extrusion
  cloud:    () => zl(1.3455, Jt(mt("cloud",1)), .72),// loft
  bean:     () => ({ silhouette: { kind:"solid", balls: Lv("bean") } }),
  squircle: () => Qn(Rv("squircle", .28, .11)),      // solid + 圆角板
}`,

  `function Zv(silhouette, view) {
  if (silhouette.kind === "loft")
      return [eS(silhouette.rings, view)];
  if (silhouette.kind === "solid")
      return [Qv(silhouette, view)];   // → 凸包 pi()
  // extrusion：逐环投影，环间连四边形
  const n = silhouette.rings.map(r => r.map(view.project));
  s.push([a[u], a[l], c[l], c[u]]);
}`,

  `function Qv(e, view) { … return pi(o); }

function pi(e) {              // Andrew 单调链
  const n = (s,i,a) => (i.x-s.x)*(a.y-s.y)
                     - (i.y-s.y)*(a.x-s.x);
  for (const s of t) {
    while (r.length >= 2 &&
           n(r.at(-2), r.at(-1), s) <= 0) r.pop();
    r.push(s);
  } … }`,
];

export function init(root, data) {
  // 按 root 里实际存在的元素分派：同一模块服务 01 流水线 / 03 分组 / 04 凸包
  if (root.querySelector('.pipeline')) initPipeline(root);
  if (root.querySelector('.gallery-3')) initGallery(root, data);
  if (root.querySelector('.hull-grid')) initHull(root, data);
}

// ---------- 01 流水线 ----------
function initPipeline(root) {
  const box = root.querySelector('.pipeline');
  const code = root.querySelector('.pipeline-code');
  const buttons = STAGES.map(([name, label], i) => {
    const d = document.createElement('div');
    d.className = 'pipe-stage';
    d.innerHTML = `<div class="pn">${name}</div><div class="pl">${label}</div>`;
    d.addEventListener('click', () => select(i));
    box.appendChild(d);
    return d;
  });
  function select(i) {
    buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    code.textContent = trCode(STAGE_CODE[i]);
  }
  select(4); // 默认落在分派那一步：它才是凸凹分水岭
}

// ---------- 03 分组画廊 ----------
function initGallery(root, data) {
  const byName = Object.fromEntries(data.shapes.map((s) => [s.name, s]));
  const host = root.querySelector('.gallery-3');
  host.innerHTML = GALLERY_GROUPS.map(([kind, how, note, key]) => {
    const names = data.shapes
      .filter((s) => familyOf(s) === key)
      .map((s) => s.name);
    return `<div class="shape-group">
      <div class="gh">
        <span class="kind${kind === 'solid' ? '' : ' cc'}">${kind}</span>
        <span class="gsub">${how} · <b>${note}</b> · ${names.length} ${t('shapes.js.gallery.count')}</span>
      </div>
      <div class="shape-grid c5">
        ${names.map((n) => cell(byName[n], false)).join('')}
      </div>
    </div>`;
  }).join('');
  host.querySelectorAll('svg[data-fit]').forEach((svg) => fitViewBox(svg));

  // 三个分组里用到了 solid+balls（bean/tablet/capsule），单独说明
  const balls = data.shapes.filter((s) => s.silhouette === 'solid+balls').map((s) => s.name);
  host.insertAdjacentHTML('beforeend',
    `<p class="hint">${t('shapes.js.gallery.ballsHint1')}<code>${balls.join(' / ')}</code>${t('shapes.js.gallery.ballsHint2')}<code>silhouette.balls</code>${t('shapes.js.gallery.ballsHint3')}<code>solid</code>${t('shapes.js.gallery.ballsHint4')}</p>`);
}

// 单个形状卡片
export function cell(shape, badge) {
  const concave = shape.concave;
  return `<div class="shape-cell">
    <svg data-fit><path class="ink" d="${shape.path}"/></svg>
    <div class="nm">${shape.name}</div>
    ${badge ? `<span class="tag ${concave ? 'cc' : 'cv'}">${concave ? t('shapes.js.badge.concave') : t('shapes.js.badge.convex')}</span>` : ''}
  </div>`;
}

// ---------- 04 凸包约束 ----------
function initHull(root, data) {
  const byName = Object.fromEntries(data.shapes.map((s) => [s.name, s]));
  const grid = root.querySelector('.hull-grid');
  const note = root.querySelector('.hull-note');
  const text = root.querySelector('.hull-text');
  const buttons = [...root.querySelectorAll('.hull-toggle button')];

  function draw(mode) {
    grid.innerHTML = HULL_SET.map((name) => {
      const s = byName[name];
      let d = s.path;
      if (mode === 'hull' && !hasArc(d)) {
        d = polyD(hull(ptsOf(d)));
      }
      return `<div class="shape-cell">
        <svg data-fit><path class="ink" d="${d}"/></svg>
        <div class="nm">${name}</div>
      </div>`;
    }).join('');
    grid.querySelectorAll('svg[data-fit]').forEach((svg) => fitViewBox(svg));

    if (mode === 'hull') {
      note.textContent = t('shapes.js.hull.noteHull');
      const lost = HULL_SET.filter((n) => byName[n].concave);
      text.innerHTML = `${t('shapes.js.hull.hullText1')}<b>${lost.join(' / ')}</b>${t('shapes.js.hull.hullText2')}<b>${t('shapes.js.hull.hullTextMust')}</b>${t('shapes.js.hull.hullText3')}<code>extrusion</code>${t('shapes.js.hull.hullText4')}<code>loft</code>${t('shapes.js.hull.hullText5')}`;
    } else {
      note.textContent = t('shapes.js.hull.noteReal');
      text.innerHTML = `${t('shapes.js.hull.realText1')}<b>sparkle / star / clover / flower / house</b>${t('shapes.js.hull.realText2')}<code>extrusion</code>${t('shapes.js.hull.realText3')}<b>cloud / heart</b>${t('shapes.js.hull.realText4')}<code>loft</code>${t('shapes.js.hull.realText5')}<code>house</code> / <code>hex</code> / <code>square</code>${t('shapes.js.hull.realText6')}<b>${t('shapes.js.hull.realTextConvex')}</b>${t('shapes.js.hull.realText7')}<code>extrusion</code>${t('shapes.js.hull.realText8')}<code>Bn()</code>${t('shapes.js.hull.realText9')}<b>${t('shapes.js.hull.realTextOneWay')}</b>${t('shapes.js.hull.realText10')}<b>${t('shapes.js.hull.realTextRule')}</b>${t('shapes.js.hull.realText11')}`;
    }
  }

  const setMode = (mode) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    draw(mode);
  };
  buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  // ?hull=1 直接进凸包模式（便于截图核对）
  setMode(new URLSearchParams(location.search).get('hull') === '1' ? 'hull' : 'real');

  // 实测凸性表，用真实数字支撑上面的说法
  const measured = data.shapes.filter((s) => s.hullLoss != null && s.concave);
  root.querySelector('.hull-measured').innerHTML =
    t('shapes.js.hull.measured1') +
    measured.map((s) => `<code>${s.name} ${(s.hullLoss * 100).toFixed(1)}%</code>`).join(' ') +
    t('shapes.js.hull.measured2');
}
