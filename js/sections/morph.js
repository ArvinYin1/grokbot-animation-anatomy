// 第 2 节：径向轮廓 morph —— 向 N 个角度发射线求交点得 r(θ)，逐角度 lerp
import { smoothClosedPath } from '../lib.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const f = (n) => Math.round(n * 100) / 100;

// ----- 形状注册表（本页取 4 种；原引擎 20+ 种，公开 API 只暴露 4 种） -----
function circlePoly() {
  const pts = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    pts.push([40 * Math.cos(a), 40 * Math.sin(a)]);
  }
  return pts;
}
function starPoly() {
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 40 : 21;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}
function heartPoly() {
  const pts = [];
  for (let i = 0; i < 180; i++) {
    const t = (i / 180) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x * 2.6, y * 2.6]);
  }
  return recenter(pts);
}
function teardropPoly() {
  const pts = [];
  for (let i = 0; i < 128; i++) {
    const t = (i / 128) * Math.PI * 2;
    const w = 0.12 + 0.88 * Math.pow(Math.sin(t / 2), 2);
    pts.push([Math.sin(t) * w * 42, -Math.cos(t) * 42]);
  }
  return recenter(pts);
}
function recenter(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  return pts.map(([x, y]) => [x - cx, y - cy]);
}

// 射线与多边形求交：返回最近正向交点距离（star-shaped 假设）
function rayHit(poly, th) {
  const dx = Math.cos(th), dy = Math.sin(th);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const sx = bx - ax, sy = by - ay;
    const den = dx * sy - dy * sx;
    if (Math.abs(den) < 1e-9) continue;
    const t = (ax * sy - ay * sx) / den;
    const u = (ax * dy - ay * dx) / den;
    // u 需要容差：射线恰好穿过共享顶点时，浮点会让一段给出 u=1+ε、
    // 下一段 u=-ε，两段都被拒 → r=0，轮廓上出现一条扎进圆心的缝
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
  }
  return best === Infinity ? 0 : best;
}

// 对形状做 N 角度采样 → r(θ) 数组
function sampleRadial(poly, n) {
  const r = new Float64Array(n);
  for (let k = 0; k < n; k++) r[k] = rayHit(poly, (k / n) * Math.PI * 2 - Math.PI / 2);
  return r;
}

export function init(root) {
  const svg = root.querySelector('svg.morph-canvas');
  const raysG = svg.querySelector('.rays');
  const shapePath = svg.querySelector('.shape');
  const dotsG = svg.querySelector('.hits');
  const slider = root.querySelector('[data-morph]');
  const raysToggle = root.querySelector('[data-rays]');
  const countSel = root.querySelector('[data-count]');
  const label = root.querySelector('.morph-label');

  const SHAPES = [
    { name: 'circle 圆形', poly: circlePoly() },
    { name: 'star6 六角星', poly: starPoly() },
    { name: 'heart 爱心', poly: heartPoly() },
    { name: 'teardrop 水滴', poly: teardropPoly() },
  ];
  const C = 210, SCALE = 2.6;
  let cache = {}; // n -> per-shape r arrays

  function radialArrays(n) {
    if (!cache[n]) cache[n] = SHAPES.map((s) => sampleRadial(s.poly, n));
    return cache[n];
  }

  function draw() {
    const n = +countSel.value;
    const t = +slider.value;
    const i = Math.min(SHAPES.length - 2, Math.floor(t));
    const frac = t - i;
    const rs = radialArrays(n);
    const A = rs[i], B = rs[i + 1];
    const pts = [];
    for (let k = 0; k < n; k++) {
      const th = (k / n) * Math.PI * 2 - Math.PI / 2;
      const r = (A[k] + (B[k] - A[k]) * frac) * SCALE;
      pts.push([C + r * Math.cos(th), C + r * Math.sin(th)]);
    }
    shapePath.setAttribute('d', smoothClosedPath(pts));
    label.textContent = `${SHAPES[i].name} ↔ ${SHAPES[i + 1].name}　t=${frac.toFixed(2)}　N=${n}`;

    raysG.textContent = '';
    dotsG.textContent = '';
    if (raysToggle.checked) {
      for (let k = 0; k < n; k++) {
        const th = (k / n) * Math.PI * 2 - Math.PI / 2;
        const r = (A[k] + (B[k] - A[k]) * frac) * SCALE;
        const x = C + r * Math.cos(th), y = C + r * Math.sin(th);
        const line = document.createElementNS(SVGNS, 'line');
        line.setAttribute('x1', C); line.setAttribute('y1', C);
        line.setAttribute('x2', f(x)); line.setAttribute('y2', f(y));
        raysG.appendChild(line);
        const dot = document.createElementNS(SVGNS, 'circle');
        dot.setAttribute('cx', f(x)); dot.setAttribute('cy', f(y));
        dot.setAttribute('r', n > 64 ? 1.6 : 3);
        dotsG.appendChild(dot);
      }
    }
  }

  slider.addEventListener('input', draw);
  raysToggle.addEventListener('change', draw);
  countSel.addEventListener('change', draw);
  draw();
}
