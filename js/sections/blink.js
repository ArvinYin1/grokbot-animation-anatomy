// 第 5 节：眨眼与生命感 —— 真实机制：眨眼是 clip 内嵌 expression 事件 + 命令式 blink()
// 逆向订正：原 bundle 中没有环境自动眨眼调度器（全 bundle 唯一的 Math.random 在网络重试退避里）。
// clip 的 expression 轨道上 v:"blink" 的事件由编译器 gx(t) 展开为三段 lids 关键帧：
//   t → 0（睁）  t + 0.26×0.45 → 1（闭）  t + 0.26 → 0（睁），ease [.42,0,.58,1]
// 下方时间轴直接画 grok-recipes.json 里 Idle_A/B/D 的真实事件；右侧跑真 player。
import { createGrokBot } from '../vendor/grok-player.js';

const BLINK_DUR = 0.26; // na：一次眨眼的总时长（秒）
const SHOWN = ['Idle_A', 'Idle_B', 'Idle_D'];

export function init(root) {
  const bot = createGrokBot(root.querySelector('.stage'), { size: 240, state: 'idle', seed: 'blink-demo' });
  const nowEl = root.querySelector('.clip-now');
  setInterval(() => { nowEl.textContent = `当前 clip：${bot.clip ?? '—'}`; }, 300);
  root.querySelector('[data-blink-now]').addEventListener('click', () => bot.blink());

  fetch('js/vendor/grok-recipes.json')
    .then((r) => r.json())
    .then((data) => {
      const byName = new Map(data.clips.map((c) => [c.name, c]));
      const wrap = root.querySelector('.clip-timelines');
      for (const name of SHOWN) {
        const clip = byName.get(name);
        if (!clip) continue;
        const blinks = (clip.tracks?.expression ?? []).filter((e) => e.v === 'blink');
        const row = document.createElement('div');
        row.className = 'clip-row';
        const label = document.createElement('span');
        label.className = 'clip-name mono';
        label.textContent = `${name} · ${clip.duration}s`;
        const track = document.createElement('div');
        track.className = 'clip-track';
        blinks.forEach((e, i) => {
          const isDouble = blinks[i + 1] && blinks[i + 1].t - e.t < 0.6;
          const mark = document.createElement('span');
          mark.className = 'blink-mark' + (isDouble ? ' double' : '');
          mark.style.left = `${(e.t / clip.duration) * 100}%`;
          mark.style.width = `${(BLINK_DUR / clip.duration) * 100}%`;
          mark.title = `t=${e.t.toFixed(2)}s（${BLINK_DUR}s，45% 处闭合）`;
          track.appendChild(mark);
        });
        row.append(label, track);
        wrap.appendChild(row);
      }
    })
    .catch(() => {});
}
