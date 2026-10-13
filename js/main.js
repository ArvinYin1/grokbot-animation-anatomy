// main.js — 装配 hero 与各版块
import { createGrokBot } from './vendor/grok-player.js';
import { init as initSvg } from './sections/svg-pipeline.js';
import { init as initMorph } from './sections/morph.js';
import { init as initSpring } from './sections/spring.js';
import { init as initSphere } from './sections/sphere.js';
import { init as initBlink } from './sections/blink.js';
import { init as initStates } from './sections/states.js';
import { init as initGallery } from './sections/gallery.js';
import { init as initCompare } from './sections/compare.js';

// Hero：原版引擎移植（grok-player）+ 原版提取的动画数据，视线跟随鼠标
createGrokBot(document.querySelector('.hero-stage'), { size: 300, state: 'idle', follow: true, seed: 'hero' });

// 各版块
initSvg(document.querySelector('#sec-svg'));
initMorph(document.querySelector('#sec-morph'));
initSpring(document.querySelector('#sec-spring'));
initSphere(document.querySelector('#sec-sphere'));
initBlink(document.querySelector('#sec-blink'));
initStates(document.querySelector('#sec-states'));
initGallery(document.querySelector('#sec-gallery'));
initCompare(document.querySelector('#sec-compare'));

// 滚动进场（reduced-motion 时直接全部可见）
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduced) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('inview'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('.section, .hero-inner').forEach((el) => {
    el.classList.add('reveal');
    io.observe(el);
  });
}

document.documentElement.classList.add('js-ready');
