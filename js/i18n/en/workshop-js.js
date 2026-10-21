// workshop page JS strings (en)
export default {
  // preset buttons
  "workshop.js.preset.hexagon": "Hexagon",
  "workshop.js.preset.square": "Square",
  "workshop.js.preset.triangle": "Triangle",
  "workshop.js.preset.star": "Star",
  "workshop.js.preset.gear": "Gear",
  "workshop.js.preset.cloud": "Cloud",
  "workshop.js.preset.drop": "Teardrop",
  "workshop.js.preset.shield": "Shield",

  // convexity verdict
  "workshop.js.verdict.concave1": "Concave shape · the hull would swallow ",
  "workshop.js.verdict.concave2": " of the area",
  "workshop.js.verdict.concave3": "→ must use ",
  "workshop.js.verdict.concave4": " or ",
  "workshop.js.verdict.concave5": ", never ",
  "workshop.js.verdict.convex1": "Convex shape · hull/area ratio ",
  "workshop.js.verdict.convex2": "→ ",
  "workshop.js.verdict.convex3": " works; extrusion / loft are fine too",

  // generated registration code: block titles + copy button
  "workshop.js.code.h1": "① Mv — path generator",
  "workshop.js.code.h2": "② Iv — descriptor (incl. seat)",
  "workshop.js.code.h3": "③ iS — 3D solid (optional, isProof lighting only)",
  "workshop.js.code.h4": "④ recipes — shapes.names + eyeMetrics",
  "workshop.js.code.h5": "⑤ UI — shape list + alias + trilingual copy",
  "workshop.js.copy": "Copy",
  "workshop.js.copied": "Copied",
  "workshop.js.code.regular": "regular polygon → one-liner",
  "workshop.js.code.freeVerts": "free vertices → ac(points, corner radii)",
  "workshop.js.code.ivSolid": "convex → solid (simplest)",
  "workshop.js.code.seatWrap": "seat is wrap type: eyes wrap around the cylinder",
  "workshop.js.code.ivExtr": "concave + thickness → extrusion",
  "workshop.js.code.flatFront": "← flat front face",
  "workshop.js.code.ivLoft": "concave + puffy → loft",
  "workshop.js.code.hugLoft": "← eyes hug the loft surface",
  "workshop.js.code.orMoon": "or: moon",
  "workshop.js.code.namesWarn": "← forget this and it silently becomes a ball!",
  "workshop.js.code.copyMetrics": "copy from a similar shape; mainly tune shiftY",
  "workshop.js.code.pickerList": "the shape picker list",
  "workshop.js.code.uiToEngine": "UI name → engine name",
};
