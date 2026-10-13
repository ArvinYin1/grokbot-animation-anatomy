// 第 7 节：状态陈列馆 —— 53 个状态全部跑真引擎（grok-player + 提取数据）
// 数据只 fetch 一次，通过 opts.data 共享给全部实例；离屏/被过滤的卡片由引擎
// 内置 IntersectionObserver 自动休眠。点击卡片 = poke('bounce')。
import { createGrokBot } from '../vendor/grok-player.js';

const ZH = {
  idle: '待机', listening: '聆听', thinking: '思考', streaming: '输出中', searching: '搜索中',
  reading: '阅读中', working: '工作中', coding: '写代码', running: '运行中', computing: '计算中',
  controlling: '控制中', waiting: '等待', blocked: '受阻', finished: '完成', failed: '失败',
  sleeping: '睡眠', waking: '苏醒', happy: '开心', excited: '兴奋', laughing: '大笑',
  proud: '得意', curious: '好奇', playful: '顽皮', shy: '害羞', surprised: '惊讶',
  suspicious: '怀疑', angry: '生气', confused: '困惑', sad: '难过', drowsy: '困倦',
  bored: '无聊', scared: '害怕', celebrate: '庆祝', approving: '认可', orbit: '轨道',
  radar: '雷达', progress: '进度', spawning: '生成中', loading: '加载中', dictating: '听写',
  sending: '发送中', receiving: '接收中', uploading: '上传中', writing: '书写中', alerting: '警报',
  bouncing: '弹跳', 'powering-down': '关机中', humming: '哼歌', notifying: '通知',
  dragging: '拖拽', logo: '标志', showcase: '展示', turntable: '转台',
};
const GROUP_ZH = { Lifecycle: '生命周期', Reactions: '表情反应', Morphs: '变形装饰', Product: '产品', Brand: '品牌' };
const SIZE = 96;

function tagsOf(def) {
  const tags = [];
  if (def.face) tags.push(`表情 ${def.face}`);
  if (def.morph) tags.push(`装饰 ${def.morph}`);
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
      const groups = [['all', `全部 ${Object.keys(states).length}`],
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
