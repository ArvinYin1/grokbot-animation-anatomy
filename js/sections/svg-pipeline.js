// 第 1 节：每帧都是算出来的（程序化 SVG + 属性级 diff 写入器）
import { createMiniBot } from '../mini-bot.js';

export function init(root) {
  const bot = createMiniBot(root.querySelector('.stage'), { seed: 20240601 });
  const rows = {
    bodyD: root.querySelector('[data-row="bodyD"] .v'),
    eyeD: root.querySelector('[data-row="eyeD"] .v'),
    eyeTr: root.querySelector('[data-row="eyeTr"] .v'),
    squash: root.querySelector('[data-row="squash"] .v'),
    angles: root.querySelector('[data-row="angles"] .v'),
    mask: root.querySelector('[data-row="mask"] .v'),
  };
  const rowEls = Object.fromEntries(
    Object.keys(rows).map((k) => [k, rows[k].closest('.panel-row')]));

  let slow = false, showDiff = false;
  const slowBtn = root.querySelector('[data-act="slow"]');
  const diffBtn = root.querySelector('[data-act="diff"]');
  slowBtn.addEventListener('click', () => {
    slow = !slow;
    bot.setTimeScale(slow ? 0.1 : 1);
    slowBtn.setAttribute('aria-pressed', slow);
    slowBtn.textContent = slow ? '慢放 0.1×：开' : '慢放 0.1×：关';
  });
  diffBtn.addEventListener('click', () => {
    showDiff = !showDiff;
    bot.setDiffDebug(showDiff);
    diffBtn.setAttribute('aria-pressed', showDiff);
    diffBtn.textContent = showDiff ? '显示 DOM diff：开' : '显示 DOM diff：关';
    if (!showDiff) {
      root.querySelectorAll('.panel-row').forEach((r) => r.classList.remove('flash'));
      root.querySelectorAll('.mini-bot [diff-hot]').forEach((n) => n.removeAttribute('diff-hot'));
    }
  });

  const cut = (s, n) => (s && s.length > n ? s.slice(0, n) + ' …' : s || '—');
  let last = 0;
  const prevVals = {};
  bot.onFrame((info) => {
    // 面板 12fps 节流，避免每帧重排
    if (info.t - last < 1 / 12) return;
    last = info.t;
    const vals = {
      bodyD: cut(info.bodyD, 74),
      eyeD: cut(info.eyeL.d, 74),
      eyeTr: `L ${cut(info.eyeL.transform, 30)} | R ${cut(info.eyeR.transform, 30)}`,
      squash: info.squash,
      angles: `yaw ${info.yaw.toFixed(2)}°  pitch ${info.pitch.toFixed(2)}°  blink ${info.blink.toFixed(2)}`,
      mask: `<mask> = rect(#fff) + path#L(#000) + path#R(#000) — 眼睛是身体上的洞`,
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
    if (showDiff) {
      root.querySelectorAll('.mini-bot [diff-hot]').forEach((n) => n.removeAttribute('diff-hot'));
      for (const n of info.changed) n.setAttribute('diff-hot', '');
    }
  });
}
