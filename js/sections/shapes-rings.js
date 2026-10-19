// 形状页 · 05 环结构（挤出 / 放样）+ 06 球链家族
// 环用真 3D 线框画：绕 Y 再绕 X 旋转 → 正交投影，和引擎的 dh() 同一套思路。
import {
  CANVAS_CENTER as X, Nv, zv, th, tv, samplePath, ptsOf,
} from '../lib-shapes.js';

const f = (n) => Math.round(n * 100) / 100;

// 3D → 2D（绕 Y 旋转 yaw，再绕 X 旋转 pitch，最后丢掉 z）
function proj3(p, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  return [x1, p.y * cp - z1 * sp];
}

function ringSvg(rings, { yaw = -0.62, pitch = -0.34, h = 300 } = {}) {
  const polys = rings.map((r) => r.map((p) => proj3(p, yaw, pitch)));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const poly of polys) {
    for (const [x, y] of poly) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const m = Math.max(x1 - x0, y1 - y0) * 1.16 || 1;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const n = polys.length;
  const body = polys.map((poly, i) => {
    const t = n > 1 ? i / (n - 1) : 0;          // 0 = 最后 1 = 最前
    const op = (0.16 + 0.66 * t).toFixed(3);
    const w = (1.1 + 1.6 * t).toFixed(2);
    const d = 'M' + poly.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
    return `<path d="${d}" fill="none" stroke="rgba(46,107,255,${op})" stroke-width="${w}"/>`;
  }).join('');
  return `<svg viewBox="${cx - m / 2} ${cy - m / 2} ${m} ${m}"
    style="width:100%;height:${h}px;display:block">${body}</svg>`;
}

// 云朵的平面采样点（作为放样输入）—— 直接采样 th() 的输出，不重复实现
function cloudPts(k = 0) {
  return samplePath(th([
    [X - 62, X + 26, 56 + k], [X + 62, X + 26, 54 + k],
    [X, X + 34, 62 + k], [X - 24, X - 30, 62 + k], [X + 38, X - 26, 54 + k],
  ]), 96);
}

function hexPts() {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
    return [X + Math.cos(a) * 114, X + Math.sin(a) * 114];
  });
}

export function init(root, data) {
  if (root.querySelector('.nv-stage')) initRings(root);
  if (root.querySelector('.balls-tablet')) initBalls(root, data);
}

// ---------- 05 环结构 ----------
function initRings(root) {
  const nvStage = root.querySelector('.nv-stage');
  const zvStage = root.querySelector('.zv-stage');
  // 注意：这里不能把控件对象命名成 nv / zv —— 会遮蔽从 lib-shapes 导入的
  // Nv() / zv() 函数，调用时直接 TypeError。
  const ctl = {
    nvDepth: root.querySelector('.nv-depth'),
    nvBevel: root.querySelector('.nv-bevel'),
    zvDepth: root.querySelector('.zv-depth'),
    zvRh: root.querySelector('.zv-rh'),
  };

  const drawNv = () => {
    const d = +ctl.nvDepth.value, b = +ctl.nvBevel.value;
    root.querySelector('.nv-depth-v').textContent = d.toFixed(2);
    root.querySelector('.nv-bevel-v').textContent = b.toFixed(2);
    nvStage.innerHTML = ringSvg(Nv(hexPts(), d * X, b * X));
  };
  const drawZv = () => {
    const d = +ctl.zvDepth.value, r = +ctl.zvRh.value;
    root.querySelector('.zv-depth-v').textContent = d.toFixed(2);
    root.querySelector('.zv-rh-v').textContent = r.toFixed(2);
    zvStage.innerHTML = ringSvg(zv(cloudPts(0), d * X, r), { yaw: -0.5, pitch: -0.42 });
  };

  ctl.nvDepth.addEventListener('input', drawNv);
  ctl.nvBevel.addEventListener('input', drawNv);
  ctl.zvDepth.addEventListener('input', drawZv);
  ctl.zvRh.addEventListener('input', drawZv);
  drawNv(); drawZv();
}

