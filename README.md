# GrokBot Avatar Anatomy

[English](README.md) | [中文](README.zh-CN.md)

An interactive explainer page (in Chinese) dissecting how the **Grok Bot** macOS app's avatar animation engine works — and why its procedural-SVG approach beats Lottie, video/GIF, WebGL shaders and CSS animation for a living, interactive character.

The page practices what it preaches: **0 third-party runtime dependencies, 0 build step** — plain HTML + CSS + native ES modules, every demo computed live. The showcase bots (hero, blink, state-machine and gallery sections) run `js/vendor/grok-player.js`, a faithful line-level port of the original engine, driven by `js/vendor/grok-recipes.json` (animation data extracted from the local app).

There's also an **[animation editor](editor.html)** (`/editor.html`): a clip/state editor built on the same engine — visual keyframe tracks (position / rotation / squash / scale / lids / expression), easing and state config (face / morph / next / holdSeconds), live preview in the real engine, and JSON export in the engine's native format.

## Live demo / Run

GitHub Pages: **https://arvinyin1.github.io/grokbot-avatar-anatomy/**

Or run locally (ES modules require HTTP, don't open the file directly):

```bash
python3 -m http.server 8000
# open http://127.0.0.1:8000/
```

## What's inside

- **Every frame is computed** — procedural SVG + a DOM-diff writer, with a live attribute panel
- **Shape morph: radial outline interpolation** — 192 ray samples, per-angle lerp, sampling-density comparison
- **Springs, not timers** — a 120 Hz semi-implicit Euler integrator playground vs ease-out
- **Pseudo-3D: the eyes live on a sphere** — Rodrigues rotation + orthographic projection, flat-vs-sphere comparison
- **Blinks & liveliness** — blinks are clip-embedded keyframe events (0.26 s, closed at 45%) + imperative `blink()`; no ambient scheduler exists in the original bundle
- **State machine & recipe shuffle** — 53 states, seeded-PRNG clip shuffle with random phase; showcase runs the ported original engine
- **State gallery** — all 53 states running live engine instances on one page, filterable by the five lifecycle groups, click to poke
- **Head-to-head comparison** — procedural SVG vs Lottie vs video/GIF vs WebGL vs CSS, plus a decision wizard

## Source

All findings come from static analysis of the unpacked `app.asar` of Grok Bot (Electron, macOS), for study and research only. `js/vendor/grok-player.js` is a **re-written port** of the engine logic (line-level, frame-verified against the original); `js/vendor/grok-recipes.json` is **animation data extracted from the local app** (clip keyframes, state registry, expressions, constants). The underlying design and data remain the property of their original owners; this material is published for study only and will be taken down on request. Grok and x.ai trademarks belong to their owners.

See also: [bloub](https://github.com/jeremy-prt/bloub) — another independent recreation, measured frame-by-frame from video.

## License

MIT
