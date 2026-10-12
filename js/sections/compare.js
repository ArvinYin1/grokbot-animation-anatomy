// 第 7 节：横向对比 + 「我该选哪种」极简决策向导
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
    if (interactive && heavyOk) return '视频/GIF 或 Lottie 都不支持真正的实时交互——推荐程序化 SVG（GrokBotMark 方案）：0 素材、分辨率无关、状态机/视线跟随全由代码驱动。';
    if (interactive) return '推荐程序化 SVG：交互 = 每帧重算，代码即素材；Lottie/视频在此维度上是死的。';
    if (!heavyOk && gpuOk) return '纯展示型华丽动效可选 Lottie（设计稿直出）或 WebGL shader（视觉上限最高）——但代价是素材体积与工具链。';
    if (gpuOk) return '无交互、重视觉：WebGL shader 或视频/GIF 都行；注意视频是像素素材，缩放即糊。';
    return '无 GPU 保底 + 无交互：CSS 动画或 Lottie 最省心；若未来可能要交互，程序化 SVG 仍是天花板最高的路线。';
  }
}
