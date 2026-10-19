// shapes.html 装配：数据 fetch 一次，分发给各版块模块。
// 各模块按 root 内实际存在的元素自行分派（见各 sections/shapes-*.js 的 init），
// 所以这里统一传 document —— 少一个 section 就会静默少渲染一块。
import { init as initPipeline } from './sections/shapes-pipeline.js';
import { init as initLab } from './sections/shapes-lab.js';
import { init as initRings } from './sections/shapes-rings.js';
import { init as initTables } from './sections/shapes-tables.js';

const data = await fetch('js/vendor/shape-data.json').then((r) => r.json());

initPipeline(document, data);   // 01 流水线 / 03 分组画廊 / 04 凸包约束
initLab(document, data);        // 02 实验室 + 对账
initRings(document, data);      // 05 环结构 / 06 球链
initTables(document, data);     // 07 seat / 08 速查表

// 滚动进场
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduced) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('inview'); io.unobserve(e.target); }
    }
  }, { threshold: 0.08 });
  document.querySelectorAll('.sec-single').forEach((el) => {
    el.classList.add('reveal'); io.observe(el);
  });
}
document.documentElement.classList.add('js-ready');
