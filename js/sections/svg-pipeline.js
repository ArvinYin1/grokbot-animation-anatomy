// 第 1 节：每帧都是算出来的（真实引擎 + MutationObserver 属性面板）
// 本卡片与 hero、05/06 节运行同一个移植引擎（grok-player）。面板不 hook
// 引擎内部，而是用 MutationObserver 观察真实 SVG 子树的属性写入：
// 引擎每帧只写变化了的 attribute，observer 按帧批量收到 mutation 记录，
// 正好把 diff 写入器的工作量可视化出来。
import { createGrokBot } from '../vendor/grok-player.js';

const cut = (s, n) => (s && s.length > n ? s.slice(0, n) + ' …' : s || '—');

export function init(root) {
  const stage = root.querySelector('.stage');
  const rows = {
    bodyD: root.querySelector('[data-row="bodyD"] .v'),
    eyeD: root.querySelector('[data-row="eyeD"] .v'),
    headTr: root.querySelector('[data-row="headTr"] .v'),
    zoomTr: root.querySelector('[data-row="zoomTr"] .v'),
    dom: root.querySelector('[data-row="dom"] .v'),
    mask: root.querySelector('[data-row="mask"] .v'),
  };
  const rowEls = Object.fromEntries(
    Object.keys(rows).map((k) => [k, rows[k].closest('.panel-row')]));
  rows.mask.textContent = '<mask> = rect(#fff) + path(#000) 挖洞（morph 状态启用）；idle/sphere 模式改用路径布尔裁剪（OM）把眼睛裁进 body[d]';

  const stepBtn = root.querySelector('[data-act="step"]');
  const step1Btn = root.querySelector('[data-act="step1"]');
  const diffBtn = root.querySelector('[data-act="diff"]');

  let showDiff = false, stepMode = false;
  let bot = null, observer = null, mountToken = 0;
  let lastRefresh = 0, lastWrites = '—', hotNodes = [];
  const prevVals = {};

  function refreshPanel(force) {
    const now = performance.now();
    if (!force && now - lastRefresh < 1000 / 12) return; // 面板 12fps 节流
    lastRefresh = now;
    const el = bot?.el;
    if (!el) return;
    // 引擎固定骨架：svg > defs + g(zoom) > g(parts) + g(head) > halo/body/eyes
    const zoomG = el.children[1];
    const headG = zoomG?.children[1];
    const bodyP = headG?.children[1];
    const maskEyes = el.querySelector('defs mask path');
    const eyeD = maskEyes?.getAttribute('d');
    const bodyD = bodyP?.getAttribute('d');
    const vals = {
      // 外轮廓是固定椭圆弧，串头看起来不变；长度随眼睛裁切弧逐帧变化，放在前面
      bodyD: bodyD ? `len ${bodyD.length} · ${cut(bodyD, 52)}` : '—',
      eyeD: eyeD ? cut(eyeD, 74) : '（空 — sphere 模式下眼睛是裁进 body path 的地平线弧）',
      headTr: headG?.getAttribute('transform') ?? '（无 — 恒等）',
      zoomTr: zoomG?.getAttribute('transform') ?? '（无 — 恒等）',
      dom: lastWrites,
    };
    for (const k in vals) {
      if (prevVals[k] !== vals[k]) {
        rows[k].textContent = vals[k];
        if (showDiff) {
          rowEls[k].classList.remove('flash');
          void rowEls[k].offsetWidth; // 重启动画
          rowEls[k].classList.add('flash');
        }
        prevVals[k] = vals[k];
      }
    }
  }

  function mount(frozen) {
    unmount();
    const token = ++mountToken;
    // frozenAt 模式：引擎不起 rAF，渲染停在确定性时刻，用 step() 手动逐帧推进
    bot = createGrokBot(stage, {
      size: 240, state: 'idle', seed: 'svg-pipeline',
      ...(frozen ? { frozenAt: 0 } : {}),
    });
    bot.ready.then(() => {
      if (token !== mountToken || !bot.el) return;
      observer = new MutationObserver((list) => {
        // 聚合本批真实写入；diff-hot 是面板自己打的高亮标记，过滤掉防自触发
        const agg = new Map();
        const targets = [];
        for (const m of list) {
          if (m.attributeName === 'diff-hot') continue;
          const key = `${m.target.tagName}[${m.attributeName}]`;
          agg.set(key, (agg.get(key) ?? 0) + 1);
          if (!targets.includes(m.target)) targets.push(m.target);
        }
        if (agg.size === 0) return;
        const total = [...agg.values()].reduce((a, b) => a + b, 0);
        lastWrites = `${total} 次：` + [...agg].sort((a, b) => b[1] - a[1])
          .slice(0, 4).map(([k, c]) => `${k}×${c}`).join(' ');
        if (showDiff) {
          for (const n of hotNodes) n.removeAttribute('diff-hot');
          hotNodes = targets;
          for (const n of hotNodes) n.setAttribute('diff-hot', '');
        }
        refreshPanel(false);
      });
      observer.observe(bot.el, { attributes: true, subtree: true });
      refreshPanel(true);
    });
  }

  function unmount() {
    observer?.disconnect(); observer = null;
    hotNodes = [];
    bot?.destroy(); bot = null;
  }

  stepBtn.addEventListener('click', () => {
    stepMode = !stepMode;
    stepBtn.setAttribute('aria-pressed', stepMode);
    stepBtn.textContent = stepMode ? '逐帧步进：开' : '逐帧步进：关';
    step1Btn.hidden = !stepMode;
    lastWrites = '—';
    mount(stepMode);
  });
  step1Btn.addEventListener('click', () => {
    bot?.step(1);
    // MutationObserver 回调是微任务，排在 step 的同步写入之后、本微任务之前；
    // 等它更新完聚合计数再强制刷面板，「帧内 DOM 写入」行才不会差一拍
    queueMicrotask(() => refreshPanel(true));
  });
  diffBtn.addEventListener('click', () => {
    showDiff = !showDiff;
    diffBtn.setAttribute('aria-pressed', showDiff);
    diffBtn.textContent = showDiff ? '显示 DOM diff：开' : '显示 DOM diff：关';
    if (!showDiff) {
      root.querySelectorAll('.panel-row').forEach((r) => r.classList.remove('flash'));
      for (const n of hotNodes) n.removeAttribute('diff-hot');
      hotNodes = [];
    }
  });

  mount(false);
}
