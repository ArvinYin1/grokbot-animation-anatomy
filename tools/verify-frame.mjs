#!/usr/bin/env node
// verify-frame.mjs — 最小可运行验证：
// 只用 grok-recipes.json + 文档化的播放语义（本文件即语义的可执行参考实现），
// 计算 idle 状态 t=1.0s 的完整中间帧；若 bundle 存在，再 eval 原引擎同条件对比。
//
// 用法: node verify-frame.mjs [recipesJson] [bundlePath]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = process.argv[2] ?? path.resolve(HERE, "../js/vendor/grok-recipes.json");
const BUNDLE = process.argv[3] ??
  path.resolve(HERE, "../../grokbot-src/dist/renderer/assets/index.eager-platform-DUN5VkaE.js");

const R = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const C = R.constants;
const CLIPS = new Map(R.clips.map(c => [c.name, c]));

// ============ 语义实现（与文档章节一一对应） ============

// §随机数 tc（mulberry32 变体）
function tc(e) {
  let t = e | 0;
  return () => {
    t = t + 1831565813 | 0;
    let n = Math.imul(t ^ t >>> 15, t | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
// §洗牌 Lx：Fisher–Yates + 首元素避让 prev
function hl(e, t, n) { const r = e[t], o = e[n]; e[t] = o, e[n] = r; }
function Lx(e, t, n) {
  const r = [...e];
  for (let s = r.length - 1; s > 0; s -= 1) hl(r, s, Math.floor(t() * (s + 1)));
  const o = r.findIndex(s => s !== n);
  return o > 0 && hl(r, 0, o), r;
}

// §贝塞尔 Qa：牛顿迭代解 x(t)，再取 y
const el = (e, t, n) => { const r = 1 - e; return 3 * r * r * e * t + 3 * r * e * e * n + e * e * e; };
const sb = (e, t, n) => { const r = 1 - e; return 3 * r * r * t + 6 * r * e * (n - t) + 3 * e * e * (1 - n); };
function Qa(e, t) {
  const [n, r, o, s] = t; let i = e;
  for (let a = 0; a < 8; a++) {
    const c = el(i, n, o) - e, u = sb(i, n, o);
    if (Math.abs(c) < 1e-6 || Math.abs(u) < 1e-6) break;
    i = Math.min(1, Math.max(0, i - c / u));
  }
  return el(i, r, s);
}
const Jo = e => { const t = Math.min(1, Math.max(0, e)); return t * t * (3 - 2 * t); };
const le = (e, t, n) => Math.min(n, Math.max(t, e));
const nr = C.ease.nr, tb = C.ease.tb, dx = C.ease.dx;
const na = C.durations.blink, nb = C.durations.morph, ta = C.durations.lidMorph;

// §track 求值 vt：首尾钳制；段内 (t-o.t)/(s.t-o.t) → Qa(o.ease) → 逐分量 lerp
function vt(e, t) {
  if (e.length === 0) return null;
  if (t <= e[0].t) return e[0].v;
  const n = e[e.length - 1];
  if (t >= n.t) return n.v;
  let r = 0;
  for (; r < e.length - 2 && e[r + 1].t <= t;) r++;
  const o = e[r], s = e[r + 1], i = (t - o.t) / Math.max(s.t - o.t, 1e-9), a = Qa(i, o.ease);
  return o.v.map((c, u) => c + (s.v[u] - c) * a);
}
// §expression 事件：t 时刻生效名 = 最后一个 t<=t 的事件（无则 neutral）
function dl(e, t) { let n = "neutral"; for (const r of e) { if (r.t > t + 1e-9) break; n = r.name; } return n; }

// §clip 规范化 kx：track 别名、blink→lids 关键帧 gx、表情名别名 wb、isThroughBlink=cut===false
const wb = new Map(Object.entries(R.expressionAliases));
const gbSet = new Set(R.expressionNames);
const Mb = e => { const t = e.trim().toLowerCase(), n = wb.get(t) ?? t; return gbSet.has(n) ? n : "neutral"; };
const gx = e => [{ t: e, v: [0], ease: nr }, { t: e + na * .45, v: [1], ease: nr }, { t: e + na, v: [0], ease: nr }];
function kx(e) {
  const t = new Map;
  for (const [i, a] of Object.entries(e.tracks)) {
    const c = R.aliases.tracks[i];
    c !== void 0 && t.set(c, a);
  }
  const mx = ({ t: e2, v: t2, ease: n }) => ({ t: e2, v: typeof t2 == "string" ? [] : t2, ease: n?.length === 4 ? n : nr });
  const n = i => (t.get(i) ?? []).map(mx);
  const r = n("lids"), o = [];
  for (const i of t.get("expression") ?? []) {
    if (i.v === "blink") { r.push(...gx(i.t)); continue; }
    o.push({ t: i.t, name: typeof i.v == "string" ? Mb(i.v) : "neutral", isThroughBlink: i.cut === !1 });
  }
  r.sort((i, a) => i.t - a.t);
  return {
    duration: e.duration, body: e.body ?? "sphere", squashAnchor: e.squashAnchor ?? 0,
    restTime: e.workArea ? e.workArea.start : 0,
    inspect: { bias: Number.isFinite(e.inspect?.bias) ? le(e.inspect.bias, -1, 1) : void 0, isFollowingTurn: e.inspect?.follow },
    position: n("position"), rotation: n("rotation"), squash: n("squash"), zoom: n("zoom"), lids: r, expression: o,
  };
}
// §rest 帧 ul：在 restTime 处采样各 track；expr 默认取首个事件名
function ul(e) {
  const t = e.restTime, n = vt(e.rotation, t), r = vt(e.position, t), o = vt(e.squash, t), s = vt(e.zoom, t), i = vt(e.lids, t);
  let a = "neutral", c = !1;
  for (const u of e.expression) c || (a = u.name, c = !0), u.t <= t + 1e-9 && (a = u.name);
  return {
    rot: n ? [n[0], n[1], n[2]] : [0, 0, 0], pos: r ? [r[0], r[1]] : [0, 0],
    scl: o ? [o[0], o[1]] : [1, 1], zoom: s ? s[0] : C.runtime.zoomDefault,
    lids: i ? le(i[0], 0, 1) : 0, expr: a, squashAnchor: e.squashAnchor,
  };
}
// §bridge bx：当前快照 → 目标 rest 帧，.35s，ease dx=[.4,0,.2,1]；角度取最近等价角 ai
const ai = (e, t) => e + 360 * Math.round((t - e) / 360);
const ci = (e, t) => Math.abs(((e - t) % 360 + 540) % 360 - 180);
const WT = C.bridge.tolerance;
function wx(e, t) {
  return ci(e.rot[0], t.rot[0]) < WT.rotDeg && ci(e.rot[1], t.rot[1]) < WT.rotDeg && ci(e.rot[2], t.rot[2]) < WT.rotDeg
    && Math.abs(e.pos[0] - t.pos[0]) < WT.pos && Math.abs(e.pos[1] - t.pos[1]) < WT.pos
    && Math.abs(e.scl[0] - t.scl[0]) < WT.scl && Math.abs(e.scl[1] - t.scl[1]) < WT.scl
    && Math.abs(e.zoom - t.zoom) < WT.zoom && Math.abs(e.lids - t.lids) < WT.lids;
}
function bx(e, t) {
  const n = (o, s) => [{ t: 0, v: o, ease: dx }, { t: ta, v: s, ease: nr }];
  const r = [ai(t.rot[0], e.rot[0]), ai(t.rot[1], e.rot[1]), ai(t.rot[2], e.rot[2])];
  return {
    duration: ta, body: null, squashAnchor: e.squashAnchor, restTime: 0, inspect: {},
    position: n(e.pos, t.pos), rotation: n(e.rot, r), squash: n(e.scl, t.scl),
    zoom: n([e.zoom], [t.zoom]), lids: e.lids === 0 && t.lids === 0 ? [] : n([e.lids], [t.lids]), expression: [],
  };
}

// §四元数：lb(e,t,n)=Qz(n)·Qy(t)·Qx(e)（弧度），ra=哈密顿积，Po=轴角
function ra(e, t) {
  return [e[0] * t[0] - e[1] * t[1] - e[2] * t[2] - e[3] * t[3],
  e[0] * t[1] + e[1] * t[0] + e[2] * t[3] - e[3] * t[2],
  e[0] * t[2] - e[1] * t[3] + e[2] * t[0] + e[3] * t[1],
  e[0] * t[3] + e[1] * t[2] - e[2] * t[1] + e[3] * t[0]];
}
const Po = (e, t) => { const n = Math.sin(t / 2); return [Math.cos(t / 2), e[0] * n, e[1] * n, e[2] * n]; };
const lb = (e, t, n) => ra(Po([0, 0, 1], n), ra(Po([0, 1, 0], t), Po([1, 0, 0], e)));
const vn = Math.PI / 180;

// §眼睛：lid 挤压 rl（Nb/oa/ec/xb/Gf 的移植；数据全部来自 JSON 的 bn 描述符）
const bbSet = new Set(R.blinkBlockingExpressions);
const jt = e => e.oval[0] > 1e-4 && e.oval[1] > 1e-4;
const Tb = name => !bbSet.has(name) && !R.expressions[name].some(jt);
function xb({ p0: e, p1: t, p2: n, isArc: r }) {
  const [o, s] = e, [i, a] = t, [c, u] = n, l = new Array(R.eyes.pathSegments).fill(0);
  const d = (y, w) => { l[y * 6] = w[0], l[y * 6 + 1] = w[1]; },
    f = (y, w) => { l[y * 6 + 2] = w[0] - l[y * 6], l[y * 6 + 3] = w[1] - l[y * 6 + 1]; },
    h = (y, w) => { l[y * 6 + 4] = w[0] - l[y * 6], l[y * 6 + 5] = w[1] - l[y * 6 + 1]; };
  if (r) {
    const y = 2 * (o * (a - u) + i * (u - s) + c * (s - a));
    if (Math.abs(y) > 1e-9) {
      const S = o * o + s * s, b = i * i + a * a, v = c * c + u * u,
        T = (S * (a - u) + b * (u - s) + v * (s - a)) / y, A = (S * (c - i) + b * (o - c) + v * (i - o)) / y,
        F = Math.hypot(o - T, s - A), N = Math.atan2(s - A, o - T), R2 = Math.atan2(u - A, c - T),
        B2 = Math.atan2(a - A, i - T), E = Math.PI * 2, I = (R2 - N + E) % E,
        O = (B2 - N + E) % E <= I ? I : I - E, H = K => [T + F * Math.cos(K), A + F * Math.sin(K)],
        L = K => [-Math.sin(K), Math.cos(K)], j = O / 2, J = 4 / 3 * Math.tan(j / 4) * F, fe = [N, N + j, N + O];
      for (let K = 0; K < 3; K++) {
        const te = H(fe[K]), Z = L(fe[K]);
        d(K, te), K > 0 && f(K, [te[0] - J * Z[0], te[1] - J * Z[1]]), K < 2 && h(K, [te[0] + J * Z[0], te[1] + J * Z[1]]);
      }
      return l;
    }
    const w = [(o + c) / 2, (s + u) / 2];
    return d(0, [o, s]), d(1, w), d(2, [c, u]), h(0, [o + (w[0] - o) / 3, s + (w[1] - s) / 3]),
      f(1, [w[0] - (w[0] - o) / 3, w[1] - (w[1] - s) / 3]), h(1, [w[0] + (c - w[0]) / 3, w[1] + (u - w[1]) / 3]),
      f(2, [c - (c - w[0]) / 3, u - (u - w[1]) / 3]), l;
  }
  const p = [(o + i) / 2, (s + a) / 2], g = [(i + c) / 2, (a + u) / 2], m = [(p[0] + g[0]) / 2, (p[1] + g[1]) / 2];
  return d(0, [o, s]), d(1, m), d(2, [c, u]), h(0, [o + 2 / 3 * (p[0] - o), s + 2 / 3 * (p[1] - o)]),
    f(1, [m[0] - 2 / 3 * (p[0] - m[0]), m[1] - 2 / 3 * (p[1] - m[1])]),
    h(1, [m[0] + 2 / 3 * (g[0] - m[0]), m[1] + 2 / 3 * (g[1] - m[1])]),
    f(2, [c + 2 / 3 * (g[0] - c), u + 2 / 3 * (g[1] - u)]), l;
}
function Gf(e) {
  const t = R.eyes.spineSamples + 1 >> 1, n = [], uo2 = (e2, t2) => [e2[t2 * 6], e2[t2 * 6 + 1]],
    lo2 = (e2, t2, n2) => { const r = n2 ? 4 : 2; return [e2[t2 * 6] + e2[t2 * 6 + r], e2[t2 * 6 + 1] + e2[t2 * 6 + r + 1]]; },
    r = (o, s, i, a, c) => {
      for (let u = c; u < t; u++) {
        const l = u / (t - 1), d = 1 - l, f = d * d * d, h = 3 * d * d * l, p = 3 * d * l * l, g = l * l * l;
        n.push([f * o[0] + h * s[0] + p * i[0] + g * a[0], f * o[1] + h * s[1] + p * i[1] + g * a[1]]);
      }
    };
  return r(uo2(e, 0), lo2(e, 0, !0), lo2(e, 1, !1), uo2(e, 1), 0), r(uo2(e, 1), lo2(e, 1, !0), lo2(e, 2, !1), uo2(e, 2), 1), n;
}
const Pr = (e, t, n, r, o) => ({ off: e, tilt: t, wid: n, lidY: 1, oval: o, ovalMix: 0, pts: Gf(xb(r)), path: xb(r), fillRing: null });
function ec(e, t, n, r, o) {
  const s = Math.max(0, (t - e) / 2), i = n * Math.PI / 180, a = Math.sin(i) * s, c = Math.cos(i) * s;
  return Pr(r, o, e / 2, { p0: [-a, -c], p1: [0, 0], p2: [a, c], isArc: !1 }, [0, 0]);
}
const oa = (e, t, n, r) => ec(Math.max(e, 1e-4), Math.max(t, e), 0, r, n);
const Nb = (e, t, n, r) => t >= e ? oa(e, t, 0, [n, r]) : oa(t, e, Math.PI / 2, [n, r]);
function Ob(e) {
  const t = jt(e);
  if (!(e.wid > 0) && !t) return null;
  const n = e.lidY, r = e.tilt * (180 / Math.PI);
  if (t) return { width: 2 * e.oval[0], height: 2 * e.oval[1] * n, tilt: r, cx: e.off[0], cy: e.off[1] };
  if (e.pts.length < 2) return null;
  const o = e.pts[0], s = e.pts[e.pts.length - 1], i = s[0] - o[0], a = s[1] - o[1], c = Math.hypot(i, a), u = 2 * e.wid;
  return { width: u, height: (c + u) * n, tilt: Math.atan2(i, a) * (180 / Math.PI) + r, cx: e.off[0] + (o[0] + s[0]) / 2, cy: e.off[1] + (o[1] + s[1]) / 2 * n };
}
function Lb(e) {
  const t = Ob(e);
  if (t == null) return { w: R.eyes.defaultWidth, h: .57, cx: e.off[0], cy: e.off[1] };
  const n = t.tilt * Math.PI / 180, r = Math.abs(Math.cos(n)), o = Math.abs(Math.sin(n));
  return { w: t.width * r + t.height * o, h: t.width * o + t.height * r, cx: t.cx, cy: t.cy };
}
// rl：lid 量 t∈[0,1] 把眼睛换成高 = h+(0.42w−h)·t 的 stadium（宽≥高，必要时转 90°）
function rl(e, t) {
  if (t <= 0) return e;
  const n = Math.min(1, t), r = Lb(e), o = Math.max(r.w, 1e-4), s = Math.max(r.h, o), i = o * C.eyes.Ab;
  return Nb(o, s + (i - s) * n, r.cx, r.cy);
}

// §Bb-lite：表情状态机（名字/过渡进度；本验证窗口内无过渡时即为稳态）
function ii(e, dur) {
  const t = Math.min(.28, (e ? C.durations.blinkHold : C.durations.blinkClose) / Math.max(dur, .05));
  return { u1: (1 - t) * .42, u2: (1 - t) * .42 + t };
}
const il = (t, dur) => Qa(le(t / dur, 0, 1), tb);
const sl = name => name === "inspecting" ? 1 : 0;
class FaceLite {
  constructor() { this.name = "neutral"; this.trans = null; this.held = false; }
  play(name, isThroughBlink) {
    if (name === this.name && (!this.trans || this.trans.toName === name)) return;
    const kind = isThroughBlink && !bbSet.has(name) && !bbSet.has(this.name) ? "lidMorph" : "morph";
    this.trans = { from: this.currentName(), toName: name, kind, t: 0, dur: kind === "morph" ? nb : ta };
    this.name = name;
  }
  currentName() { return this.trans ? this.trans.toName : this.name; }
  get isMorphing() { return this.trans != null && !this.held; }
  step(dt) {
    if (!this.trans || this.held) return;
    this.trans.t += dt;
    if (this.trans.t >= this.trans.dur) this.trans = null;
  }
  seek(events, h) {
    this.name = "neutral"; this.trans = null;
    let p = 0;
    for (const m of events) {
      if (m.t > h + 1e-9) break;
      if (this.trans) { this.trans.t += m.t - p; if (this.trans.t >= this.trans.dur) this.trans = null; }
      this.play(m.name, m.isThroughBlink); p = m.t;
    }
    if (this.trans) { this.trans.t += h - p; if (this.trans.t >= this.trans.dur) this.trans = null; }
    this.held = true;
  }
  release() { this.held = false; }
  inspectWeight() {
    if (!this.trans) return sl(this.name);
    const { t, dur, kind } = this.trans, f = sl(this.trans.from), h = sl(this.trans.toName);
    if (kind === "morph") return f + (h - f) * il(t, dur);
    const p = le(t / dur, 0, 1), { u1, u2 } = ii(false, dur);
    return p <= u1 ? f : p < u2 ? 0 : h;
  }
}

// §Yf-lite：clip 播放/循环/bridge 合成 + frame() 中间帧
const $n = C.runtime.zoomDefault;
class RuntimeLite {
  constructor(zoomMul = 1) {
    this.zoomMul = le(zoomMul || 1, .2, 3);
    this.face = new FaceLite();
    this.u = [...R.eyes.baseEulerDeg]; // Kf
    this.l = [0, 0]; this.d = [1, 1]; this.f = 0; this.h = $n * this.zoomMul;
    this.y = { duration: C.runtime.restClipDuration, body: null, squashAnchor: 0, restTime: 0, inspect: {}, position: [], rotation: [{ t: 0, v: [...R.eyes.baseEulerDeg], ease: nr }], squash: [], zoom: [], lids: [], expression: [] };
    this.w = 0; this.S = !1; this.b = !0; this.T = null; this.A = null; this.R = 0;
    this.B = null; this.E = null; this.I = !1; this.N = 0;
    this.morphAmount = 0; // cx 覆盖层权重（idle 全程 0；保留接口）
  }
  get loopCount() { return this.R; }
  O() {
    const $ = vt(this.y.position, this.w); this.l = $ ? [$[0], $[1]] : [0, 0];
    const q = vt(this.y.rotation, this.w); this.u = q ? [q[0], q[1], q[2]] : [0, 0, 0];
    const U = vt(this.y.squash, this.w); this.d = U ? [U[0], U[1]] : [1, 1];
    const P = vt(this.y.zoom, this.w); P && (this.h = le(P[0], .25, 2.5) * this.zoomMul);
  }
  J() { const $ = vt(this.y.lids, this.w); return $ ? le($[0], 0, 1) : 0; }
  fe() { return this.I ? 0 : this.J(); }
  K() { !Tb(this.face.name) || this.face.isMorphing ? this.I = !0 : this.I && this.J() === 0 && (this.I = !1); }
  H($) { if ((this.fe()) > 0) { this.E = $; return; } $(), this.K(); }
  // B（持脸）非空时 clip 的 expression 事件完全不触发
  L(q, U) { if (this.B != null) return; for (const $ of this.y.expression) $.t <= q || $.t > U || this.H(() => this.face.play($.name, $.isThroughBlink)); }
  j($) {
    this.w = $; this.O();
    this.face.seek(this.y.expression, $);
    // 持脸（holdFace）优先：clip 内表情重放后，再叠加一个 t=0 的持脸事件
    this.B != null && this.face.seek([{ t: 0, name: this.B, isThroughBlink: !1 }], 0);
  }
  Z($) { this.S = !1; this.y = $; this.w = 0; this.f = $.squashAnchor; }
  D($) {
    if (this.A = null, this.Z($.clip), this.T = { clip: $.clip, name: $.name }, this.b = !0, !$.isPlaying) { this.j(0); return; }
    this.S = !0; $.phase > 0 && this.j($.phase * $.clip.duration);
    this.face.release(); $.phase <= 0 && this.L(-1e-9, 0);
  }
  G($) { const q = this.te(), U = ul($.clip); this.A = $; this.Z(bx(q, U)); this.b = !1; this.S = !0; this.B == null && q.expr !== U.expr && this.H(() => this.face.play(U.expr, false)); }
  te() { return { rot: this.u, pos: this.l, scl: this.d, zoom: this.h / this.zoomMul, lids: this.fe(), expr: this.face.name, squashAnchor: this.f }; }
  Y() {
    const teN = this.te(), ulN = this.T ? ul(this.T.clip) : null;
    const decision = this.A != null || this.T == null || wx(teN, ulN);
    if (process.env.TRACE) console.error(`  Y() A=${!!this.A} T=${this.T?.name} wx=${teN && ulN ? wx(teN, ulN) : "-"} rot=${teN.rot.map(v => v.toFixed(1))} rest=${ulN ? ulN.rot.map(v => v.toFixed(1)) : "-"} -> ${decision ? "no-bridge" : "BRIDGE"}`);
    return decision ? !1 : (this.G({ ...this.T, isPlaying: !0, phase: 0, isRest: !1 }), !0);
  }
  Q($) {
    const q = this.w; let U = q + $;
    if (U >= this.y.duration) {
      if (this.L(q, this.y.duration), this.b) {
        if (this.R += 1, this.Y()) return;
        U = U - this.y.duration, U >= this.y.duration && (U = 0), this.L(-1e-9, U), this.w = U;
      } else this.w = this.y.duration, this.S = !1, this.A != null && this.D(this.A);
    } else this.L(q, U), this.w = U;
    this.O();
  }
  load($, { isPlaying: q = !0, transition: U = "bridge", phase: P = 0 } = {}) {
    const Cn = $.name || this.T?.name || "recipe",
      z = { clip: kx($), name: Cn, isPlaying: q, phase: le(P, 0, 1) % 1, isRest: !1 };
    U === "bridge" && this.T != null && (this.A != null || this.T.name !== Cn) ? this.G(z) : this.D(z);
  }
  holdFace($) {
    if ($ === this.B) return;
    this.B = $;
    this.H(() => {
      const q = this.B ?? (this.A == null ? dl(this.y.expression, this.w) : dl(this.A.clip.expression, 0));
      q !== this.face.name && this.face.play(q, false);
    });
  }
  advance($) {
    const q = Math.min($, C.runtime.maxAdvance), U = 1 - this.morphAmount;
    this.S && this.Q(q * U);
    this.face.step(q);
    if (this.E != null && this.fe() === 0) { const Cn = this.E; this.E = null; Cn(); }
    this.K(); this.N += $;
  }
  frame() {
    const P = this.u, Cn = this.l, z = this.d;
    return {
      body: "sphere", quat: lb(P[0] * vn, P[1] * vn, P[2] * vn), zoom: this.h,
      offset: [Cn[0], Cn[1]], squash: [z[0], z[1]], squashAnchor: this.f,
      lids: this.fe(), expr: this.face.name,
      morph: this.face.trans ? { ...this.face.trans, progress: il(this.face.trans.t, this.face.trans.dur) } : null,
      inspectWeight: this.face.inspectWeight(),
      eyes: R.expressions[this.face.name].map(e => rl(e, this.fe())),
    };
  }
}

// §Nx-lite：状态机（clips 种子洗牌袋、随机相位首帧、next/holdSeconds）
class StateLite {
  constructor(rt, state, { seed = 1, firstPhase } = {}) {
    this.rt = rt; this.r = tc(seed); this.bags = new Map;
    this.firstPhase = firstPhase; this.c = !1; this.u = null; this.l = null;
    this.d = 0; this.f = 0; this.h = 0; this.p = null;
    this.b(state);
  }
  g() { return this.l.clips; } // idle 无 compact 需求
  m() { return this.l.next != null && this.l.holdSeconds == null; }
  y() {
    const v = this.g(), T = this.bags.get(v) ?? [];
    return T.length === 0 && T.push(...Lx(v, this.r, this.p)), this.bags.set(v, T), T.shift();
  }
  w() {
    const v = this.m() ? this.g()[this.f] : this.y();
    if (this.h = this.rt.loopCount, v === void 0 || v === this.p) return;
    const T = this.c || this.m(), clip = CLIPS.get(v);
    if (!clip) throw new Error(`No motion recipe named ${v}`);
    this.rt.load(clip, { phase: T ? 0 : this.firstPhase ?? this.r() });
    this.c = !0; this.p = v; this.h = this.rt.loopCount;
  }
  b(v) {
    this.u = v; this.l = R.states[v]; this.d = 0; this.f = 0;
    this.rt.holdFace(this.l.face ?? null); this.w();
  }
  advance(v) {
    this.d += v;
    const T = this.l.next;
    if (T != null && this.l.holdSeconds != null && this.d >= this.l.holdSeconds) { this.b(T); return; }
    if (this.rt.loopCount !== this.h) {
      if (T != null && this.l.holdSeconds == null && (this.f += 1, this.f >= this.g().length)) { this.b(T); return; }
      this.w();
    }
  }
}

// ============ 运行：idle, seed=1, 60 × 1/60s ============
const SEED = Number(process.env.T_SEED ?? 1), STEPS = Number(process.env.T_STEPS ?? 60), DT = 1 / 60;
const rt = new RuntimeLite();
const nx = new StateLite(rt, process.env.T_STATE ?? "idle", { seed: SEED });
const log = { firstClip: nx.p, clipTimeAfterLoad: rt.w };
for (let i = 0; i < STEPS; i++) {
  nx.advance(DT); rt.advance(DT);
  if (process.env.TRACE && i % 30 === 0)
    console.error(`trace i=${i} clip=${nx.p} w=${rt.w.toFixed(3)} face=${rt.face.name} B=${rt.B} trans=${JSON.stringify(rt.face.trans)} I=${rt.I} loop=${rt.loopCount}`);
}
const frame = rt.frame();
const round = (x, k = 6) => Math.round(x * 10 ** k) / 10 ** k;
const summ = {
  state: nx.u, firstClip: log.firstClip, clipNow: nx.p,
  clipTime: round(rt.w), loopCount: rt.loopCount,
  quat: frame.quat.map(v => round(v)),
  eulerDeg: rt.u.map(v => round(v, 4)),
  offset: frame.offset.map(v => round(v)), squash: frame.squash.map(v => round(v)),
  zoom: round(frame.zoom), squashAnchor: frame.squashAnchor,
  lids: round(frame.lids), expr: frame.expr, morph: frame.morph,
  inspectWeight: round(frame.inspectWeight),
  eyes: frame.eyes.map(e => ({ off: e.off.map(v => round(v, 4)), tilt: round(e.tilt, 4), wid: round(e.wid, 4), lidY: round(e.lidY, 4), oval: e.oval, pts: e.pts.length })),
};
console.log("== 移植实现（仅 JSON + 文档语义） idle @ t=1.0s, seed=1 ==");
console.log(JSON.stringify(summ, null, 1));

// ============ 交叉验证：eval 原引擎同条件跑 ============
if (fs.existsSync(BUNDLE)) {
  const src = fs.readFileSync(BUNDLE, "utf8");
  const bracket = i => {
    const open = src[i], close = open === "{" ? "}" : open === "[" ? "]" : null;
    let d = 0;
    for (let j = i;; j++) { const c = src[j]; if (c === "{" || c === "[") d++; else if (c === "}" || c === "]") { d--; if (d === 0) return j; } }
  };
  const a0 = src.indexOf("const To=e=>");
  const a1 = src.indexOf("function Yf");
  // Yf 结束于 "const Ps=" 之前
  const a2 = src.indexOf("const Ps=", a1);
  const ix0 = src.indexOf("=", src.indexOf("const Ix=")) + 1;
  const slice1 = src.slice(a0, a2);
  const sliceIx = src.slice(ix0, bracket(ix0) + 1);
  const f0 = src.indexOf("const Cx=");
  const jx0 = src.indexOf("=", src.indexOf("jx={")) + 1;
  const slice2 = src.slice(f0, bracket(jx0) + 1);
  const real = new Function(`${slice1}\nconst Ix=${sliceIx};\n${slice2}\n;return {Yf, Nx};`)();
  const rrt = real.Yf({});
  const rnx = real.Nx(rrt, process.env.T_STATE ?? "idle", { seed: SEED });
  for (let i = 0; i < STEPS; i++) { rnx.advance(DT); rrt.advance(DT); }
  const rf = rrt.frame();
  const rsumm = {
    clipNow: rnx.clip, clipTime: round(rrt.time), loopCount: rrt.loopCount,
    quat: rf.quat.map(v => round(v)), offset: rf.offset.map(v => round(v)),
    squash: rf.squash.map(v => round(v)), zoom: round(rf.zoom),
    squashAnchor: rf.squashAnchor, expr: rrt.face, inspectWeight: round(rf.inspectWeight),
    eyeRings: rf.eyes ? rf.eyes.length : null, morph: rf.morph,
  };
  console.log("== 原引擎（bundle eval）同条件 ==");
  console.log(JSON.stringify(rsumm, null, 1));
  const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
  const checks = [
    ["clip", summ.clipNow === rsumm.clipNow],
    ["clipTime", close(summ.clipTime, rsumm.clipTime)],
    ["loopCount", summ.loopCount === rsumm.loopCount],
    ["quat", summ.quat.every((v, i) => close(v, rsumm.quat[i]))],
    ["offset", summ.offset.every((v, i) => close(v, rsumm.offset[i]))],
    ["squash", summ.squash.every((v, i) => close(v, rsumm.squash[i]))],
    ["zoom", close(summ.zoom, rsumm.zoom)],
    ["squashAnchor", summ.squashAnchor === rsumm.squashAnchor],
    ["expr", summ.expr === rsumm.expr],
    ["inspectWeight", close(summ.inspectWeight, rsumm.inspectWeight)],
  ];
  console.log("== 对比 ==");
  let ok = true;
  for (const [k, v] of checks) { console.log(`${v ? "PASS" : "FAIL"}  ${k}`); ok &&= v; }
  process.exit(ok ? 0 : 1);
} else {
  console.log("（未找到 bundle，跳过原引擎交叉验证）");
}
