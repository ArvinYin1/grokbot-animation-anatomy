// workshop 页 JS 字符串（zh 原文）
export default {
  // 预设按钮
  "workshop.js.preset.hexagon": "六边形",
  "workshop.js.preset.square": "正方形",
  "workshop.js.preset.triangle": "三角形",
  "workshop.js.preset.star": "五角星",
  "workshop.js.preset.gear": "齿轮",
  "workshop.js.preset.cloud": "云朵",
  "workshop.js.preset.drop": "水滴",
  "workshop.js.preset.shield": "盾牌",

  // 凸性判定
  "workshop.js.verdict.concave1": "形状有凹 · 凸包会吃掉 ",
  "workshop.js.verdict.concave2": " 的面积",
  "workshop.js.verdict.concave3": "→ 必须用 ",
  "workshop.js.verdict.concave4": " 或 ",
  "workshop.js.verdict.concave5": "，不能用 ",
  "workshop.js.verdict.convex1": "形状是凸的 · 凸包面积比 ",
  "workshop.js.verdict.convex2": "→ ",
  "workshop.js.verdict.convex3": " 可以用，也可以走 extrusion / loft",

  // 生成的 5 处注册代码：块标题 + 复制按钮
  "workshop.js.code.h1": "① Mv —— 路径生成器",
  "workshop.js.code.h2": "② Iv —— 描述符（含 seat）",
  "workshop.js.code.h3": "③ iS —— 3D 实体（可选，只给 isProof 光照用）",
  "workshop.js.code.h4": "④ recipes —— shapes.names + eyeMetrics",
  "workshop.js.code.h5": "⑤ UI —— 形状清单 + 别名 + 三语文案",
  "workshop.js.copy": "复制",
  "workshop.js.copied": "已复制",
  "workshop.js.code.regular": "规则多边形 → 一行搞定",
  "workshop.js.code.freeVerts": "自由顶点 → ac(点数组, 圆角)",
  "workshop.js.code.ivSolid": "凸 → solid（最省事）",
  "workshop.js.code.seatWrap": "seat 是 wrap 型：眼睛绕柱面包裹",
  "workshop.js.code.ivExtr": "凹 + 有厚度 → extrusion",
  "workshop.js.code.flatFront": "← 平面正脸",
  "workshop.js.code.ivLoft": "凹 + 鼓起来 → loft",
  "workshop.js.code.hugLoft": "← 眼睛贴放样面",
  "workshop.js.code.orMoon": "或：moon",
  "workshop.js.code.namesWarn": "← 漏了这个会静默变球！",
  "workshop.js.code.copyMetrics": "从相近形状抄，主要调 shiftY",
  "workshop.js.code.pickerList": "选形状面板的清单",
  "workshop.js.code.uiToEngine": "UI 名 → 引擎名",
};
