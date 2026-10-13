#!/usr/bin/env node
// extract-recipes.mjs — 从 Grok Bot (Electron) 前端 bundle 中提取头像动画引擎的
// 全部动画数据为纯 JSON。
//
// 方法：按源码锚点定位各数据字面量/纯函数代码段，括号匹配截取，
// 对纯数据段直接 eval（段内只含字面量与纯数学函数，无 DOM/外部引用），
// 因此提取结果与原代码语义完全一致（字段名保持混淆原样）。
//
// 用法: node extract-recipes.mjs [bundlePath] [outPath]
//   默认 bundle: ../../../grokbot-src/dist/renderer/assets/index.eager-platform-DUN5VkaE.js
//   默认输出:   ../js/vendor/grok-recipes.json

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = process.argv[2] ??
  path.resolve(HERE, "../../grokbot-src/dist/renderer/assets/index.eager-platform-DUN5VkaE.js");
const OUT = process.argv[3] ??
  path.resolve(HERE, "../js/vendor/grok-recipes.json");

const src = fs.readFileSync(BUNDLE, "utf8");
const sha256 = crypto.createHash("sha256").update(src).digest("hex");

// ---------- helpers ----------
function bracketMatch(openIdx) {
  const open = src[openIdx];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) throw new Error(`not a bracket at ${openIdx}: ${open}`);
  let d = 0;
  for (let i = openIdx;; i++) {
    const c = src[i];
    if (c === "{" || c === "[") d++;
    else if (c === "}" || c === "]") { d--; if (d === 0) return i; }
  }
}
// 从 anchor 字符串处取其后的 "= <literal>" 字面量文本
function literalAfter(anchor) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`anchor not found: ${anchor}`);
  let j = src.indexOf("=", i) + 1;
  while (src[j] === " ") j++;
  return src.slice(j, bracketMatch(j) + 1);
}
function evalCode(code, names, prelude = "") {
  const body = `${prelude}\n${code}\n;return {${names.join(",")}};`;
  // eslint-disable-next-line no-new-func
  return new Function(body)();
}

// ---------- slice A: 弹簧/缓动/贝塞尔/四元数/眼睛几何/表情库 bn ----------
// 从 "const To=e=>" 到 bn 字面量结束，全为纯函数与常量。
const aStart = src.indexOf("const To=e=>");
if (aStart < 0) throw new Error("slice A start not found");
const bnOpen = src.indexOf("=", src.indexOf("const bn=")) + 1;
const aEnd = bracketMatch(bnOpen) + 1;
const sliceA = src.slice(aStart, aEnd);
const A = evalCode(sliceA, [
  // 弹簧与步进
  "To", "Eo", "Jw", "Bf",
  // 缓动
  "Qo", "Ye", "Es", "eb", "nr", "tb", "Qa", "Jo", "ii", "ib", "ab",
  // 时长常量（blink/morph/lidMorph）
  "nb", "ta", "na", "rb", "ob", "si",
  // 四元数
  "vn", "ra", "Po", "cb", "ub", "ir", "lb", "Hf", "db",
  // 眼睛几何
  "tl", "Ja", "es", "fb", "br", "hb", "pb", "Vf",
  "mb", "gb", "xr", "yb", "kb", "wb", "bb",
  "uo", "lo", "Gf", "xb", "Pr", "ec", "zn", "vb", "Zt", "bn",
]);

// ---------- slice B: track 别名 / clip 规范化 kx / 求值 vt / rest 帧 ul / bridge bx ----------
const bStart = src.indexOf("const ux=new Map");
const bEnd = src.indexOf("function Yf"); // dl 结束处
if (bStart < 0 || bEnd < 0) throw new Error("slice B anchors not found");
const sliceB = src.slice(bStart, bEnd);
const B = evalCode(sliceB, [
  "ux", "lx", "dx", "$n", "Kf", "Xf", "cl", "fx", "hx", "px", "mx", "gx",
  "yx", "kx", "vt", "ul", "ai", "ci", "wx", "bx",
  "xx", "vx", "Sx", "Mx", "Tx", "Ex", "Px", "Ax", "ll",
], sliceA);

