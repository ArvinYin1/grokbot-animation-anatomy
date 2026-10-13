# GrokBot 头像动画解剖

[English](README.md) | [中文](README.zh-CN.md)

一个面向开发者的中文交互式长页，讲解 macOS 应用 **Grok Bot**（Electron）中 bot 头像动画引擎的实现原理，以及程序化 SVG 方案相对于 Lottie / 视频 / WebGL shader / CSS 动画的优势。

页面本身即是对这套哲学的实践：**0 第三方运行时依赖、0 构建**，纯 HTML + CSS + 原生 ES modules，所有 demo 实时计算。showcase 位置的 bot（hero、第 05/06 节）运行的是 `js/vendor/grok-player.js`——原版引擎的逐行移植，由 `js/vendor/grok-recipes.json`（从本机 app 提取的动画数据）驱动。

## 在线预览 / 运行

GitHub Pages：**https://arvinyin1.github.io/grokbot-avatar-anatomy/**

或本地运行（ES modules 需要通过 HTTP 访问，不能直接双击打开 index.html）：

```bash
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/
```

## 内容

- **每帧都是算出来的** — 程序化 SVG + DOM diff 写入器，实时属性面板
- **形状 morph：径向轮廓插值** — 192 条射线采样，逐角度 lerp，采样密度对比
- **弹簧，不是定时器** — 120Hz 半隐式欧拉积分器游乐场，对比 ease-out
- **伪 3D：眼睛真的在球面上** — 罗德里格斯旋转 + 正交投影，平面贴眼穿帮对比
- **眨眼与生命感** — 眨眼是 clip 内嵌关键帧事件（0.26s、45% 闭合）+ 命令式 blink()；原 bundle 中不存在环境调度器
- **状态机与 recipe 洗牌** — 53 状态、种子化 PRNG clip 洗牌、随机相位；showcase 运行移植的原版引擎
- **横向对比** — 程序化 SVG vs Lottie vs 视频/GIF vs WebGL vs CSS + 选型向导

## 来源

文中结论来自对 Grok Bot（Electron, macOS）`app.asar` 解包后的静态分析，仅供学习研究。`js/vendor/grok-player.js` 为引擎逻辑的**移植重写**（逐行级，与原引擎逐帧数值验证一致）；`js/vendor/grok-recipes.json` 为**从本机 app 提取的动画数据**（clip 关键帧、状态注册表、表情库、常量）。相关设计与数据的版权归原所有者所有；本材料仅供学习研究，随时应要求下架。Grok 与 x.ai 相关商标归其所有者。

另见：[bloub](https://github.com/jeremy-prt/bloub) — 另一份基于视频逐帧测量的独立复刻。

## License

MIT
