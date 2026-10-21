// 工作台 · 拖顶点画形状 → 实时凸性判定 → 生成 5 处注册代码
// 几何全部走 lib-shapes.js（原 bundle 的忠实移植）。
import {
  CANVAS_CENTER as X, ac, eh, hull, polyD, hullLoss,
} from '../lib-shapes.js';
import { t } from '../i18n/i18n.js';

// 生成代码里的中文注释：英文模式按片段替换（zh 原样）
const CODE_PHRASES = [
  ['规则多边形 → 一行搞定', 'workshop.js.code.regular'],
  ['自由顶点 → ac(点数组, 圆角)', 'workshop.js.code.freeVerts'],
  ['凸 → solid（最省事）', 'workshop.js.code.ivSolid'],
  ['seat 是 wrap 型：眼睛绕柱面包裹', 'workshop.js.code.seatWrap'],
  ['凹 + 有厚度 → extrusion', 'workshop.js.code.ivExtr'],
  ['← 平面正脸', 'workshop.js.code.flatFront'],
  ['凹 + 鼓起来 → loft', 'workshop.js.code.ivLoft'],
  ['← 眼睛贴放样面', 'workshop.js.code.hugLoft'],
  ['或：moon', 'workshop.js.code.orMoon'],
  ['← 漏了这个会静默变球！', 'workshop.js.code.namesWarn'],
  ['从相近形状抄，主要调 shiftY', 'workshop.js.code.copyMetrics'],
  ['选形状面板的清单', 'workshop.js.code.pickerList'],
  ['UI 名 → 引擎名', 'workshop.js.code.uiToEngine'],
];
const trCode = (s) => CODE_PHRASES.reduce((out, [zh, key]) => out.replaceAll(zh, t(key)), s);

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 画布坐标空间（560×430，中心 280/215）→ 设计坐标的换算比例
const CW = 560, CH = 430, CX = 280, CY = 215;
const K = X / 120;      // 120px ≈ 设计单位的 1.0 量级

// ---------- 预设 ----------
function regular(n, R, phase = -Math.PI / 2) {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * TAU;
    return [CX + Math.cos(a) * R, CY + Math.sin(a) * R];
  });
}
function starPts(n, Ro, Ri) {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i / (n * 2)) * TAU;
    const r = i % 2 ? Ri : Ro;
    out.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r]);
  }
  return out;
}
function gearPts(n, Ro, Ri) {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i / (n * 2)) * TAU;
    const r = i % 2 ? Ri : Ro;
    out.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r]);
  }
  return out;
}
function cloudPts() {
  const circles = [
    [CX - 72, CY + 24, 58], [CX + 72, CY + 22, 56], [CX, CY + 30, 64],
    [CX - 30, CY - 32, 64], [CX + 42, CY - 28, 56],
  ];
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU, c = Math.cos(a), s = Math.sin(a);
    let best = 0;
    for (const [ox, oy, cr] of circles) {
      const u = ox - CX, v = oy - CY;
      const d = c * u + s * v;
      const g = d * d - (u * u + v * v) + cr * cr;
      if (g <= 0) continue;
      best = Math.max(best, d + Math.sqrt(g));
    }
    pts.push([CX + c * best, CY + s * best]);
  }
  return pts;
}
function dropPts() {
  const p = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + (i / 40) * Math.PI * 1.5;
    p.push([CX + Math.cos(a) * 80, CY + Math.sin(a) * 80 - 10]);
  }
  p.push([CX, CY + 140]);
  return p;
}

