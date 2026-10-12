// 第 6 节：状态机与 recipe 洗牌 —— 状态切换 + idle clip 洗牌队列可视化
import { createMiniBot, xorshift32, rafLoop } from '../mini-bot.js';

const CLIPS = ['Idle_A', 'Idle_B', 'Idle_C', 'Idle_D'];
const CLIP_LEN = 4; // 每条 clip 约 4 秒

export function init(root) {
  const bot = createMiniBot(root.querySelector('.stage'), { seed: 7766 });
  const queueEl = root.querySelector('.clip-queue');
  const nowEl = root.querySelector('.clip-now');

  root.querySelectorAll('[data-state]').forEach((btn) => {
    btn.addEventListener('click', () => {
      bot.setState(btn.dataset.state);
      root.querySelectorAll('[data-state]').forEach((b) =>
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
    });
  });

  // 种子化洗牌队列：抽完一轮重洗，随机相位起播（idle 永不重复）
  const rand = xorshift32(0xc0ffee);
  let bag = [];
  const queue = [];
  function drawClip() {
    if (!bag.length) {
      bag = [...CLIPS];
      for (let i = bag.length - 1; i > 0; i--) { // Fisher–Yates
        const j = Math.floor(rand() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return { name: bag.pop(), phase: rand() };
  }
  for (let i = 0; i < 5; i++) queue.push(drawClip());

  function render(activeIdx) {
    queueEl.textContent = '';
    queue.forEach((c, i) => {
      const chip = document.createElement('span');
      chip.className = 'clip-chip' + (i === activeIdx ? ' active' : '');
      chip.textContent = `${c.name} φ=${c.phase.toFixed(2)}`;
      queueEl.appendChild(chip);
    });
  }
  render(0);

  // 每 CLIP_LEN 秒：队首出队（播完），补一条新的
  rafLoop(root.querySelector('.state-demo'), (dt, t) => {
    const idx = Math.floor(t / CLIP_LEN);
    if (idx !== render.lastIdx) {
      render.lastIdx = idx;
      queue.shift();
      queue.push(drawClip());
      render(0);
      nowEl.textContent = `正在播放：${queue[0].name}（随机相位 ${queue[0].phase.toFixed(2)} 起播）`;
    }
  });
  render.lastIdx = -1;
  nowEl.textContent = `正在播放：${queue[0].name}（随机相位 ${queue[0].phase.toFixed(2)} 起播）`;
}
