// glow.html 装配：同一几何，只改 opts.glow。
// 四个面板由页面里的 .demo.paper 舞台容器（data-glow 钩子）静态给出，
// 这里只负责按 key 把对应的 glow 参数交给 createGrokBot。
import { createGrokBot } from './vendor/grok-player.js';

// key = 容器上的 data-glow 值；value = 传给 createGrokBot 的差异参数。
// flat 无 glow：body fill 退化为 rc(theme) → Nr(ink)，即线上真实默认。
// breath 不传 frozenAt：保持 rAF 循环，runtime 每帧写 midT（halo 呼吸）。
const PANELS = {
  flat: {
    frozenAt: 1.0,
  },
  gradient: {
    frozenAt: 1.0,
    glow: { inner: [0.94, 0.95, 1.0], mid: [0.52, 0.57, 0.72], rim: [0.10, 0.12, 0.20], halo: 0 },
  },
  halo: {
    frozenAt: 1.0,
    glow: { inner: [0.94, 0.95, 1.0], mid: [0.52, 0.57, 0.72], rim: [0.10, 0.12, 0.20], halo: 0.85 },
  },
  breath: {
    glow: { inner: [0.11, 0.11, 0.14], mid: [0.05, 0.05, 0.07], rim: [0.30, 0.33, 0.44], halo: 0.9 },
  },
};

for (const [key, opts] of Object.entries(PANELS)) {
  const stage = document.querySelector(`[data-glow="${key}"]`);
  if (!stage) continue;
  // 同一引擎、同一状态、同一冻结帧，唯一变量是 glow
  createGrokBot(stage, { size: 220, state: 'idle', seed: 1, ...opts });
}