// ---------- Ix: motion recipes（纯字面量） ----------
const ixLit = literalAfter("const Ix=");
const { Ix } = evalCode(`const Ix=${ixLit};`, ["Ix"]);

// ---------- fl: 状态注册表（含 Cx / Dn / _x / Rx） ----------
const cxStart = src.indexOf("const Cx=");
const flOpen = src.indexOf("=", src.indexOf(",fl=")) + 1;
const flEnd = bracketMatch(flOpen) + 1;
const sliceFL = src.slice(cxStart, flEnd);
const _xLit = literalAfter("_x=");
const FL = evalCode(sliceFL, ["Cx", "Dn", "fl"]);
const _x = evalCode(`const _x=${_xLit};`, ["_x"])._x;

// ---------- jx: 形状眼睛度量（含前置布局常量 Fx..yl） ----------
const fxStart = src.indexOf("Fx=.26");
const jxOpen = src.indexOf("=", src.indexOf("jx={")) + 1;
const jxEnd = bracketMatch(jxOpen) + 1;
const JX = evalCode("var " + src.slice(fxStart, jxEnd), ["Fx", "zx", "rs", "pl", "Dx", "os", "ml", "gl", "yl", "jx"]);

// ---------- tx: 状态 → morph 覆盖层映射 ----------
const tx = evalCode(`const tx=${literalAfter("tx={")};`, ["tx"]).tx;

// ---------- morph 装饰层常量 ----------
const xVal = src.match(/const x=([\d.]+)/)[1];
const ixMapSrc = src.match(/ix=(\{[^}]*\})/)[1];
const mStart = src.indexOf("const IT=");
const mEnd = src.indexOf(",kd="); // kd 依赖轮廓生成器 nh，排除
if (mStart < 0 || mEnd < 0) throw new Error("morph consts anchors not found");
const M = evalCode(src.slice(mStart, mEnd), [
  "IT", "_T", "md", "Si", "gd", "RT", "yd", "$T", "OT", "LT", "NT",
  "FT", "Rh", "ga", "ds", "Mr", "Co", "zT", "DT", "jT", "qT", "BT", "$h",
], `const x=${xVal};var ix=${ixMapSrc};function nc(e){return ix[e]??2.5}`);

// ---------- 零散常量（正则直取，值以源码为准） ----------
const grab = (re, names) => {
  const m = src.match(re);
  if (!m) throw new Error(`regex miss: ${re}`);
  const out = {};
  names.forEach((n, i) => { out[n] = new Function(`return (${m[i + 1]})`)(); });
  return out;
};
const gazeC = grab(/Yb=([\d.]+),Zb=([\d.]+),Qb=(\{[^}]*\}),Jb=(\d+)/, ["Yb", "Zb", "Qb", "Jb"]);
const eyeC = grab(/Eb=([\d.]+),Pb=([\d.]+),Ab=([\d.]+),Ib=(\d+)/, ["Eb", "Pb", "Ab", "Ib"]);
const sdfC = grab(/JM=([\d.]+),eT=(\d+),tT=([\d.]+),nT=(\d+),rT=(\d+),ls=(\d+)/, ["JM", "eT", "tT", "nT", "rT", "ls"]);
const glowC = grab(/ld=(\d+),dd=(\d+),gr=([\d.]+),_h=([^,]+),lT=([\d.]+),dT=([\d.]+),fT=([\d.]+),hT=([\d.]+),pT=([\d.]+),mT=([\d.]+)/,
  ["ld", "dd", "gr", "_h", "lT", "dT", "fT", "hT", "pT", "mT"]);
const pokeC = grab(/Hb=([\d.]+),Vb=([\d.]+),Gb=([\d.]+),Wb=([\d.]+),Ub=([\d.]+),Kb=(\d+)/, ["Hb", "Vb", "Gb", "Wb", "Ub", "Kb"]);
const yT = Number(src.match(/yT=(\d+)/)[1]);
const xConst = Number(xVal);
const Ps = Number(src.match(/Ps=([\d.]+)/)[1]);
const Ox = src.match(/Ox="(\w+)"/)[1];