// ---------- 06 球链 ----------
function ballsSvg(balls, outlineD, h = 260) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [cx, cy, r] of balls) {
    x0 = Math.min(x0, cx - r); x1 = Math.max(x1, cx + r);
    y0 = Math.min(y0, cy - r); y1 = Math.max(y1, cy + r);
  }
  const m = Math.max(x1 - x0, y1 - y0) * 1.12 || 1;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const body = outlineD
    ? `<path d="${outlineD}" fill="rgba(10,10,12,.07)" stroke="rgba(10,10,12,.45)"
        stroke-width="1.6"/>` : '';
  const g = balls.map(([bx, by, r], i) => {
    const t = i / Math.max(1, balls.length - 1);
    return `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(r)}" fill="none"
        stroke="rgba(37,110,220,${(0.3 + 0.55 * t).toFixed(2)})" stroke-width="1.5"/>
      <circle cx="${f(bx)}" cy="${f(by)}" r="1.8" fill="rgba(37,110,220,.85)"/>`;
  }).join('');
  return `<svg viewBox="${cx - m / 2} ${cy - m / 2} ${m} ${m}"
    style="width:100%;height:${h}px;display:block">${body}${g}</svg>`;
}

// 主轴（PCA）—— 球链要沿形状自己的长轴排，不是包围盒的 x 轴
function mainAxis(pts) {
  const n = pts.length;
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= n; cy /= n;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const [x, y] of pts) {
    const dx = x - cx, dy = y - cy;
    cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
  }
  const th = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  return { cx, cy, ux: Math.cos(th), uy: Math.sin(th) };
}

function initBalls(root, data) {
  const byName = Object.fromEntries(data.shapes.map((s) => [s.name, s]));
  const tabletStage = root.querySelector('.balls-tablet');
  const beanStage = root.querySelector('.balls-bean');

  // tablet：引擎用 jl("tablet","x") 排 Rl=33 个球；这里画 11 个便于看清
  const tabletD = tv(114, 74);
  const tPts = samplePath(tabletD, 240);
  const ax = mainAxis(tPts);
  let lo = Infinity, hi = -Infinity, maxPerp = 0;
  for (const [x, y] of tPts) {
    const t = (x - ax.cx) * ax.ux + (y - ax.cy) * ax.uy;
    const q = -(x - ax.cx) * ax.uy + (y - ax.cy) * ax.ux;
    lo = Math.min(lo, t); hi = Math.max(hi, t);
    maxPerp = Math.max(maxPerp, Math.abs(q));
  }
  const cap = maxPerp, half = Math.max(0, (hi - lo) / 2 - cap);
  const N = 11, balls = [];
  for (let i = 0; i < N; i++) {
    const t = -half + (2 * half * i) / (N - 1);
    balls.push([ax.cx + ax.ux * t, ax.cy + ax.uy * t, cap]);
  }
  tabletStage.innerHTML = ballsSvg(balls, tabletD);

  // bean：最大内切球（网格 + 点到轮廓距离 + 贪心去重），对 App 真实轮廓算
  const shape = byName.bean;
  const poly = ptsOf(shape.path);
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const step = Math.max(x1 - x0, y1 - y0) / 40;
  const inside = (x, y) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < xi + ((xj - xi) * (y - yi)) / (yj - yi)) hit = !hit;
    }
    return hit;
  };
  const cand = [];
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      if (!inside(x, y)) continue;
      let best = Infinity;
      for (const [px, py] of poly) best = Math.min(best, (px - x) ** 2 + (py - y) ** 2);
      const r = Math.sqrt(best);
      if (r > step) cand.push([x, y, r]);
    }
  }
  cand.sort((a, b) => b[2] - a[2]);
  const keep = [];
  for (const b of cand) {
    if (!keep.some((k) => Math.hypot(b[0] - k[0], b[1] - k[1]) + b[2] <= k[2] + step * 0.25)) {
      keep.push(b);
    }
  }
  beanStage.innerHTML = ballsSvg(keep, shape.path);
}
