/* ============================================================
   GrokBot 解剖 · 共享骨架行为
   所有页面引入：<script type="module" src="design-system/shell.js">
   负责：i18n、主题切换、语言切换、页内 TOC 滚动高亮、代码块复制、滚动进场
   ============================================================ */

import { getLang, setLang, applyI18n, t } from "../js/i18n/i18n.js";

/* ---------- 主题 ---------- */
const THEME_KEY = "gb-theme";
const rootEl = document.documentElement;

export function applyTheme(theme) {
  rootEl.classList.add("theme-anim");
  rootEl.dataset.theme = theme;
  document.querySelectorAll("[data-icon-sun]").forEach(
    el => (el.style.display = theme === "dark" ? "none" : "")
  );
  document.querySelectorAll("[data-icon-moon]").forEach(
    el => (el.style.display = theme === "dark" ? "" : "none")
  );
  setTimeout(() => rootEl.classList.remove("theme-anim"), 300);
}

export function initTheme() {
  // data-theme 已在 <head> 的内联脚本里写入，这里只同步图标并接管后续切换
  const theme = rootEl.dataset.theme || "light";
  document.querySelectorAll("[data-icon-sun]").forEach(
    el => (el.style.display = theme === "dark" ? "none" : "")
  );
  document.querySelectorAll("[data-icon-moon]").forEach(
    el => (el.style.display = theme === "dark" ? "" : "none")
  );
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = rootEl.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  });
}

/* ---------- 语言切换（按钮注入 .topbar__end，切语言 = 刷新页面） ---------- */
export function initLang() {
  const host = document.querySelector(".topbar__end");
  if (!host) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn lang-btn";
  btn.textContent = getLang() === "en" ? "中" : "EN";
  btn.title = t("common.lang.toggle");
  btn.setAttribute("aria-label", t("common.lang.toggle"));
  btn.addEventListener("click", () => setLang(getLang() === "en" ? "zh" : "en"));
  host.prepend(btn);
}

/* ---------- 页内 TOC 滚动高亮 ---------- */
export function initToc() {
  const links = [...document.querySelectorAll(".toc a[href^='#']")];
  if (!links.length) return;
  const sections = links.map(a => document.querySelector(a.hash)).filter(Boolean);
  const spy = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a =>
          a.classList.toggle("is-active", a.hash === "#" + e.target.id)
        );
      });
    },
    { rootMargin: "-20% 0px -70% 0px" }
  );
  sections.forEach(s => spy.observe(s));
}

/* ---------- 代码块复制（.codeblock__copy 约定） ---------- */
export function initCodeCopy() {
  document.querySelectorAll(".codeblock__copy").forEach(btn => {
    btn.addEventListener("click", async () => {
      const pre = btn.closest(".codeblock")?.querySelector("pre");
      if (!pre) return;
      await navigator.clipboard.writeText(pre.innerText).catch(() => {});
      btn.textContent = t("common.copied");
      setTimeout(() => (btn.textContent = t("common.copy")), 1500);
    });
  });
}

/* ---------- 滚动进场（.reveal → .inview） ---------- */
export function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;
  const io = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("inview");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach(el => io.observe(el));
}

initTheme();
applyI18n();
initLang();
initToc();
initCodeCopy();
initReveal();