// Vf 每眼镜像标志（MT 的移植：(C×T)·M < 0）
const gT = A.Vf.map(({ M: Mv, T: Tv, C: Cv }) => {
  const cx3 = [Tv[1] * Cv[2] - Tv[2] * Cv[1], Tv[2] * Cv[0] - Tv[0] * Cv[2], Tv[0] * Cv[1] - Tv[1] * Cv[0]];
  return cx3[0] * Mv[0] + cx3[1] * Mv[1] + cx3[2] * Mv[2] < 0;
});

// ---------- 组装 ----------
const out = {
  meta: {
    source: path.basename(BUNDLE),
    sha256,
    extractedAt: new Date().toISOString(),
    tool: "avatar-explainer/tools/extract-recipes.mjs",
    note: "字段名保持 bundle 混淆原样；坐标/角度等单位见播放语义文档。",
  },
  clips: Ix,                                   // Ix：27 条 motion recipe，原始结构
  states: FL.fl,                               // fl：状态注册表（Dn/Cx 已求值展开）
  lifecycleGroups: _x,                         // _x：状态分组（展示用）
  expressions: A.bn,                           // bn：表情库（已求值为眼睛描述符对）
  expressionNames: A.gb,                       // gb：合法表情名
  expressionAliases: Object.fromEntries(A.wb), // wb：表情名别名
  blinkBlockingExpressions: [...A.bb],         // bb：不能穿眨眼的表情（Lr）
  shapes: {
    names: A.mb,                               // mb：全部身体形状名
    eyeMetrics: JX.jx,                         // jx：非球形的眼睛布局度量
    aliases: Object.fromEntries(B.lx),         // lx：身体名别名
  },
  eyes: {
    Ja: A.Ja,                                  // 双眼球面端点 A/B 与法线 N（原始常量）
    basis: A.Vf,                               // Vf：每眼 {M(中心方向),T(上),C(右)} 单位基
    mirror: gT,                                // gT：每眼是否镜像翻转
    baseQuatConjugate: A.pb,                   // pb：基准朝向四元数（br 的共轭）
    baseEulerDeg: B.Kf,                        // Kf：基准欧拉角（度）
    spineSamples: A.yb,                        // yb=21：脊线采样点数
    pathSegments: A.kb,                        // kb=18：path 扁平数组长度（3 段三次贝塞尔×6）
    defaultWidth: A.xr,                        // xr=.26：默认眼宽
    happyWidth: A.tl,                          // tl=.1305：happy/confused 的 wid
  },
  aliases: { tracks: Object.fromEntries(B.ux) }, // ux：track 名归一化
  constants: {
    spring: { Jw: A.Jw },                                   // 1/120 子步
    durations: { blink: A.na, morph: A.nb, lidMorph: A.ta,  // na/nb/ta
      blinkClose: A.rb, blinkHold: A.ob, blinkOvershoot: A.si },
    ease: { nr: A.nr, tb: A.tb, dx: B.dx, vx: B.vx },       // 常用贝塞尔
    gaze: { ...gazeC, rxSphere: 14, rySphere: 18, rxShape: 19, ryShape: 26,
      pxSphere: .03, pySphere: .024, pxShape: .07, pyShape: .055 },
    runtime: { zoomDefault: B.$n, zoomMulClamp: [.2, 3], zoomClamp: [.25, 2.5],
      lookDuration: B.Sx, maxAdvance: B.Mx, bodySpringFreq: B.Tx,
      bodyWeightEps: B.Ex, morphHideEyes: B.Px, gazeSnap: B.Ax,
      restName: B.ll, restClipDuration: B.Xf.duration },
    bridge: { duration: A.ta, easeFrom: B.dx, easeTo: A.nr,
      tolerance: { rotDeg: 4, pos: .015, scl: .02, zoom: .02, lids: .05 } }, // wx
    eyes: { ...eyeC, ...sdfC, outlineSamples: yT, arcStep: "Math.PI/48",
      lidSquashMin: eyeC.Ab, blinkThroughSet: [...A.bb] },
    glow: { ...glowC, midTBase: .42, midTAmp: .16, midTPeriodMs: 860 * 2 * Math.PI / 1e3 * 1e3 },
    poke: { ...pokeC, spinBase: pokeC.Hb, spinPerTurn: pokeC.Vb },
    morph: {
      stateMap: tx, kindZoom: M.gd, baseRadius: M.Si, weightsFull: M._T,
      canvasCenter: xConst, markOffset: M.IT, discR: M.RT, dotsGap: M.yd,
      dotsStagger: .12, liftAmp: M.NT, liftPeriodMs: M.FT, liftBoost: M.LT,
      sendPeriodMs: M.Rh, receivePeriodMs: M.ga, pencilPeriodMs: M.ds,
      pencilDrawFrac: M.Mr, pencilTrailMs: M.Co, trailMinStep: M.zT,
      trailSampleMsPerFrame: M.DT, progressShotMs: M.jT, gatherShotMs: M.qT,
      waveOffsets: M.BT, orbitRadPerMs: .0017, standbyRadPerMs: .0016,
      zoomFloor: M.$T, zoomFloorAmt: M.OT,
    },
    misc: { Ps, emphasisFace: Ox, maxDtMorph: .1 /* rx */ },
  },
  layout: { Fx: JX.Fx, zx: JX.zx, rs: JX.rs, pl: JX.pl, Dx: JX.Dx, os: JX.os, ml: JX.ml, gl: JX.gl, yl: JX.yl },
};

