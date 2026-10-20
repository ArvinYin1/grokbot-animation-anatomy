// ============================================================
// lib-shapes.js — 形状系统的几何层（原 bundle 的忠实移植）
//
// 对应 index.eager-platform-*.js 里的：
//   gn(路径构造器) / ev(Catmull-Rom) / ar(极坐标采样) / ac(圆角多边形)
//   eh(正多边形) / th(圆并集) / El(超椭圆) / uv,lv,av,tv,cv(具名形状)
//   pi(Andrew 单调链凸包) / Nv(挤出环) / zv(放样环)
//
// 坐标系：以设计画布中心 x=114.2705 为原点，y 轴向下为正（与 Mv 表一致）。
// 0 依赖，原生 ES module。
// ============================================================

export const CANVAS_CENTER = 114.2705;
const X = CANVAS_CENTER;
const TAU = Math.PI * 2;
const f = (n) => Math.round(n * 100) / 100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- 路径构造器（对应 bundle 的 gn 类） ----------
export class Path {
  constructor() { this.d = ''; }
  move(x, y) { this.d += `M${f(x)} ${f(y)}`; return this; }
  line(x, y) { this.d += `L${f(x)} ${f(y)}`; return this; }
  curve(a, b, c, d, e, g) {
    this.d += `C${f(a)} ${f(b)} ${f(c)} ${f(d)} ${f(e)} ${f(g)}`; return this;
  }
  // corner：圆角 = 以顶点为控制点的二次贝塞尔，切线长 = 半径 o
  corner(prev, cur, next, r) {
    const u = (p, q) => {
      const dx = p[0] - q[0], dy = p[1] - q[1], L = Math.hypot(dx, dy) || 1;
      return [dx / L, dy / L];
    };
    const i = u(prev, cur), a = u(next, cur);
    const c = [cur[0] + i[0] * r, cur[1] + i[1] * r];
    const e = [cur[0] + a[0] * r, cur[1] + a[1] * r];
    if (this.d) this.line(c[0], c[1]); else this.move(c[0], c[1]);
    this.d += `Q${f(cur[0])} ${f(cur[1])} ${f(e[0])} ${f(e[1])}`;
    return this;
  }
  // arc：椭圆弧用三次贝塞尔拟合（k = 4/3·tan(Δ/4)），每段不超过 90°
  arc(cx, cy, rx, ry, a0, a1) {
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2)));
    const da = (a1 - a0) / n, k = (4 / 3) * Math.tan(da / 4);
    let l = a0;
    for (let i = 0; i < n; i++) {
      const g = l + da;
      const h = [cx + rx * Math.cos(l), cy + ry * Math.sin(l)];
      const p = [cx + rx * Math.cos(g), cy + ry * Math.sin(g)];
      this.curve(
        h[0] - k * rx * Math.sin(l), h[1] + k * ry * Math.cos(l),
        p[0] + k * rx * Math.sin(g), p[1] - k * ry * Math.cos(g), p[0], p[1]);
      l = g;
    }
    return this;
  }
  close() { return this.d + 'Z'; }
}

// ---------- ev：Catmull-Rom → 闭合三次贝塞尔（切线取 /6） ----------
export function ev(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i];
    const p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ` +
      `${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

// ---------- ar：极坐标函数采样 t 个点，再 ev 平滑 ----------
export function ar(fn, t = 128) {
  const n = [];
  for (let i = 0; i < t; i++) n.push(fn((i / t) * TAU));
  return ev(n);
}

// ---------- ac：圆角多边形。r 传数字=统一圆角，传数组=逐顶点圆角 ----------
export function ac(pts, r) {
  const p = new Path(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const rr = typeof r === 'number' ? r : r[i % r.length];
    p.corner(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], rr);
  }
  return p.close();
}

// ---------- eh：正 count 边形（外接圆半径 radius）+ 圆角 cornerR ----------
export function eh(radius, count, cornerR, phase = 0) {
  return ac(Array.from({ length: count }, (_, i) => {
    const a = phase + (i / count) * TAU;
    return [X + Math.cos(a) * radius, X + Math.sin(a) * radius];
  }), cornerR);
}

// ---------- th：圆并集的轮廓（射线求最远交点），再用 ev 平滑 ----------
// circles: [[cx, cy, r], ...]，cx/cy 为设计画布绝对坐标
export function th(circles, t = 160) {
  return ar((a) => {
    const c = Math.cos(a), s = Math.sin(a);
    let best = 0;
    for (const [cx, cy, cr] of circles) {
      const u = cx - X, v = cy - X;
      const d = c * u + s * v;
      const g = d * d - (u * u + v * v) + cr * cr;
      if (g <= 0) continue;                 // 这根射线打不到这个圆
      const h = d + Math.sqrt(g);           // 取远交点
      if (h > best) best = h;
    }
    return [X + c * best, X + s * best];
  }, t);
}

// ---------- El：超椭圆 |x/a|^n + |y/b|^n = 1 ----------
// n=2 椭圆，n↑ 越方（squircle 用 3.2），n<2 变尖（gem 用 1.5）
export function El(a, b, n) {
  return ar((t) => {
    const c = Math.cos(t), s = Math.sin(t);
    return [X + Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * a,
      X + Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * b];
  });
}

