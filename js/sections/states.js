// 第 6 节：状态机 —— 原版引擎移植（grok-player）+ 原版提取数据
// 7 个代表状态按钮；「正在播放」显示 player 的真实当前 clip
import { createGrokBot } from '../vendor/grok-player.js';

const SHOWCASE_STATES = ['idle', 'listening', 'thinking', 'waiting', 'alerting', 'working', 'finished'];

export function init(root) {
  const bot = createGrokBot(root.querySelector('.stage'), { size: 240, state: 'idle', seed: 'states-demo' });
  const btnWrap = root.querySelector('.state-buttons');
  const nowEl = root.querySelector('.clip-now');
  const poolEl = root.querySelector('.clip-pool');

  for (const id of SHOWCASE_STATES) {
    const btn = document.createElement('button');
    btn.textContent = id;
    btn.setAttribute('aria-pressed', id === 'idle' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      bot.setState(id);
      btnWrap.querySelectorAll('button').forEach((b) =>
        b.setAttribute('aria-pressed', b.textContent === id ? 'true' : 'false'));
    });
    btnWrap.appendChild(btn);
  }

  // 真实当前 clip：状态机种子化洗牌抽取的结果
  setInterval(() => {
    nowEl.textContent = `正在播放：${bot.clip ?? '—'}（state: ${bot.state}）`;
  }, 300);

  // idle 的真实 clip 池（来自 grok-recipes.json 的 states.idle.clips）
  fetch('js/vendor/grok-recipes.json')
    .then((r) => r.json())
    .then((data) => {
      const pool = data.states?.idle?.clips ?? [];
      poolEl.textContent = `idle 的 clip 池（真实数据）：[${pool.join(', ')}] —— 种子化洗牌抽取、随机相位起播`;
    })
    .catch(() => { poolEl.textContent = ''; });
}
