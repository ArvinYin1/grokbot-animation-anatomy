// ============================================================
// lib.js — 各教学 demo 复用的基础件
//   · Spring：手写半隐式欧拉弹簧（120Hz 固定子步）
//   · rafLoop：rAF 驱动 / 离屏休眠 / reduced-motion 静态化
//   · smoothClosedPath：Catmull-Rom 闭合平滑路径
// 0 依赖，原生 ES module。
// ============================================================

const f = (n) => Math.round(n * 100) / 100;

// ---------- 半隐式欧拉弹簧（120Hz 固定子步） ----------
// v += (-2ζω·v - ω²·(x - target))·dt ; x += v·dt
export class Spring {
  constructor(value = 0, omega = 10, zeta = 1) {
    this.x = value; this.v = 0; this.target = value;
    this.omega = omega; this.zeta = zeta;
  }
  step(dt) {
    const h = 1 / 120;
    let remaining = Math.min(dt, 0.1);
    while (remaining > 1e-6) {
      const d = Math.min(h, remaining);
      this.v += (-2 * this.zeta * this.omega * this.v -
        this.omega * this.omega * (this.x - this.target)) * d;
      this.x += this.v * d;
      remaining -= d;
    }
    return this.x;
  }
  get settled() {
    return Math.abs(this.v) < 1e-3 && Math.abs(this.x - this.target) < 1e-3;
  }
}

// ---------- 通用 rAF 循环：离屏休眠 + 页面隐藏暂停 + reduced-motion ----------
export function rafLoop(hostEl, frame) {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, visible = true, running = false, last = 0, t = 0, scale = 1;
  const tick = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt * scale;
    frame(dt * scale, t);
    raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    const should = visible && !document.hidden && !mq.matches;
    if (should && !running) {
      running = true; last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!should && running) {
      running = false; cancelAnimationFrame(raf);
    }
  };
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); });
  io.observe(hostEl);
  document.addEventListener('visibilitychange', sync);
  mq.addEventListener?.('change', () => { frame(0, t); sync(); });
  if (mq.matches) { frame(0, 0); } else { sync(); }
  return {
    setTimeScale(s) { scale = s; },
    destroy() { running = false; cancelAnimationFrame(raf); io.disconnect(); },
  };
}

// ---------- 路径工具 ----------
export function smoothClosedPath(pts) {
  const n = pts.length;
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
         `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ` +
         `${f(p2[0])} ${f(p2[1])} `;
  }
  return d + 'Z';
}
