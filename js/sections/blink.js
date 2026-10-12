// 第 5 节：眨眼与生命感 —— 种子化眨眼时刻表可视化
import { createMiniBot, generateBlinkSchedule, fnv1a } from '../mini-bot.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const DUR = 30;

export function init(root) {
  const seedInput = root.querySelector('[data-seed]');
  const randBtn = root.querySelector('[data-rand-seed]');
  const applyBtn = root.querySelector('[data-apply-seed]');
  const timeline = root.querySelector('svg.blink-timeline');
  const marksG = timeline.querySelector('.marks');
  const countEl = root.querySelector('.blink-count');
  const hashEl = root.querySelector('.seed-hash');

  const bot = createMiniBot(root.querySelector('.stage'), {
    seed: fnv1a('demo-seed'), gaze: false,
  });

  const W = 640, H = 90;

  function drawTimeline(seed) {
    marksG.textContent = '';
    const events = generateBlinkSchedule(seed, DUR);
    // 刻度
    for (let s = 0; s <= DUR; s += 5) {
      const tick = document.createElementNS(SVGNS, 'line');
      tick.setAttribute('x1', (s / DUR) * W); tick.setAttribute('x2', (s / DUR) * W);
      tick.setAttribute('y1', H - 18); tick.setAttribute('y2', H - 8);
      tick.setAttribute('class', 'tick');
      marksG.appendChild(tick);
      const label = document.createElementNS(SVGNS, 'text');
      label.setAttribute('x', (s / DUR) * W); label.setAttribute('y', H - 0);
      label.setAttribute('class', 'tick-label');
      label.textContent = s + 's';
      marksG.appendChild(label);
    }
    // 眨眼标记（双眨 = 间距 0.35s 的一对）
    let doubles = 0;
    for (let i = 0; i < events.length; i++) {
      const isDouble = i + 1 < events.length && events[i + 1] - events[i] < 0.6;
      if (isDouble && i > 0 && events[i] - events[i - 1] >= 0.6) doubles++;
      const m = document.createElementNS(SVGNS, 'rect');
      m.setAttribute('x', (events[i] / DUR) * W - 2);
      m.setAttribute('y', isDouble ? 18 : 30);
      m.setAttribute('width', 4);
      m.setAttribute('height', isDouble ? 44 : 32);
      m.setAttribute('rx', 2);
      m.setAttribute('class', isDouble ? 'mark double' : 'mark');
      marksG.appendChild(m);
    }
    countEl.textContent = `30 秒内 ${events.length} 次眨眼（含 ${doubles} 组双眨）`;
    hashEl.textContent = `xorshift32(0x${(seed >>> 0).toString(16).padStart(8, '0')})`;
  }

  function apply() {
    const raw = seedInput.value.trim() || 'demo-seed';
    const seed = /^-?\d+$/.test(raw) ? (+raw) >>> 0 : fnv1a(raw);
    bot.setSeed(seed);
    drawTimeline(seed);
  }
  applyBtn.addEventListener('click', apply);
  seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
  randBtn.addEventListener('click', () => {
    seedInput.value = String((Math.random() * 0xffffffff) >>> 0);
    apply();
  });

  drawTimeline(fnv1a('demo-seed'));
}
