// ============================================================
// mini-bot.js — 程序化 bot 头像引擎（本页所有 demo 复用的心脏）
// 复刻 GrokBotMark 逆向结论的最小实现：
//   · 程序化 SVG + 属性级 diff 写入
//   · rAF 驱动 / 离屏休眠 / reduced-motion 静态化
//   · 手写半隐式欧拉弹簧（120Hz 固定子步）
//   · 眼睛在单位球面上做 3D 旋转 + 正交投影（z<0 消失、边缘压缩）
//   · xorshift 种子化眨眼时刻表（FNV-1a 种子）
//   · 视线跟随（±1 归一化 → 14% 一阶低通 → 头部旋转）
//   · 状态覆盖层：idle / thinking / orbit / alerting / finished
// 0 依赖，原生 ES module。
// ============================================================

const DEG = Math.PI / 180;
const f = (n) => Math.round(n * 100) / 100;

// ---------- 确定性随机：FNV-1a + xorshift32 ----------
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function xorshift32(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// 眨眼时刻表：间隔 1.9–4.6s，18% 概率双眨（第二次 +0.35s）
export function generateBlinkSchedule(seed, duration = 30) {
  const rand = xorshift32(seed);
  const events = [];
  let t = 0.8 + rand() * 1.6;
  while (t < duration) {
    events.push(f(t));
    if (rand() < 0.18) events.push(f(t + 0.35));
    t += 1.9 + rand() * 2.7;
  }
  return events;
}

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

// ---------- 球面眼睛数学（第 4 节同款代码） ----------
// 眼睛放在单位球上：基础方向 (baseYaw, basePitch)，头部 (yaw, pitch) 旋转后
// 正交投影。宽度轴随球面倾斜自然压缩，z <= 0 转到背面消失。
function rotY(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rotX(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}
export function projectEye(yawDeg, pitchDeg, baseYawDeg, basePitchDeg) {
  const by = baseYawDeg * DEG, bp = basePitchDeg * DEG;
  let d = [Math.sin(by) * Math.cos(bp), Math.sin(bp), Math.cos(by) * Math.cos(bp)];
  let ax = [Math.cos(by), 0, -Math.sin(by)]; // 眼睛局部宽度轴（切线方向）
  const y = yawDeg * DEG, p = pitchDeg * DEG;
  d = rotX(rotY(d, y), p);
  ax = rotX(rotY(ax, y), p);
  const w = Math.hypot(ax[0], ax[1]); // 投影后宽度系数（球面深度压缩）
  return {
    x: d[0], y: d[1], z: d[2],
    widthScale: Math.max(0.12, w),
    rot: Math.atan2(ax[1], ax[0]) / DEG,
    visible: d[2] > 0.02,
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

// 径向轮廓：N 个采样角度，r(θ) 由回调给出
export function radialOutline(n, rfn, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = rfn(th, i);
    pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  return pts;
}

// 眼睛轮廓：stadium（胶囊）↔ arc（开心弧线）之间按 arc∈[0,1] 混合，20 点
function eyeOutline(hw, hh, arc) {
  const N = 20, pts = [];
  const bend = hw * 1.05 * arc, th = Math.max(hh * (1 - arc * 0.4), hw * 0.55);
  for (let i = 0; i < N; i++) {
    const s = i / N, phi = s * Math.PI * 2;
    // 胶囊点（起点在右尖端，逆时针）
    const cx = hw * Math.cos(phi);
    const cy = (hh - hw) * Math.sign(Math.sin(phi) || 0) + hw * Math.sin(phi);
    // 弧线点（⌒ 形，两抛物线夹出的月牙；顺序与胶囊一致：下缘右→左，上缘左→右）
    let ax, ay;
    if (s < 0.5) { // 下缘，右→左
      ax = hw - 2 * hw * (s / 0.5);
      ay = -bend * (1 - (ax / hw) ** 2);
    } else {       // 上缘，左→右
      ax = -hw + 2 * hw * ((s - 0.5) / 0.5);
      ay = -bend * (1 - (ax / hw) ** 2) - th;
    }
    pts.push([cx * (1 - arc) + ax * arc, cy * (1 - arc) + ay * arc]);
  }
  return pts;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;

// ============================================================
// createMiniBot(container, opts) — 工厂函数
// opts: { size, seed, gaze, state, ink }
// 返回: { el, setState, setSeed, setTimeScale, onFrame, destroy, ... }
// ============================================================
export function createMiniBot(container, opts = {}) {
  const id = ++uid;
  const ink = opts.ink || '#0a0a0c';
  let seed = (opts.seed ?? fnv1a('mini-bot-' + id)) >>> 0;
  const gazeEnabled = opts.gaze !== false;

  // ----- DOM：一次性建结构，之后只写 attribute -----
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'mini-bot');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'mini bot 头像动画');
  const el = (tag, attrs = {}, parent = svg) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  };
  const defs = el('defs');
  const mask = el('mask', { id: `mb-mask-${id}` }, defs);
  el('rect', { x: 0, y: 0, width: 100, height: 100, fill: '#fff' }, mask);
  const eyeL = el('path', { fill: '#000' }, mask);
  const eyeR = el('path', { fill: '#000' }, mask);
  const stage = el('g', { class: 'mb-stage' });
  const backFx = el('g', { class: 'mb-back' }, stage);
  const squashG = el('g', { class: 'mb-squash' }, stage);
  const bodyPath = el('path', {
    class: 'mb-body', fill: ink, mask: `url(#mb-mask-${id})`,
    d: smoothClosedPath(radialOutline(64, () => 38, 50, 50)),
  }, squashG);
  const frontFx = el('g', { class: 'mb-front' }, stage);
  // thinking：两个圆盘；orbit：五个轨道圆盘；alerting：感叹号
  const dots = [0, 1].map(() => el('circle', { r: 4.6, fill: ink, opacity: 0 }, frontFx));
  const orbitDiscs = Array.from({ length: 5 }, () => el('circle', { r: 3.6, fill: ink, opacity: 0 }, backFx));
  const bang = el('g', { opacity: 0 }, frontFx);
  el('rect', { x: -3.6, y: -26, width: 7.2, height: 24, rx: 3.6, fill: ink }, bang);
  el('circle', { cx: 0, cy: 3.4, r: 4, fill: ink }, bang);
  container.appendChild(svg);

  // ----- 属性级 diff 写入器（只写变化的值） -----
  const cache = new WeakMap();
  let diffDebug = false;
  let frameChanged = [];
  const setAttr = (node, name, val) => {
    let m = cache.get(node);
    if (!m) { m = new Map(); cache.set(node, m); }
    if (m.get(name) !== val) {
      m.set(name, val);
      node.setAttribute(name, val);
      if (diffDebug) frameChanged.push(node);
    }
  };

  // ----- 运行时状态 -----
  let state = 'idle';
  let stateT = 0;                 // 进入当前状态的秒数
  let squashPulse = 0;            // 状态切换时的挤压脉冲
  const stateW = { thinking: new Spring(0, 9, 0.85), orbit: new Spring(0, 9, 0.9), alerting: new Spring(0, 8, 0.8) };
  const arcSpring = new Spring(0, 10, 0.9);   // 表情：stadium ↔ arc
  let gx = 0, gy = 0, tx = 0, ty = 0;         // 视线（低通前后）
  let blinkStart = -1;
  let schedule = [], schedIdx = 0;
  let orbitT = 0;
  const resetSchedule = (tNow) => {
    schedule = generateBlinkSchedule(seed, 3600);
    schedIdx = 0;
    while (schedIdx < schedule.length && schedule[schedIdx] <= tNow) schedIdx++;
  };
  resetSchedule(0);

  // 视线跟随：2 倍头像尺寸为满偏半径，归一化 ±1
  const onPointer = (e) => {
    if (!gazeEnabled) return;
    const r = svg.getBoundingClientRect();
    const full = r.width * 2 || 1;
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / full));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / full));
  };
  if (gazeEnabled && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  let frameCb = null;
  let lastBlink = 0, lastYaw = 0, lastPitch = 0;
  let now = 0; // 引擎内部时钟（秒），与 rafLoop 的 t 同步

  function frame(dt, t) {
    now = t;
    stateT += dt;
    frameChanged = [];
    // 14% 一阶低通（惯性"追不上"感）
    gx += (tx - gx) * 0.14;
    gy += (ty - gy) * 0.14;
    // 空闲漂移 + 0.5% 呼吸
    const driftY = 3.0 * Math.sin(t * 0.23) + 1.4 * Math.sin(t * 0.11 + 2.1);
    const driftP = 2.2 * Math.sin(t * 0.17 + 1.3) + 1.1 * Math.sin(t * 0.07);
    const breathe = 1 + 0.005 * Math.sin(t * 1.4);
    const yaw = gx * 14 + driftY;       // 球体 ±14° / ±18°
    const pitch = gy * 18 + driftP;
    lastYaw = yaw; lastPitch = pitch;

    // 眨眼时刻表推进
    let blink = 0;
    if (schedIdx < schedule.length && t >= schedule[schedIdx]) { blinkStart = t; schedIdx++; }
    if (blinkStart >= 0) {
      const p = (t - blinkStart) / 0.26;   // 时长 0.26s，45% 处完全闭合
      if (p >= 1) { blinkStart = -1; }
      else blink = p < 0.45 ? easeInOutQuad(p / 0.45) : 1 - easeInOutQuad((p - 0.45) / 0.55);
    }
    lastBlink = blink;

    // 状态权重弹簧
    for (const k in stateW) { stateW[k].target = state === k ? 1 : 0; stateW[k].step(dt); }
    arcSpring.target = state === 'finished' ? 1 : 0;
    arcSpring.step(dt);
    squashPulse = Math.max(0, squashPulse - dt * 2.4);
    const wT = stateW.thinking.x, wO = stateW.orbit.x, wA = stateW.alerting.x;
    const arc = clamp01(arcSpring.x);
    if (state === 'orbit') orbitT += dt;

    // 身体：thinking 缩小让位 + 呼吸 + 挤压脉冲
    const shrink = 1 - 0.18 * clamp01(wT);
    const sq = easeOutCubic(clamp01(squashPulse));
    const sx = (1 + 0.05 * sq) * shrink * breathe;
    const sy = (1 - 0.07 * sq) * shrink * breathe;
    setAttr(squashG, 'transform', `translate(50 50) scale(${f(sx)} ${f(sy)}) translate(-50 -50)`);
    setAttr(stage, 'transform', `translate(${f(gx * 2)} ${f(gy * 1.5)})`);

    // 眼睛：球面投影 → mask 挖洞
    for (const [node, baseYaw] of [[eyeL, -24], [eyeR, 24]]) {
      const e = projectEye(yaw, pitch, baseYaw, 7);
      if (!e.visible) { setAttr(node, 'opacity', '0'); continue; }
      setAttr(node, 'opacity', '1');
      const cx = 50 + e.x * 38, cy = 50 - e.y * 38;
      const hw = 5.2 * e.widthScale;                 // 宽度随深度压缩
      const hh = Math.max(7.6 * (1 - blink), 5.2 * e.widthScale * 1.15); // 眨眼压扁
      const d = smoothClosedPath(eyeOutline(hw, hh, arc));
      setAttr(node, 'd', d);
      setAttr(node, 'transform', `translate(${f(cx)} ${f(cy)}) rotate(${f(e.rot)})`);
    }

    // thinking：双点从身体两侧浮出（错相 0.12s，easeOutCubic 进）
    dots.forEach((dot, i) => {
      const p = clamp01((stateT - i * 0.12) / 0.45);
      const vis = easeOutCubic(p) * clamp01(wT * 1.4);
      if (vis <= 0.005) { setAttr(dot, 'opacity', '0'); return; }
      const side = i === 0 ? -1 : 1;
      const out = easeOutBack(clamp01(p));
      const px = 50 + side * (26 + 14 * out);
      const py = 46 - 10 * out + Math.sin(t * 2.2 + i * Math.PI) * 1.6;
      setAttr(dot, 'cx', f(px)); setAttr(dot, 'cy', f(py));
      setAttr(dot, 'opacity', f(vis));
    });

    // orbit：五球椭圆轨道（0.0017 rad/ms），近大远小，背面移到下层
    orbitDiscs.forEach((disc, i) => {
      if (wO <= 0.01) { setAttr(disc, 'opacity', '0'); return; }
      const a = orbitT * 1.7 + (i * Math.PI * 2) / 5;
      const depth = 0.5 + 0.5 * Math.cos(a);
      const px = 50 + Math.sin(a) * 46, py = 50 - 8 + Math.cos(a) * 15;
      setAttr(disc, 'cx', f(px)); setAttr(disc, 'cy', f(py));
      setAttr(disc, 'r', f(3.6 * (0.55 + 0.45 * depth)));
      setAttr(disc, 'opacity', f((0.25 + 0.75 * depth) * clamp01(wO)));
      const wantBack = depth < 0.45;
      if (wantBack && disc.parentNode !== backFx) backFx.appendChild(disc);
      if (!wantBack && disc.parentNode !== frontFx) frontFx.appendChild(disc);
    });

    // alerting：感叹号升起 + 阻尼抖动 sin(n·42)·2.2·exp(-(n mod 2.2)·5.5)
    if (wA <= 0.01) { setAttr(bang, 'opacity', '0'); }
    else {
      const n = stateT;
      const rise = easeOutBack(clamp01(n / 0.5));
      const jitter = Math.sin(n * 42) * 2.2 * Math.exp(-(n % 2.2) * 5.5);
      setAttr(bang, 'transform', `translate(50 ${f(96 - 52 * rise + jitter)})`);
      setAttr(bang, 'opacity', f(clamp01(wA)));
    }

    if (frameCb) {
      frameCb({
        t, yaw, pitch, blink, state,
        bodyD: bodyPath.getAttribute('d'),
        eyeL: { d: eyeL.getAttribute('d'), transform: eyeL.getAttribute('transform') },
        eyeR: { transform: eyeR.getAttribute('transform') },
        squash: squashG.getAttribute('transform'),
        changed: frameChanged,
      });
    }
  }

  const loop = rafLoop(svg, frame);

  return {
    el: svg,
    get state() { return state; },
    get seed() { return seed; },
    setState(next) {
      if (next === state) return;
      state = next; stateT = 0; squashPulse = 1;
      if (state !== 'orbit') orbitT = 0;
    },
    setSeed(s) { seed = (typeof s === 'string' ? fnv1a(s) : s) >>> 0; resetSchedule(now); },
    setTimeScale(v) { loop.setTimeScale(v); },
    setDiffDebug(on) { diffDebug = on; },
    onFrame(cb) { frameCb = cb; },
    blinkSchedule: (dur) => generateBlinkSchedule(seed, dur),
    gazeInfo: () => ({ yaw: lastYaw, pitch: lastPitch, blink: lastBlink }),
    destroy() { loop.destroy(); window.removeEventListener('pointermove', onPointer); svg.remove(); },
  };
}
