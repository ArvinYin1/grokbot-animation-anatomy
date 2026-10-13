// 第 4 节：球面上的眼睛 —— 拖拽旋转头部，对比「平面贴眼 vs 球面投影」
import { projectEye, rafLoop } from '../lib.js';

const f = (n) => Math.round(n * 100) / 100;

export function init(root) {
  const svg = root.querySelector('svg.sphere-canvas');
  const wire = svg.querySelector('.wire');
  const eyeL = svg.querySelector('.eye-l');
  const eyeR = svg.querySelector('.eye-r');
  const modeToggle = root.querySelector('[data-sphere-mode]');
  const modeLabel = root.querySelector('.sphere-mode-label');
  const ratioEl = root.querySelector('.width-ratio');

  const CX = 210, CY = 175, R = 110;
  let yaw = 26, pitch = 10, dragging = false, lastDrag = -10;
  let autoAmp = 1;

  // 线框：赤道 + 三条经线（随姿态变化）
  const equator = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  const meridians = [0, 60, 120].map(() =>
    document.createElementNS('http://www.w3.org/2000/svg', 'ellipse'));
  wire.append(equator, ...meridians);

  svg.addEventListener('pointerdown', (e) => {
    dragging = true;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += e.movementX * 0.45;
    pitch = Math.max(-55, Math.min(55, pitch - e.movementY * 0.45));
    lastDrag = performance.now() / 1000;
  });
  svg.addEventListener('pointerup', () => { dragging = false; });

  modeToggle.addEventListener('change', () => {
    modeLabel.textContent = modeToggle.checked ? '球面投影（GrokBotMark 方案）' : '平面贴眼（常见省事方案）';
  });

  function draw(t) {
    const spherical = modeToggle.checked;
    // 未被拖拽时缓慢自动摆动，拖拽后 2.5s 内淡出自动摆
    const idle = Math.max(0, Math.min(1, (t - lastDrag - 2.5) / 1.5));
    autoAmp += (idle - autoAmp) * 0.02;
    const y = yaw + Math.sin(t * 0.4) * 16 * autoAmp;
    const p = pitch + Math.sin(t * 0.27 + 1) * 6 * autoAmp;

    // 线框
    equator.setAttribute('cx', CX); equator.setAttribute('cy', CY);
    equator.setAttribute('rx', R);
    equator.setAttribute('ry', f(Math.max(2, R * Math.abs(Math.sin((p * Math.PI) / 180)))));
    meridians.forEach((m, i) => {
      const a = ((y + i * 60) * Math.PI) / 180;
      m.setAttribute('cx', CX); m.setAttribute('cy', CY);
      m.setAttribute('rx', f(Math.max(2, R * Math.abs(Math.cos(a)))));
      m.setAttribute('ry', R);
    });

    // 眼睛
    const eyes = [[eyeL, -24], [eyeR, 24]];
    let wMin = 1, wMax = 0;
    for (const [el, baseYaw] of eyes) {
      if (spherical) {
        const e = projectEye(y, p, baseYaw, 7);
        wMin = Math.min(wMin, e.widthScale);
        wMax = Math.max(wMax, e.widthScale);
        if (!e.visible) { el.setAttribute('opacity', '0'); continue; }
        el.setAttribute('opacity', '1');
        const ex = CX + e.x * R, ey = CY - e.y * R;
        el.setAttribute('transform',
          `translate(${f(ex)} ${f(ey)}) rotate(${f(e.rot)}) scale(${f(e.widthScale)} 1)`);
      } else {
        // 平面贴眼：线性平移、不压缩、不穿帮裁切（转过边缘仍然完整显示）
        const ex = CX + baseYaw * 1.6 + (y / 50) * R * 0.72;
        const ey = CY - 12 + (p / 50) * R * 0.5;
        el.setAttribute('opacity', '1');
        el.setAttribute('transform', `translate(${f(ex)} ${f(ey)})`);
      }
    }
    if (spherical && Math.abs(y) > 6) {
      ratioEl.textContent =
        `远侧眼宽 / 近侧眼宽 = ${(wMin / wMax).toFixed(2)}（原引擎实测 ≈ 0.69，即球面深度系数）`;
    } else {
      ratioEl.textContent = spherical ? '转动头部，观察两只眼睛宽度比变化' :
        '平面模式：两只眼睛永远等宽，转过边缘也不消失 —— 穿帮';
    }
  }

  rafLoop(svg, (dt, t) => draw(t));
}