// ---------- 具名形状生成器（对应 Mv 表里的 uv/lv/av/tv/cv） ----------
export const uv = (e, r) => ac(
  [[X - e, X - e], [X + e, X - e], [X + e, X + e], [X - e, X + e]], r);

export const lv = (e, t, n, r) => ac(
  [[X - e, X + t], [X + e, X + t], [X + e, X - t + n], [X, X - t], [X - e, X - t + n]], r);

export const av = (e, t, n) => ar((r) => {
  const o = Math.cos(r), s = Math.sin(r), i = (1 - s) / 2;
  return [X + o * e * (1 - n * i * i), X + s * t];
});

export const tv = (e, t) => new Path()
  .move(X - e + t, X - t).line(X + e - t, X - t)
  .arc(X + e - t, X, t, t, -Math.PI / 2, Math.PI / 2)
  .line(X - e + t, X + t)
  .arc(X - e + t, X, t, t, Math.PI / 2, Math.PI * 1.5)
  .close();

export const cv = (e, t, n, r) => {
  const o = clamp(e / (n - t), -1, 1), s = Math.sqrt(1 - o * o);
  const i = [X + e * s, n - e * o], a = [X - e * s, n - e * o];
  const c = Math.atan2(i[1] - n, i[0] - X);
  return new Path().corner(i, [X, t], a, r).line(a[0], a[1])
    .arc(X, n, e, e, Math.PI - c, c).close();
};

// ---------- pi：Andrew 单调链凸包（剔除共线点） ----------
export function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop(); up.pop();
  return [...lo, ...up];
}

export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

// 凸包吃掉了多少面积：0 = 完全凸
export function hullLoss(pts) {
  const a1 = polyArea(pts), a2 = polyArea(hull(pts));
  return a2 > 0 ? 1 - a1 / a2 : 0;
}

export const polyD = (pts) => (pts.length
  ? 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z' : '');

// ---------- Nv：挤出环（倒角） ----------
// 轮廓朝自身中心缩放的同时往 ±z 走，Ar=4 步；u = 最小半轴
export function Nv(pts, halfDepth, bevel, steps = 4) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const u = Math.max(1e-4, Math.min((x1 - x0) / 2, (y1 - y0) / 2));
  const layer = (i, sign) => {
    const p = (i / steps) * (Math.PI / 2);
    const g = halfDepth - bevel + bevel * Math.sin(p);
    return { z: sign < 0 ? -g : g, scale: 1 - (bevel / u) * (1 - Math.cos(p)) };
  };
  const layers = [];
  for (let i = steps; i >= 0; i--) layers.push(layer(i, -1));
  for (let i = 0; i <= steps; i++) layers.push(layer(i, 1));
  return layers.map(({ z, scale }) => pts.map((p) => ({
    x: cx + (p[0] - cx) * scale, y: cy + (p[1] - cy) * scale, z,
  })));
}

// ---------- zv：放样环（上下收成点） ----------
// $l=16 步；scale = max(0, cos d)^rh；z = depth·sin d
export function zv(pts, depth, rh = 0.72, steps = 16) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const d = -Math.PI / 2 + (Math.PI * i) / steps;
    const k = Math.pow(Math.max(0, Math.cos(d)), rh);
    const z = depth * Math.sin(d);
    rings.push(pts.map((p) => ({
      x: cx + (p[0] - cx) * k, y: cy + (p[1] - cy) * k, z,
    })));
  }
  return rings;
}

// ---------- 从路径字符串取点 ----------
// 走 SVG 自己的 getPointAtLength，圆弧/贝塞尔都能正确采样
export function samplePath(d, n = 240) {
  if (!d || typeof d !== 'string') return [];   // 空 path 会让 getPointAtLength 抛错
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  document.body.appendChild(svg);
  const L = p.getTotalLength();
  const out = [];
  for (let i = 0; i < n; i++) {
    const pt = p.getPointAtLength((i / n) * L);
    out.push([pt.x, pt.y]);
  }
  svg.remove();
  return out;
}

// 纯折线路径（无圆弧命令）可直接从 d 里抓点对
export function ptsOf(d) {
  const nums = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []).map(Number);
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

export const hasArc = (d) => /[Aa]/.test(d);

// ---------- 把一个 svg 按第一个 path 的 bbox 归一（便于缩放展示） ----------
// 展示路径都是折线（无圆弧命令），用 ptsOf 纯文本解析求包围盒，不触发布局；
// 带圆弧的路径（仅 blob，不出现在展示区）回退到 samplePath 采样。
// 注意：不要直接把它传给 forEach —— 回调第二参数 index 会被当成 pad。
export function fitViewBox(svg, pad = 1.06) {
  const p = svg.querySelector('path');
  if (!p) return;
  const d = p.getAttribute('d');
  const pts = hasArc(d) ? samplePath(d, 360) : ptsOf(d);
  if (!pts.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  const m = Math.max(x1 - x0, y1 - y0) * pad || 1;
  svg.setAttribute('viewBox',
    `${(x0 + x1) / 2 - m / 2} ${(y0 + y1) / 2 - m / 2} ${m} ${m}`);
}