const PRESETS = {
  hexagon: { pts: () => regular(6, 120, Math.PI / 6), r: 18 },
  square: { pts: () => regular(4, 120, Math.PI / 4), r: 26 },
  triangle: { pts: () => regular(3, 130, -Math.PI / 2), r: 30 },
  star: { pts: () => starPts(5, 130, 54), r: 6 },
  gear: { pts: () => gearPts(8, 125, 98), r: 5 },
  cloud: { pts: cloudPts, r: 0 },
  drop: { pts: dropPts, r: 24 },
  shield: {
    pts: () => [[CX - 110, CY - 90], [CX + 110, CY - 90], [CX + 110, CY + 20],
      [CX, CY + 140], [CX - 110, CY + 20]],
    r: 20,
  },
};
// 预设按钮显示名走 i18n
const PRESET_LABEL = {
  hexagon: t('workshop.js.preset.hexagon'),
  square: t('workshop.js.preset.square'),
  triangle: t('workshop.js.preset.triangle'),
  star: t('workshop.js.preset.star'),
  gear: t('workshop.js.preset.gear'),
  cloud: t('workshop.js.preset.cloud'),
  drop: t('workshop.js.preset.drop'),
  shield: t('workshop.js.preset.shield'),
};

let verts = [], radii = [], sel = -1, drag = -1;

