// 第 7 节：状态陈列馆 —— 53 个状态全部跑真引擎（grok-player + 提取数据）
// 数据只 fetch 一次，通过 opts.data 共享给全部实例；离屏/被过滤的卡片由引擎
// 内置 IntersectionObserver 自动休眠。点击卡片 = poke('bounce')。
import { createGrokBot } from '../vendor/grok-player.js';
import { t } from '../i18n/i18n.js';

const ZH = {
  idle: t('index.js.gallery.name.idle'), listening: t('index.js.gallery.name.listening'),
  thinking: t('index.js.gallery.name.thinking'), streaming: t('index.js.gallery.name.streaming'),
  searching: t('index.js.gallery.name.searching'), reading: t('index.js.gallery.name.reading'),
  working: t('index.js.gallery.name.working'), coding: t('index.js.gallery.name.coding'),
  running: t('index.js.gallery.name.running'), computing: t('index.js.gallery.name.computing'),
  controlling: t('index.js.gallery.name.controlling'), waiting: t('index.js.gallery.name.waiting'),
  blocked: t('index.js.gallery.name.blocked'), finished: t('index.js.gallery.name.finished'),
  failed: t('index.js.gallery.name.failed'), sleeping: t('index.js.gallery.name.sleeping'),
  waking: t('index.js.gallery.name.waking'), happy: t('index.js.gallery.name.happy'),
  excited: t('index.js.gallery.name.excited'), laughing: t('index.js.gallery.name.laughing'),
  proud: t('index.js.gallery.name.proud'), curious: t('index.js.gallery.name.curious'),
  playful: t('index.js.gallery.name.playful'), shy: t('index.js.gallery.name.shy'),
  surprised: t('index.js.gallery.name.surprised'), suspicious: t('index.js.gallery.name.suspicious'),
  angry: t('index.js.gallery.name.angry'), confused: t('index.js.gallery.name.confused'),
  sad: t('index.js.gallery.name.sad'), drowsy: t('index.js.gallery.name.drowsy'),
  bored: t('index.js.gallery.name.bored'), scared: t('index.js.gallery.name.scared'),
  celebrate: t('index.js.gallery.name.celebrate'), approving: t('index.js.gallery.name.approving'),
  orbit: t('index.js.gallery.name.orbit'), radar: t('index.js.gallery.name.radar'),
  progress: t('index.js.gallery.name.progress'), spawning: t('index.js.gallery.name.spawning'),
  loading: t('index.js.gallery.name.loading'), dictating: t('index.js.gallery.name.dictating'),
  sending: t('index.js.gallery.name.sending'), receiving: t('index.js.gallery.name.receiving'),
  uploading: t('index.js.gallery.name.uploading'), writing: t('index.js.gallery.name.writing'),
  alerting: t('index.js.gallery.name.alerting'), bouncing: t('index.js.gallery.name.bouncing'),
  'powering-down': t('index.js.gallery.name.powering-down'), humming: t('index.js.gallery.name.humming'),
  notifying: t('index.js.gallery.name.notifying'), dragging: t('index.js.gallery.name.dragging'),
  logo: t('index.js.gallery.name.logo'), showcase: t('index.js.gallery.name.showcase'),
  turntable: t('index.js.gallery.name.turntable'),
};
const GROUP_ZH = {
  Lifecycle: t('index.js.gallery.group.lifecycle'),
  Reactions: t('index.js.gallery.group.reactions'),
  Morphs: t('index.js.gallery.group.morphs'),
  Product: t('index.js.gallery.group.product'),
  Brand: t('index.js.gallery.group.brand'),
};
const SIZE = 96;

function tagsOf(def) {
  const tags = [];
  if (def.face) tags.push(`${t('index.js.gallery.tagFace')}${def.face}`);
  if (def.morph) tags.push(`${t('index.js.gallery.tagMorph')}${def.morph}`);
  if (def.next) tags.push(`→ ${def.next}${def.holdSeconds ? ` ${def.holdSeconds}s` : ''}`);
  return tags.join(' · ');
}

export function init(root) {
  const tabsEl = root.querySelector('.gallery-tabs');
  const gridEl = root.querySelector('.gallery-grid');

  fetch('js/vendor/grok-recipes.json')
    .then((r) => r.json())
    .then((recipes) => {
      const { states, lifecycleGroups } = recipes;

      // 分组 tab：全部 + 五个生命周期组
      const groups = [['all', `${t('index.js.gallery.all')} ${Object.keys(states).length}`],
        ...lifecycleGroups.map((g) => [g.label, `${GROUP_ZH[g.label] ?? g.label} ${g.states.length}`])];
      const buttons = groups.map(([key, label], i) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
        b.addEventListener('click', () => {
          buttons.forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          gridEl.querySelectorAll('.g-card').forEach((card) => {
            card.hidden = key !== 'all' && card.dataset.group !== key;
          });
        });
        tabsEl.appendChild(b);
        return b;
      });

      // 卡片：按分组顺序铺开
      for (const g of lifecycleGroups) {
        for (const name of g.states) {
          const def = states[name];
          if (!def) continue;
          const card = document.createElement('div');
          card.className = 'g-card';
          card.dataset.group = g.label;
          card.innerHTML =
            `<div class="g-stage"></div>` +
            `<div class="g-name mono">${name}<span class="g-zh">${ZH[name] ?? ''}</span></div>` +
            `<div class="g-tags">${tagsOf(def)}</div>`;
          gridEl.appendChild(card);
          const bot = createGrokBot(card.querySelector('.g-stage'), {
            size: SIZE, state: name, seed: `gallery-${name}`, data: recipes,
          });
          card.addEventListener('click', () => bot.poke('bounce'));
        }
      }
    });
}