// ---------- 校验 ----------
const errors = [];
const clipNames = new Set(Ix.map(c => c.name));
if (clipNames.size !== Ix.length) errors.push("clip 名有重复");
const trackKeys = new Set(B.ux.keys());
const exprNames = new Set(A.gb);
for (const c of Ix) {
  if (!(c.duration > 0)) errors.push(`${c.name}: duration 非法`);
  for (const [k, tr] of Object.entries(c.tracks)) {
    if (!trackKeys.has(k)) errors.push(`${c.name}: 未知 track ${k}`);
    if (k === "expression") {
      for (const ev of tr) {
        if (ev.v !== "blink" && !exprNames.has(ev.v) && !A.wb.has(ev.v))
          errors.push(`${c.name}: 未知表情 ${ev.v}`);
      }
      continue;
    }
    let prev = -1;
    for (const kf of tr) {
      if (kf.t < prev - 1e-9) errors.push(`${c.name}.${k}: 关键帧时间乱序`);
      if (kf.t < -1e-9 || kf.t > c.duration + 1e-6) errors.push(`${c.name}.${k}: t=${kf.t} 超出 [0,${c.duration}]`);
      if (kf.ease && kf.ease.length !== 4) errors.push(`${c.name}.${k}: ease 长度非 4`);
      prev = kf.t;
    }
  }
}
for (const [st, def] of Object.entries(out.states)) {
  for (const list of [def.clips, def.compactClips ?? []])
    for (const cn of list) if (!clipNames.has(cn)) errors.push(`状态 ${st}: 缺 clip ${cn}`);
  if (def.face != null && !exprNames.has(def.face)) errors.push(`状态 ${st}: 未知 face ${def.face}`);
  if (def.morph != null && !(def.morph in tx)) errors.push(`状态 ${st}: morph ${def.morph} 不在 tx`);
  if (def.next != null && !(def.next in out.states)) errors.push(`状态 ${st}: next ${def.next} 不存在`);
}
for (const [name, pair] of Object.entries(out.expressions)) {
  if (!Array.isArray(pair) || pair.length !== 2) errors.push(`表情 ${name}: 不是双眼对`);
  for (const e of pair) {
    if (!Array.isArray(e.pts) || e.pts.length !== A.yb) errors.push(`表情 ${name}: pts 数 ≠ ${A.yb}`);
    if (!Array.isArray(e.path) || e.path.length !== A.kb) errors.push(`表情 ${name}: path 长度 ≠ ${A.kb}`);
  }
}
if (errors.length) {
  console.error("校验失败:\n" + errors.map(e => "  - " + e).join("\n"));
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const kb2 = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`OK -> ${OUT} (${kb2} KB)`);
console.log(`clips=${Ix.length} states=${Object.keys(out.states).length} expressions=${Object.keys(out.expressions).length} shapes=${A.mb.length}`);
console.log("clip names:", Ix.map(c => c.name).join(" "));
console.log("state names:", Object.keys(out.states).join(" "));
