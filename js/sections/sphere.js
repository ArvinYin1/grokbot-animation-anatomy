// 第 4 节：球面上的眼睛 —— 拖拽旋转头部，对比「平面贴眼 vs 球面投影」
// 球面侧不是示意数学，而是直接复用 grok-player.js 的原版管线：
//   lb（欧拉→四元数）→ ir（四元数→3×3）→ ST（罗德里格斯 sinc 球面映射 +
//   RM 前半球地平线裁剪）→ xT（弧线细分）→ 正交投影取 (x, y)。
// 数据（眼球基向量 basis / 镜像标志 / 静止姿态 baseEulerDeg / neutral 眼睛
// 描述符）全部来自 grok-recipes.json，与真引擎同源。
import { rafLoop } from '../lib.js';
import { lb, ir, ST, xT, kT } from '../vendor/grok-player.js';
import { t } from '../i18n/i18n.js';

const DEG = Math.PI / 180;
const f = (n) => Math.round(n * 100) / 100;

// 平面贴眼模式的胶囊眼（屏幕空间，不做任何球面变换）
function capsulePath(cx, cy, rw, rh) {
  const s = Math.max(0, rh - rw);
  return `M${f(cx - rw)} ${f(cy - s)}` +
    `A${f(rw)} ${f(rw)} 0 0 1 ${f(cx + rw)} ${f(cy - s)}` +
    `L${f(cx + rw)} ${f(cy + s)}` +
    `A${f(rw)} ${f(rw)} 0 0 1 ${f(cx - rw)} ${f(cy + s)}Z`;
}

export function init(root) {
  const svg = root.querySelector('svg.sphere-canvas');
  const wire = svg.querySelector('.wire');
  const eyeL = svg.querySelector('.eye-l');
  const eyeR = svg.querySelector('.eye-r');
  const modeToggle = root.querySelector('[data-sphere-mode]');
  const modeLabel = root.querySelector('.sphere-mode-label');
  const ratioEl = root.querySelector('.width-ratio');

  const CX = 210, CY = 175, R = 110;
  let yaw = 0, pitch = 0, dragging = false, lastDrag = -10; // 相对静止姿态的增量（度）
  let autoAmp = 1;
  let data = null; // { basis, mirror, base, neutral }

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
    modeLabel.textContent = modeToggle.checked ? t('index.js.sphere.modeSpherical') : t('index.js.sphere.modeFlat');
  });
  modeLabel.textContent = modeToggle.checked ? t('index.js.sphere.modeSpherical') : t('index.js.sphere.modeFlat');

  function draw(time) {
    if (!data) return;
    const spherical = modeToggle.checked;
    // 未被拖拽时缓慢自动摆动，拖拽后 2.5s 内淡出自动摆
    const idle = Math.max(0, Math.min(1, (time - lastDrag - 2.5) / 1.5));
    autoAmp += (idle - autoAmp) * 0.02;
    const y = yaw + Math.sin(time * 0.4) * 16 * autoAmp;
    const p = pitch + Math.sin(time * 0.27 + 1) * 6 * autoAmp;
    const { basis, mirror, base, neutral } = data;
    // 有效头部姿态 = 静止姿态 + 拖拽增量（与引擎的 euler 合成一致）
    const effYaw = base[1] + y, effPitch = base[0] + p;

    // 线框
    equator.setAttribute('cx', CX); equator.setAttribute('cy', CY);
    equator.setAttribute('rx', R);
    equator.setAttribute('ry', f(Math.max(2, R * Math.abs(Math.sin(effPitch * DEG)))));
    meridians.forEach((m, i) => {
      const a = (effYaw + i * 60) * DEG;
      m.setAttribute('cx', CX); m.setAttribute('cy', CY);
      m.setAttribute('rx', f(Math.max(2, R * Math.abs(Math.cos(a)))));
      m.setAttribute('ry', R);
    });

    if (spherical) {
      // 原版：quat = lb(pitch, yaw, roll)，逐眼 ST → 单位球面裁剪环 → 正交投影
      const m3 = ir(lb(effPitch * DEG, effYaw * DEG, base[2] * DEG));
      const widths = [];
      [eyeL, eyeR].forEach((el, a) => {
        const rings = ST(neutral[a] ?? neutral[0], basis[a], mirror[a], m3, R);
        let d = '', xMin = 1e9, xMax = -1e9;
        for (const ring of rings) {
          const pts = xT(ring, kT);
          if (pts.length < 3) continue;
          d += 'M' + pts.map(([px, py]) => `${f(CX + px * R)} ${f(CY - py * R)}`).join('L') + 'Z';
          for (const [px] of pts) { if (px < xMin) xMin = px; if (px > xMax) xMax = px; }
        }
        if (!d) { el.setAttribute('display', 'none'); return; } // 转到背面：被地平线裁掉
        el.removeAttribute('display');
        el.setAttribute('d', d);
        widths.push(xMax - xMin);
      });
      if (widths.length === 2 && (Math.abs(y) > 6 || Math.abs(p) > 6)) {
        const lo = Math.min(...widths), hi = Math.max(...widths);
        ratioEl.textContent = hi > 1e-6 ?
          `${t('index.js.sphere.ratioPre')}${(lo / hi).toFixed(2)}${t('index.js.sphere.ratioPost')}` :
          t('index.js.sphere.eyeHidden');
      } else {
        ratioEl.textContent = t('index.js.sphere.ratioHint');
      }
    } else {
      // 平面贴眼：线性平移、不压缩、不穿帮裁切（转过边缘仍然完整显示）
      [eyeL, eyeR].forEach((el, a) => {
        el.removeAttribute('display');
        const ex = CX + (a === 0 ? -40 : 40) + (y / 50) * R * 0.72;
        const ey = CY - 18 + (p / 50) * R * 0.5;
        el.setAttribute('d', capsulePath(ex, ey, 0.13 * R, 0.285 * R));
      });
      ratioEl.textContent = t('index.js.sphere.flatNote');
    }
  }

  fetch('js/vendor/grok-recipes.json')
    .then((r) => r.json())
    .then((recipes) => {
      data = {
        basis: recipes.eyes.basis,
        mirror: recipes.eyes.mirror,
        base: recipes.eyes.baseEulerDeg,
        neutral: recipes.expressions.neutral,
      };
      draw(0); // 静态首帧（reduced-motion / 截图场景也能看到眼睛）
    });

  rafLoop(svg, (dt, t) => draw(t));
}
