#!/usr/bin/env node
/* i18n 校验：
   - 各 HTML 的 data-i18n / data-i18n-attrs key 必须在 en 词典里（zh 以 HTML 原文为准）
   - js 里 t('...') 的 key 必须同时存在于 zh 和 en 词典
   - 报告 en 词典里没被任何 HTML 用到的 key（防笔误）
   用法：node tools/check-i18n.mjs [page ...]   （不带参数 = 全部 5 页）
*/
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pages = process.argv.slice(2);
const PAGES = pages.length ? pages : ["index", "shapes", "workshop", "editor", "glow"];

const zh = (await import(new URL("../js/i18n/zh.js", import.meta.url))).default;
const en = (await import(new URL("../js/i18n/en.js", import.meta.url))).default;

let errors = 0;
const err = (msg) => { console.error("  ✗ " + msg); errors++; };

const usedEnKeys = new Set();

for (const page of PAGES) {
  const file = join(root, page + ".html");
  let html;
  try { html = readFileSync(file, "utf8"); } catch { err(`${page}.html 不存在`); continue; }
  const keys = [];
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) keys.push(m[1]);
  for (const m of html.matchAll(/data-i18n-attrs="([^"]+)"/g))
    for (const pair of m[1].split(";")) {
      const i = pair.indexOf(":");
      if (i > 0) keys.push(pair.slice(i + 1).trim());
    }
  const missing = keys.filter((k) => !(k in en));
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  console.log(`${page}.html: ${keys.length} 个 key，en 缺失 ${missing.length}`);
  missing.forEach((k) => err(`  en 缺 key: ${k}`));
  dup.forEach((k) => err(`  同页重复 key: ${k}`));
  keys.forEach((k) => usedEnKeys.add(k));
  // meta 必备
  for (const mk of [`${page}.meta.title`, `${page}.meta.description`])
    if (!(mk in en)) err(`  en 缺 ${mk}`);
}

/* js 里的 t('...') key：双语都必须有 */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "vendor" || name === "i18n") continue;
      yield* walk(p);
    } else if (name.endsWith(".js")) yield p;
  }
}
const tKeys = new Map(); // key -> file
for (const f of walk(join(root, "js"))) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?<![\w.])t\(\s*['"]([^'"]+)['"]/g))
    tKeys.set(m[1], relative(root, f));
}
console.log(`js t() key: ${tKeys.size} 个`);
for (const [k, f] of tKeys) {
  if (!(k in zh)) err(`zh 缺 ${k}（${f}）`);
  if (!(k in en)) err(`en 缺 ${k}（${f}）`);
}

/* en 词典里未被使用的 key */
const enFlat = Object.keys(en).filter((k) => !k.startsWith("common.lang"));
for (const k of enFlat)
  if (!usedEnKeys.has(k) && !tKeys.has(k))
    console.warn("  ? en 词典未使用: " + k);

if (errors) { console.error(`\n${errors} 个问题`); process.exit(1); }
console.log("\ni18n 校验通过");