export function init(root) {
  const svg = root.querySelector('.wb-canvas svg');
  const presetsBox = root.querySelector('.wb-presets');
  const cR = root.querySelector('.wb-r');
  const cN = root.querySelector('.wb-n');
  const cSel = root.querySelector('.wb-sel');
  const verdict = root.querySelector('.wb-verdict');
  const codeOut = root.querySelector('.code-out');
  const showHull = root.querySelector('.wb-showhull');
  const resetBtn = root.querySelector('.wb-reset');

  // ---------- 渲染 ----------
  function render() {
    const d = ac(verts, radii);
    const hp = hull(verts);
    const loss = hullLoss(verts);
    const concave = loss > 0.005;

    svg.replaceChildren();
    if (showHull.checked) {
      svg.insertAdjacentHTML('beforeend',
        `<path d="${polyD(hp)}" fill="rgba(255,122,138,.22)"
           stroke="rgba(255,122,138,.85)" stroke-width="2" stroke-dasharray="7 6"/>`);
    }
    svg.insertAdjacentHTML('beforeend',
      `<path d="${d}" fill="rgba(10,10,12,.92)"/>` +
      `<path d="${d}" fill="none" stroke="#2e6bff" stroke-width="2.5"/>`);

    verts.forEach((p, i) => {
      const on = i === sel;
      svg.insertAdjacentHTML('beforeend',
        `<circle cx="${p[0]}" cy="${p[1]}" r="${on ? 10 : 7}"
           fill="${on ? '#2e6bff' : '#fff'}"
           stroke="${on ? '#fff' : '#2e6bff'}" stroke-width="${on ? 3 : 2.5}"
           style="cursor:grab"/>` +
        `<text x="${p[0] + 13}" y="${p[1] - 11}" font-size="11" fill="#6b6b80"
           font-family="ui-monospace,monospace">${i}</text>`);
    });

    if (concave) {
      verdict.className = 'wb-verdict bad';
      verdict.innerHTML = `${t('workshop.js.verdict.concave1')}<b>${(loss * 100).toFixed(1)}%</b>${t('workshop.js.verdict.concave2')}
        <small>${t('workshop.js.verdict.concave3')}<code>extrusion</code>${t('workshop.js.verdict.concave4')}<code>loft</code>${t('workshop.js.verdict.concave5')}<code>solid</code></small>`;
    } else {
      verdict.className = 'wb-verdict ok';
      verdict.innerHTML = `${t('workshop.js.verdict.convex1')}<b>${((1 - loss) * 100).toFixed(1)}%</b>
        <small>${t('workshop.js.verdict.convex2')}<code>solid</code>${t('workshop.js.verdict.convex3')}</small>`;
    }
    renderCode(concave, loss);
  }

  // ---------- 代码生成 ----------
  // 画布坐标 → 设计坐标（中心 = x），输出成 x±d 的表达式
  function toOffsets() {
    const cx = verts.reduce((s, p) => s + p[0], 0) / verts.length;
    const cy = verts.reduce((s, p) => s + p[1], 0) / verts.length;
    return verts.map(([x, y]) => [
      Math.round((x - cx) * K), Math.round((y - cy) * K),
    ]);
  }
  const off = (v) => (v < 0 ? `x-${Math.abs(v)}` : `x+${v}`);

  function isRegular() {
    if (verts.length < 3) return false;
    let cx = 0, cy = 0;
    for (const p of verts) { cx += p[0]; cy += p[1]; }
    cx /= verts.length; cy /= verts.length;
    const rs = verts.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    return rs.every((r) => Math.abs(r - mean) / mean < 0.02);
  }
  const sameRadii = () => radii.every((r) => r === radii[0]);

  function renderCode(concave, loss) {
    const offs = toOffsets();
    const n = verts.length;
    const R = Math.round(radii[0] * K);
    const regular = isRegular() && sameRadii();

    let gen;
    if (regular) {
      let cx = 0, cy = 0;
      for (const p of verts) { cx += p[0]; cy += p[1]; }
      cx /= n; cy /= n;
      const rr = Math.round(Math.hypot(verts[0][0] - cx, verts[0][1] - cy) * K);
      const a0 = Math.atan2(verts[0][1] - cy, verts[0][0] - cx);
      gen = `// 规则多边形 → 一行搞定
moon: () => eh(${rr}, ${n}, ${R}, ${a0.toFixed(3)}),`;
    } else {
      const rows = [];
      for (let i = 0; i < offs.length; i += 3) {
        rows.push(offs.slice(i, i + 3)
          .map(([dx, dy]) => `[${off(dx)},${off(dy)}]`).join(', '));
      }
      const rExpr = sameRadii()
        ? `${R}`
        : `[${radii.map((r) => Math.round(r * K)).join(', ')}]`;
      gen = `// 自由顶点 → ac(点数组, 圆角)
moon: () => ac([
  ${rows.join(',\n  ')}
], ${rExpr}),`;
    }

    const size = 1.17;
    const samples = 'Jt(mt("moon"))';
    const ivSolid = `// 凸 → solid（最省事）
moon: () => qn(${size}, "moon"),
// qn(e,t) = { size:e, silhouette: Qn(ah(t)), seat: sh(t,[]) }
// seat 是 wrap 型：眼睛绕柱面包裹`;
    const ivExtr = `// 凹 + 有厚度 → extrusion
moon: () => oh(${size}, ${samples}, .36, .22),
//                     ↑halfDepth  ↑bevel
// seat = { kind:"front", faceZ:.36 }   ← 平面正脸`;
    const ivLoft = `// 凹 + 鼓起来 → loft
moon: () => zl(${size}, ${samples}, .62),
//                        ↑depth
// seat = { kind:"loft", surfaceZ: Dv(rings) }   ← 眼睛贴放样面`;
    const iv = concave ? `${ivExtr}\n\n${ivLoft}` : ivSolid;

    const iS = concave
      ? `moon: { kind: "extrusion", halfDepth: .36, bevel: .22 },
// 或：moon: { kind: "loft", depth: .62 },`
      : `moon: { kind: "revolve" },`;

    const dataBlk = `// grok-recipes.json
"names": [ …, "moon" ],        // ← 漏了这个会静默变球！
"eyeMetrics": {
  "moon": { "width": 0.21, "height": 0.46,
            "gap": 0.47, "shiftY": 0.12 }   // 从相近形状抄，主要调 shiftY
}`;

    const ui = `Hw = [ …, "moon" ];          // 选形状面板的清单
function wN(e) {              // UI 名 → 引擎名
  switch (e) { case "moon": return "moon"; … }
}`;

    const blocks = [
      [t('workshop.js.code.h1'), gen],
      [t('workshop.js.code.h2'), iv],
      [t('workshop.js.code.h3'), iS],
      [t('workshop.js.code.h4'), dataBlk],
      [t('workshop.js.code.h5'), ui],
    ];
    codeOut.innerHTML = blocks.map(([h, body]) => `
      <div class="code-blk">
        <div class="ch"><span>${h}</span><button data-copy>${t('workshop.js.copy')}</button></div>
        <pre class="code">${trCode(body)}</pre>
      </div>`).join('');
    codeOut.querySelectorAll('[data-copy]').forEach((b) => {
      b.addEventListener('click', () => {
        const txt = b.closest('.code-blk').querySelector('pre').innerText;
        navigator.clipboard?.writeText(txt);
        b.textContent = t('workshop.js.copied');
        setTimeout(() => { b.textContent = t('workshop.js.copy'); }, 1200);
      });
    });
    // 损失数字用在提示里，保证与判定一致
    verdict.dataset.loss = loss.toFixed(4);
  }

  // ---------- 预设 ----------
  Object.entries(PRESETS).forEach(([name, def]) => {
    const b = document.createElement('button');
    b.textContent = PRESET_LABEL[name];
    b.dataset.preset = name;
    b.addEventListener('click', () => load(name));
    presetsBox.appendChild(b);
  });

  function load(name) {
    const def = PRESETS[name];
    verts = def.pts().map((p) => [p[0], p[1]]);
    radii = verts.map(() => def.r);
    sel = -1;
    cR.value = def.r;
    root.querySelector('.wb-r-v').textContent = def.r;
    cN.value = verts.length;
    root.querySelector('.wb-n-v').textContent = verts.length;
    cSel.disabled = true;
    root.querySelector('.wb-sel-v').textContent = '—';
    presetsBox.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.preset === name));
    });
    render();
  }

  // ---------- 拖拽 ----------
  const localPt = (e) => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * CW,
      ((e.clientY - r.top) / r.height) * CH];
  };
  svg.addEventListener('pointerdown', (e) => {
    const [x, y] = localPt(e);
    let best = -1, bd = 22;
    verts.forEach((p, i) => {
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return;
    drag = best; sel = best;
    svg.setPointerCapture(e.pointerId);
    cSel.disabled = false;
    cSel.value = radii[sel];
    root.querySelector('.wb-sel-v').textContent = radii[sel];
    render();
  });
  svg.addEventListener('pointermove', (e) => {
    if (drag < 0) return;
    const [x, y] = localPt(e);
    verts[drag] = [clamp(x, 10, CW - 10), clamp(y, 10, CH - 10)];
    render();
  });
  svg.addEventListener('pointerup', () => { drag = -1; });

  // ---------- 控件 ----------
  cR.addEventListener('input', () => {
    const v = +cR.value;
    root.querySelector('.wb-r-v').textContent = v;
    radii = radii.map(() => v);
    sel = -1;
    cSel.disabled = true;
    root.querySelector('.wb-sel-v').textContent = '—';
    render();
  });
  cN.addEventListener('input', () => {
    const want = +cN.value;
    root.querySelector('.wb-n-v').textContent = want;
    const n = verts.length;
    if (want > n) {
      let cx = 0, cy = 0;
      for (const p of verts) { cx += p[0]; cy += p[1]; }
      cx /= n; cy /= n;
      const r = verts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / n;
      for (let i = 0; i < want - n; i++) {
        const a = ((n + i) / want) * TAU - Math.PI / 2;
        verts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        radii.push(radii[0]);
      }
    } else if (want < n) {
      verts = verts.slice(0, want);
      radii = radii.slice(0, want);
    }
    if (sel >= verts.length) {
      sel = -1;
      cSel.disabled = true;
      root.querySelector('.wb-sel-v').textContent = '—';
    }
    render();
  });
  cSel.addEventListener('input', () => {
    if (sel < 0) return;
    radii[sel] = +cSel.value;
    root.querySelector('.wb-sel-v').textContent = radii[sel];
    render();
  });
  resetBtn.addEventListener('click', () => {
    radii = radii.map(() => +cR.value);
    sel = -1;
    cSel.disabled = true;
    root.querySelector('.wb-sel-v').textContent = '—';
    render();
  });
  showHull.addEventListener('change', render);

  load('star');
}
