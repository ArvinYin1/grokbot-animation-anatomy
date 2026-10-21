// 第 7 节：横向对比 + 「我该选哪种」极简决策向导
import { t } from '../i18n/i18n.js';

export function init(root) {
  const wizard = root.querySelector('.wizard');
  const steps = wizard.querySelectorAll('.wizard-step');
  const result = wizard.querySelector('.wizard-result');
  const resultText = result.querySelector('.verdict');
  const answers = [];

  function show(i) {
    steps.forEach((s, k) => { s.hidden = k !== i; });
    result.hidden = i !== steps.length;
  }

  steps.forEach((step, i) => {
    step.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        answers[i] = btn.dataset.answer === 'yes';
        if (i + 1 <= steps.length) show(i + 1);
        if (i + 1 === steps.length) {
          resultText.textContent = verdict(answers);
        }
      });
    });
  });
  wizard.querySelector('[data-wizard-reset]').addEventListener('click', () => {
    answers.length = 0;
    show(0);
  });
  show(0);

  // answers[0]: 需要实时交互（视线跟随/状态机）？
  // answers[1]: 能接受动辄几百 KB～MB 级素材 + 不可逐帧程序化修改？
  // answers[2]: 目标环境能保证 GPU / 现代浏览器能力？
  function verdict([interactive, heavyOk, gpuOk]) {
    if (interactive && heavyOk) return t('index.js.compare.vInteractiveHeavy');
    if (interactive) return t('index.js.compare.vInteractive');
    if (!heavyOk && gpuOk) return t('index.js.compare.vFlashy');
    if (gpuOk) return t('index.js.compare.vGpu');
    return t('index.js.compare.vFallback');
  }
}
