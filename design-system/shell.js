/* ============================================================
   GrokBot 解剖 · 共享骨架行为
   所有页面引入：<script type="module" src="design-system/shell.js">
   负责：主题切换、页内 TOC 滚动高亮、代码块复制、滚动进场
   ============================================================ */

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
      btn.textContent = "已复制";
      setTimeout(() => (btn.textContent = "复制"), 1500);
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
initToc();
initCodeCopy();
initReveal();
