# GrokBot 头像动画解剖

[English](README.md) | [中文](README.zh-CN.md)

一个面向开发者的中文交互式长页，逆向解剖 macOS 应用 **Grok Bot**（Electron）的 **bot 头像动画引擎**：它如何不依赖任何动画库完成全部角色动画，以及程序化 SVG 方案相对于 Lottie / 视频 / WebGL shader / CSS 动画的优势。

页面本身即是对这套哲学的实践：**0 第三方运行时依赖、0 构建**，纯 HTML + CSS + 原生 ES modules，所有 demo 实时计算。showcase 位置的 bot（hero、第 01/03/05/07/08 节）运行的是 `js/vendor/grok-player.js`——原版引擎的逐行移植，由 `js/vendor/grok-recipes.json`（从本机 app 提取的动画数据）驱动。

另有 **[动画编辑器](editor.html)**（`/editor.html`）：基于同一引擎的 clip/状态编辑器——可视化编辑关键帧轨道（position / rotation / squash / scale / lids / expression）、缓动与状态配置（face / morph / next / holdSeconds），真引擎实时预览，导出与原引擎同构的 JSON。

## 在线预览 / 运行

GitHub Pages：**https://arvinyin1.github.io/grokbot-animation-anatomy/**

或本地运行（ES modules 需要通过 HTTP 访问，不能直接双击打开 index.html）：

```bash
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/
```

## 内容

- **每帧都是算出来的** — 程序化 SVG + DOM diff 写入器，实时属性面板
- **形状 morph：径向轮廓插值** — 192 条射线采样，逐角度 lerp，采样密度对比
- **编排用贝塞尔：clip 关键帧** — 28 条手工 clip × 6 轨道，三次贝塞尔缓动允许超界过冲；可拖曲线游乐场 + 与真引擎同步的活 clip 轨道检视
- **弹簧，不是定时器** — 120Hz 半隐式欧拉积分器游乐场，对比 ease-out
- **弹簧用在哪** — amount / swap / spin 三弹簧在状态切换中的实时实测曲线
- **伪 3D：眼睛真的在球面上** — 罗德里格斯旋转 + 正交投影，平面贴眼穿帮对比
- **眨眼与生命感** — 眨眼是 clip 内嵌关键帧事件（0.26s、45% 闭合）+ 命令式 blink()；原 bundle 中不存在环境调度器
- **状态机与 recipe 洗牌** — 53 状态、种子化 PRNG clip 洗牌、随机相位；附切换解剖时间线（贝塞尔 bridge vs 弹簧实测）
- **状态陈列馆** — 53 个状态同页全部跑真引擎实例，按五个生命周期分组筛选，点击可 poke
- **横向对比** — 程序化 SVG vs Lottie vs 视频/GIF vs WebGL vs CSS + 选型向导

## 来源

文中结论来自对 Grok Bot（Electron, macOS）`app.asar` 解包后的静态分析，仅供学习研究。`js/vendor/grok-player.js` 为引擎逻辑的**移植重写**（逐行级，与原引擎逐帧数值验证一致）；`js/vendor/grok-recipes.json` 为**从本机 app 提取的动画数据**（clip 关键帧、状态注册表、表情库、常量）。相关设计与数据的版权归原所有者所有；本材料仅供学习研究，随时应要求下架。Grok 与 x.ai 相关商标归其所有者。

另见：[bloub](https://github.com/jeremy-prt/bloub) — 另一份基于视频逐帧测量的独立复刻。

## License

MIT
