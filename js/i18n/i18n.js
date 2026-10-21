/* ============================================================
   运行时 i18n：词典 + data-i18n 标注，零构建。
   - 中文（zh）是 HTML 里的原文，不进词典；lang=zh 时不动 DOM
   - 英文（en）从词典替换；缺 key 时保留中文原文，不会显示 key
   - JS 生成的字符串两种语言都走 t()，所以 JS 词典 zh/en 都要写
   用法：
   - 元素文本/内联 HTML：<p data-i18n="index.hero.lede">中文原文</p>
   - 属性：<button data-i18n-attrs="title:common.copy;aria-label:common.copy">
   - JS：import { t } from './i18n/i18n.js'; t('editor.js.play')
   新增语言 = 在 DICTS 里加一本词典。
   ============================================================ */

import zh from "./zh.js";
import en from "./en.js";

const DICTS = { zh, en };
const KEY = "gb-lang";
const SVG_NS = "http://www.w3.org/2000/svg";

export function getLang() {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(KEY, lang === "en" ? "en" : "zh");
  } catch { /* 隐私模式：切换仍然生效一次 */ }
  location.reload();
}

export function has(key) {
  const d = DICTS[getLang()] || zh;
  return key in d || key in zh;
}

export function t(key) {
  const d = DICTS[getLang()] || zh;
  return d[key] ?? zh[key] ?? key;
}

export function applyI18n(root = document) {
  const lang = getLang();
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  if (lang === "zh") return; // 中文即 HTML 原文

  for (const el of root.querySelectorAll("[data-i18n]")) {
    const key = el.dataset.i18n;
    if (!has(key)) continue; // 缺译保留中文原文
    const v = t(key);
    if (el.namespaceURI === SVG_NS) el.textContent = v;
    else el.innerHTML = v;
  }
  for (const el of root.querySelectorAll("[data-i18n-attrs]")) {
    for (const pair of el.dataset.i18nAttrs.split(";")) {
      const i = pair.indexOf(":");
      if (i < 0) continue;
      const attr = pair.slice(0, i).trim();
      const key = pair.slice(i + 1).trim();
      if (attr && key && has(key)) el.setAttribute(attr, t(key));
    }
  }
  const page = document.documentElement.dataset.page;
  if (page) {
    if (has(`${page}.meta.title`)) document.title = t(`${page}.meta.title`);
    const desc = document.querySelector('meta[name="description"]');
    if (desc && has(`${page}.meta.description`))
      desc.setAttribute("content", t(`${page}.meta.description`));
  }
}
