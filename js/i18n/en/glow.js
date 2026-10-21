/* Glow Lab 页（en）：glow.html 的 data-i18n 词条。 */
export default {
  "glow.meta.title": "Glow Lab — GrokBot Anatomy",
  "glow.meta.description": "The Grok Bot avatar's \"3D sheen\" actually comes from fill parameters: same geometry, same frozen frame — only opts.glow changes. Flat color / 49-stop radial gradient / halo ring / breathing halo, compared in four panels.",

  "glow.hero.eyebrow": "Tools · Glow Lab",
  "glow.hero.title": "The avatar's \"3D sheen\" is just a set of fill parameters",
  "glow.hero.lede": "Same engine, same state, same frozen frame — the four panels share <strong>identical geometry</strong>, and every body is the same 2D elliptical SVG path (<code>zr(rx, ry, 1)</code>, two half arcs). The only variable is <code>opts.glow</code>: flat fill, radial gradient, halo ring, breathing halo. Change the fill, and the \"3D feel\" appears from nothing.",

  "glow.panels.flatTitle": "Flat fill (engine default)",
  "glow.panels.gradientTitle": "Radial gradient (spherical lighting)",
  "glow.panels.haloTitle": "+ halo ring (full glow path)",
  "glow.panels.haloParams": "Same as above + halo: 0.85 → evenodd ring, radius ×1.055",
  "glow.panels.breathTitle": "Breathing halo (animated midT)",
  "glow.panels.breathParams": "midT = 0.5 + 0.5·sin(t·1000/860), period ≈5.4s",
  "glow.panels.explain": "The first panel is <strong>what actually ships by default</strong>: <code>setGlow()</code> is defined but never called anywhere in the renderer bundle, so the body's fill is a flat <code>#0a0a0c</code>. The second turns on <code>TT()</code>: 49 stops (<code>offset = 1-(1-u/48)²</code>, denser toward the edge), <code>AT()</code> runs a double smoothstep between inner→mid→rim, then multiplies by the edge-darkening term <code>0.9+0.1(1-t²)^0.225</code> — measured <code>#f0f2ff</code> at the center → <code>#171c2e</code> at the rim. The third adds an evenodd ring at radius <code>×(1+0.055)</code>: 12 stops (dd=11) in the rim color, opacity fading outward from the halo value — rim light. The fourth is alive: the runtime rewrites <code>midT</code> every frame, so the mid color rolls across the sphere — this is what reads as \"a light is shining on it\".",

  "glow.conclusion": "<b>Conclusion:</b> the body is not a 3D mesh; it is <code>zr(rx, ry, 1)</code> — an SVG ellipse made of two half arcs. The 3D feel comes 100% from the <code>body</code>'s <b>fill</b>: a 49-stop radial gradient plus an evenodd ring at radius ×1.055. Real spherical math is used only for the <b>eyes</b> (Rodrigues rotation + front-hemisphere clipping + orthographic projection).",

  "glow.footer.note": "GrokBot Anatomy · Reverse-engineering notes · All graphics on this page are procedurally generated · <a href=\"shapes.html\">Shape System →</a>",
};
