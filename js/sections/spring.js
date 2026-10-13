// 第 3 节：弹簧，不是定时器 —— 半隐式欧拉积分游乐场
// v += (-2ζω·v - ω²·(x - target))·dt ; x += v·dt （120Hz 固定子步）
import { Spring, rafLoop } from '../lib.js';

const SVGNS = 'http://www.w3.org/2000/svg';

export function init(root) {
  const ball = root.querySelector('.spring-ball');
  const curve = root.querySelector('.spring-curve');
  const easeCurve = root.querySelector('.ease-curve');
  const wSlider = root.querySelector('[data-omega]');
  const zSlider = root.querySelector('[data-zeta]');
  const wVal = root.querySelector('.omega-val');
  const zVal = root.querySelector('.zeta-val');
  const compareToggle = root.querySelector('[data-compare]');
  const kickBtn = root.querySelector('[data-kick]');

  const spring = new Spring(0, +wSlider.value, +zSlider.value);
  spring.target = 1;
  const H = 150;              // 小球行程（px，viewBox 单位）
  const hist = [];            // [t, x] 位移历史
  const SPAN = 4;             // 曲线窗口 4 秒
  let t0 = 0;                 // 本次冲击起点（引擎时钟）
  let curT = 0;               // rafLoop 内部时钟的最新值

  const GW = 560, GH = 180;   // 曲线图尺寸

  function kick() {
    spring.x = 0; spring.v = 0; spring.target = 1;
    hist.length = 0; t0 = curT;
  }

  function syncLabels() {
    wVal.textContent = (+wSlider.value).toFixed(1);
    zVal.textContent = (+zSlider.value).toFixed(2);
  }
  wSlider.addEventListener('input', () => { spring.omega = +wSlider.value; syncLabels(); });
  zSlider.addEventListener('input', () => { spring.zeta = +zSlider.value; syncLabels(); });
  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [w, z] = btn.dataset.preset.split(',').map(Number);
      wSlider.value = w; zSlider.value = z;
      spring.omega = w; spring.zeta = z;
      syncLabels();
    });
  });
  compareToggle.addEventListener('change', () => {
    easeCurve.style.display = compareToggle.checked ? '' : 'none';
  });
  kickBtn.addEventListener('click', () => kick());
  syncLabels();

  rafLoop(root.querySelector('.spring-stage'), (dt, t) => {
    curT = t;
    spring.step(dt);
    const x = spring.x;
    // 小球：垂直位移 + 速度拉伸（squash & stretch）
    const y = 170 - x * H;
    const stretch = Math.max(-0.35, Math.min(0.35, spring.v * 0.04));
    ball.setAttribute('transform',
      `translate(70 ${y.toFixed(2)}) scale(${(1 - stretch).toFixed(3)} ${(1 + stretch).toFixed(3)})`);

    hist.push([t, x]);
    while (hist.length && hist[0][0] < t - SPAN) hist.shift();
    let d = '';
    for (const [ht, hx] of hist) {
      const px = ((ht - (t - SPAN)) / SPAN) * GW;
      const py = GH - 14 - hx * (GH - 34);
      d += (d ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
    }
    curve.setAttribute('d', d);

    // ease-out(cubic) 对比曲线：1 秒内走完，纯时间函数，无物理
    if (compareToggle.checked) {
      let ed = '';
      const T = 1;
      for (let s = 0; s <= 40; s++) {
        const et = (s / 40) * T;
        const ex = 1 - Math.pow(1 - et / T, 3);
        const px = ((t0 + et - (t - SPAN)) / SPAN) * GW;
        const py = GH - 14 - ex * (GH - 34);
        ed += (ed ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      }
      easeCurve.setAttribute('d', ed);
    }
  });
}
