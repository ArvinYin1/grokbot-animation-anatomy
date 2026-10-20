// 形状页 · 01 流水线 + 03 分组画廊 + 04 凸包约束
// 三个版块共用同一份 shape-data.json（main 里 fetch 一次传入）。
import { hull, ptsOf, polyD, hasArc, fitViewBox } from '../lib-shapes.js';

const GALLERY_GROUPS = [
  ['solid', '投影点云 → 凸包 pi()', '只能凸', 'solid'],
  ['extrusion', '逐环投影 → 环间四边形', '可凹', 'extrusion'],
  ['loft', '逐环投影 → eS() 缝合', '可凹', 'loft'],
];

// silhouette 归类：solid 家族 = solid + solid+balls（球链也走凸包语义）
const familyOf = (s) => (s.silhouette === 'solid+balls' ? 'solid' : s.silhouette);

// 凸包演示用的形状：凹的 + 几个凸的做对照
const HULL_SET = ['sparkle', 'star', 'clover', 'flower', 'house', 'cloud',
  'heart', 'square', 'teardrop', 'egg'];

const STAGES = [
  ['Mv[name]()', '参数化路径生成器', '每个形状一个函数，只吃 2~3 个数字'],
  ['Kr(name)', '记忆化 + 后处理', '得到 {path, ring, top, bottom, beltRadius…}'],
  ['mt(name)', '路径 → 点列', '手写 SVG path 解析器 is() + 自适应细分'],
  ['Iv[name]()', '形状描述符', '{size, silhouette, seat}；silhouette 有 3 种 kind'],
  ['Zv()', '按 kind 分派轮廓算法', '凸包 / 环间四边形 / 环缝合 —— 凸凹分水岭'],
  ['&lt;path d&gt;', '交给 SVG 渲染', '再乘 squash / offset 矩阵，眼睛按 seat 落座'],
];

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
    code.textContent = STAGE_CODE[i];
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
        <span class="gsub">${how} · <b>${note}</b> · ${names.length} 个</span>
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
    `<p class="hint">其中 <code>${balls.join(' / ')}</code> 不生成路径：它们用一串球
     当轮廓（<code>silhouette.balls</code>），靠射线和圆求交得到并集边界。
     所以它们也属于 <code>solid</code> 家族 —— 同样只能凸。</p>`);
}

// 单个形状卡片
export function cell(shape, badge) {
  const concave = shape.concave;
  return `<div class="shape-cell">
    <svg data-fit><path class="ink" d="${shape.path}"/></svg>
    <div class="nm">${shape.name}</div>
    ${badge ? `<span class="tag ${concave ? 'cc' : 'cv'}">${concave ? '凹' : '凸'}</span>` : ''}
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
      note.textContent = '凸包之后的轮廓 —— 凹口全被填平';
      const lost = HULL_SET.filter((n) => byName[n].concave);
      text.innerHTML = `对比上一个视图：<b>${lost.join(' / ')}</b> 的凹口全部消失了，
        变成一块整凸形。这就是为什么这些形状<b>必须</b>用
        <code>extrusion</code> 或 <code>loft</code> —— 没有任何报错，只是形状不对。`;
    } else {
      note.textContent = 'App 实际渲染的样子';
      text.innerHTML = `这 10 个里 <b>sparkle / star / clover / flower / house</b> 走
        <code>extrusion</code>，<b>cloud / heart</b> 走 <code>loft</code>。
        要留意 <code>house</code> / <code>hex</code> / <code>square</code>：
        它们实测是<b>凸</b>的，却仍然走 <code>extrusion</code> —— 因为 silhouette
        不只由凸凹决定，还取决于作者用哪个族来建它（圆角多边形 + 厚度这一族就是
        <code>Bn()</code> → extrusion）。所以规则是<b>单向</b>的：<b>凹 ⟹ 一定不能用 solid</b>，
        但凸不意味着只能用 solid。`;
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
    `实测（对 App 自己渲染出来的轮廓跑凸包）：` +
    measured.map((s) => `<code>${s.name} ${(s.hullLoss * 100).toFixed(1)}%</code>`).join(' ') +
    ` —— 这些是凸包会吃掉的面积占比。`;
}
