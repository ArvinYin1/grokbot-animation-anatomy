# GrokBot Avatar Anatomy

[English](README.md) | [中文](README.zh-CN.md)

An interactive explainer page (in Chinese) dissecting how the **Grok Bot** macOS app's avatar animation engine works — and why its procedural-SVG approach beats Lottie, video/GIF, WebGL shaders and CSS animation for a living, interactive character.

The page practices what it preaches: **0 dependencies, 0 build step, 0 asset bytes** — plain HTML + CSS + native ES modules, every demo computed live.

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
- **Blinks & liveliness** — seeded-PRNG blink schedule, deterministic yet organic
- **State machine & recipe shuffle** — 40+ states, keyframed clips shuffled with random phase
- **Head-to-head comparison** — procedural SVG vs Lottie vs video/GIF vs WebGL vs CSS, plus a decision wizard

## Source

All findings come from static analysis of the unpacked `app.asar` of Grok Bot (Electron, macOS), for study and research only. This project contains **no code or assets from the original app** — every demo is an independent reimplementation. Grok and x.ai trademarks belong to their owners.

See also: [bloub](https://github.com/jeremy-prt/bloub) — another independent recreation, measured frame-by-frame from video.

## License

MIT
