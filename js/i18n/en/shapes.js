export default {
  "shapes.meta.title": "Shape system — GrokBot Anatomy",
  "shapes.meta.description": "How Grok Bot's 25 avatar shapes are implemented: parametric path generators → shape descriptors → three outline algorithms (convex hull / extrusion / loft). All findings come from reverse-engineering the unpacked app.asar.",

  "shapes.theme.toggleAria": "Toggle theme",
  "shapes.toc.ariaLabel": "On this page",

  "shapes.hero.eyebrow": "Analysis · Shape system",
  "shapes.hero.title": "How 25 avatar shapes are made",
  "shapes.hero.lede": "They are not 25 hand-drawn images, but <strong>25 parameter sets</strong> + <strong>4 tables</strong> + <strong>3 outline algorithms</strong>. And there is one verifiable hard constraint: <strong>one class of shapes can never be concave.</strong> Every section below has a live demo.",
  "shapes.hero.badgeShapes": "25 shapes",
  "shapes.hero.badgeSilhouettes": "3 silhouettes",
  "shapes.hero.badgeExceptions": "0 exceptions",

  "shapes.pipeline.title": "Overview: a five-stage pipeline",
  "shapes.pipeline.lede": "Click any stage to see what it owns. <strong>The key is stage 5</strong>: the same shape descriptor is dispatched to one of three outline algorithms, and which one determines whether the shape can be concave.",
  "shapes.pipeline.keynote": "<b>In short:</b> a shape = a parametric path → a descriptor (<code>silhouette</code> + <code>seat</code>) → handed to <code>Zv()</code>, which dispatches by kind to <b>convex hull / inter-ring quads / ring stitching</b>.",

  "shapes.primitives.title": "A shape = two or three numbers + 4 primitives",
  "shapes.primitives.lede": "In the <code>Mv</code> table, each shape is a function that eats just 2–3 numbers. A hexagon only needs “radius / sides / corner radius”, a cloud only needs “5 circles”, and the squircle and the gem are <strong>the same formula with a different exponent</strong>.",
  "shapes.primitives.code": `// Mv table: one generator per shape, only 2-3 numbers each
hex:      () =&gt; eh(114, 6, 20, Math.PI/6)       // regular n-gon + corner radius
cloud:    () =&gt; th([[x-62,x+26,56], [x+62,x+26,54], [x,x+34,62],
                     [x-24,x-30,62], [x+38,x-26,54]])   // union of 5 circles
squircle: () =&gt; El(107, 107, 3.2)               // superellipse |x/a|ⁿ+|y/b|ⁿ=1
gem:      () =&gt; El(112, 113, 1.5)               // same formula, different exponent
egg:      () =&gt; av(98, 113, .22)
house:    () =&gt; lv(100, 110, 78, 29)
heart:    () =&gt; "M79.4511 11.5693C94.8767…"     // the only hand-written one`,
  "shapes.primitives.keynote": "<b>The 4 base primitives:</b> <code>ev</code> (Catmull-Rom smooth closed curve) · <code>ac</code> (rounded polygon, <b>corner radius settable per vertex</b>) · <code>ar</code> (polar-function sampling) · <code>th</code> (outline of a circle union). Named shapes like <code>eh</code> / <code>El</code> / <code>uv</code> / <code>lv</code> are all composed from these.",
  "shapes.primitives.labTitle": "Lab: drag the sliders, watch the shape change",
  "shapes.primitives.labLede": "Pick a shape on the left and drag its parameters; the right side redraws in real time — all computed with the engine's primitive formulas.",
  "shapes.primitives.reconTitle": "Reconciliation: formula output vs the app's real output",
  "shapes.primitives.reconLede": "Left column: real outlines extracted after <strong>directly importing the original bundle and calling its own render functions</strong>. Right column: a redraw of the same formula. The poses differ — the app's output carries the <strong>rest-pose rotation + 3D projection</strong> (which is why squares look skewed) — but the shape is the same.",

  "shapes.silhouette.title": "Three silhouettes → three outline algorithms",
  "shapes.silhouette.lede": "The descriptor's <code>silhouette.kind</code> has only three possible values, and <code>Zv()</code> dispatches on it. This is the most critical branch in the whole design:",
  "shapes.silhouette.code": `function Zv(silhouette, view) {
  if (silhouette.kind === "loft")  return [eS(silhouette.rings, view)];   // rings → stitch
  if (silhouette.kind === "solid") return [Qv(silhouette, view)];         // point cloud → convex hull
  // extrusion: project ring by ring, connect rings with quads
  const n = silhouette.rings.map(r =&gt; r.map(view.project));
  s.push([a[u], a[l], c[l], c[u]]);
}`,
  "shapes.silhouette.galleryTitle": "The 25 shapes grouped by algorithm",
  "shapes.silhouette.galleryLede": "Green badge = convex, orange = concave. Look at the first group — <strong>not a single concave shape</strong>.",
  "shapes.silhouette.keynote": "<b>But watch the direction.</b> “Concave ⟹ cannot use solid” holds; the converse, “convex ⟹ must use solid”, <b>does not</b>. Three shapes in the data (<code>hex</code> / <code>square</code> / <code>house</code>) measure convex yet still go through <code>extrusion</code> — because the author built them with the “rounded polygon + thickness” family (<code>Bn()</code>). So convexity sets a <b>lower bound</b>, not a unique answer.",

  "shapes.hull.title": "Key insight: the convex hull “eats” concavity",
  "shapes.hull.lede": "The light outline is what the app really renders. Flip the toggle to see what happens when it is fed to <code>solid</code>'s convex-hull algorithm.",
  "shapes.hull.modeReal": "Real outlines (extrusion / loft)",
  "shapes.hull.modeHull": "If fed to solid's convex hull",
  "shapes.hull.keynote": "<b>This is the verifiable hard constraint:</b> <code>solid</code>'s outline algorithm is a convex hull (<code>pi()</code>, Andrew's monotone chain), and a convex hull can mathematically never produce concavity. So any shape that needs a notch or a dent <b>must</b> go through <code>extrusion</code> or <code>loft</code> by design — no error is raised; the shape is just silently wrong.",

  "shapes.rings.title": "How rings are built",
  "shapes.rings.lede": "Outside the <code>solid</code> family, the other two algorithms first build a stack of <strong>rings</strong> and then project them. The two formula sets are entirely different — drag the sliders to watch the ring stack deform.",
  "shapes.rings.extrusionSub": "beveled extrusion · <code>Nv()</code>",
  "shapes.rings.halfDepth": "half depth",
  "shapes.rings.bevel": "bevel",
  "shapes.rings.extrusionCode": `// shrink the outline toward its center while stepping along ±z
p = f/Ar*(Math.PI/2);            // Ar = 4
z     = ±(halfDepth - bevel + bevel*sin(p))
scale = 1 - bevel/u*(1 - cos(p))  // u = minor semi-axis`,
  "shapes.rings.loftSub": "loft · <code>zv()</code>",
  "shapes.rings.depth": "depth",
  "shapes.rings.rh": "falloff exponent rh",
  "shapes.rings.loftCode": `// tapers to a point at both poles; cos^rh sets how “puffy”
d     = -PI/2 + PI*l/$l;      // $l = 16
scale = max(0, cos(d))^rh
z     = depth * sin(d)
// at d = ±PI/2, scale = 0 → collapses to a point`,
  "shapes.rings.keynote": "<b>The division of labor:</b> <code>extrusion</code> has <b>explicit thickness</b> with beveled, rounded edges (square, hexagon, star, gear, house); <code>loft</code> is fattest at the equator and tapers to a point at both poles, like a pillow / cloud / heart. Which one a concave shape picks depends on whether you want “a slab” or “a pouch”.",

  "shapes.balls.title": "The ball-chain family: bean / tablet / capsule",
  "shapes.balls.lede": "These three <strong>generate no path at all</strong> — they use a chain of balls as the silhouette (<code>silhouette.balls</code>, with <code>samples</code> left empty) and derive the union boundary via <strong>ray–circle intersection</strong>. So they also belong to the <code>solid</code> family and can only be convex.",
  "shapes.balls.tabletSub": "a chain of balls along an axis · <code>jl()</code> · <code>Rl = 33</code>",
  "shapes.balls.tabletCode": `function jl(name, axis) {
  for (f = 0; f &lt; 33; f++) {
    h = lo + (hi-lo) * (f/32);
    push(axis === "x" ? [h,0,0,c] : [0,h,0,c]);
  }   // radius c = minor semi-axis
}`,
  "shapes.balls.tabletNote": "The engine uses 33 balls; the figure draws 11 so the “chain of balls” stays readable. The main axis is found with PCA, so the chain follows the shape's own long axis.",
  "shapes.balls.beanSub": "maximal inscribed balls · <code>Lv()</code>",
  "shapes.balls.beanCode": `function Lv(name) {
  for (grid point p of bounding box) {
    if (!insideOutline(p)) continue;
    r = min(distance to each outline edge);
    if (r &gt; step) keep(p, r);
  }
  // sort by radius descending, greedily drop balls covered by bigger ones
}`,
  "shapes.balls.beanNote": "Runs the inscribed-ball algorithm on the app's real outline; grid step = max dimension / 40.",
  "shapes.balls.outlineTitle": "How the outline is computed from balls",
  "shapes.balls.outlineCode": `// Qv(): sweep a ring of directions; per direction take the farthest intersection across all balls = union boundary
for (const dir of DIRECTIONS) {
  let best = 0;
  for (const ball of balls) {
    d = dir·(ball.c - center);
    g = d*d - |ball.c - center|² + ball.r²;
    if (g &lt;= 0) continue;            // this ray misses this ball
    best = max(best, d + sqrt(g));   // farthest intersection
  }
  outline.push(center + dir * best);
}`,

  "shapes.seat.title": "Where the eyes land on the shape's surface: <code>seat</code>",
  "shapes.seat.lede": "Once the outline is done, the eyes still have to “stick” onto it — the descriptor's third field, <code>seat</code>, does exactly that. <strong>This is why the eyes never float outside the body when you switch shapes.</strong>",
  "shapes.seat.colKind": "kind",
  "shapes.seat.colField": "fields",
  "shapes.seat.colMeaning": "meaning",
  "shapes.seat.colUsedBy": "used by",
  "shapes.seat.note": "Ball-chain shapes additionally carry <code>puffAt</code>, so the eyes can also hug the dents between balls.",

  "shapes.ref.title": "Cheat sheet",
  "shapes.ref.lede": "The full dispatch table for all 25 shapes. The <strong>convex/concave</strong> and <strong>hull loss</strong> columns are measured — computed by running a convex hull over outlines the app renders itself, not copied from anywhere.",
  "shapes.ref.colShape": "shape",
  "shapes.ref.colEngine": "engine name",
  "shapes.ref.colGenerator": "Mv generator",
  "shapes.ref.colSilhouette": "silhouette",
  "shapes.ref.colAlgorithm": "outline algorithm",
  "shapes.ref.colSeat": "seat",
  "shapes.ref.colSize": "size",
  "shapes.ref.colConvex": "convex?",
  "shapes.ref.colHullLoss": "hull loss",

  "shapes.sources.title": "Data sources &amp; self-checks",
  "shapes.sources.item1": "<strong>25 real outlines</strong>: path data extracted after rendering with the original bundle's own render functions (<code>jE</code>/<code>a6</code>), imported directly — so they carry the engine's rest-pose rotation and 3D projection.",
  "shapes.sources.item2": "<strong>Convexity and hull loss</strong>: Andrew's monotone-chain hull over each outline, compared by area — the numbers on this page are computed live.",
  "shapes.sources.item3": "<strong>Geometry layer</strong>: <code>js/lib-shapes.js</code> is a function-by-function port of the original bundle (<code>gn</code>/<code>ev</code>/<code>ar</code>/<code>ac</code>/<code>eh</code>/<code>th</code>/<code>El</code>/<code>pi</code>/<code>Nv</code>/<code>zv</code>).",
  "shapes.sources.item4": "<strong>Reconciliation</strong>: the radial-profile residuals in section 02 are also computed live on the page — using rotation/scale-invariant metrics to confirm that each formula hugs its own target shape.",
  "shapes.sources.footnote": "The shape system is only half of this engine; the other half is <strong>animation</strong> (springs, clip Béziers, state machines, blinking). See the <a href=\"index.html\">overview page</a>. Want to add your own shape → <a href=\"workshop.html\">Shape Workshop</a>.<br>All findings in this article come from reverse-engineering the unpacked app.asar of Grok Bot (Electron, macOS); design and data copyrights belong to their original owners. For study and research only.",

  "shapes.footer": "GrokBot Anatomy · reverse-engineering notes · every graphic on this page is procedurally generated · <a href=\"workshop.html\">Shape Workshop →</a>",

  "shapes.toc.pipeline": "Pipeline overview",
  "shapes.toc.primitives": "Primitive lab",
  "shapes.toc.silhouette": "Three outline algorithms",
  "shapes.toc.hull": "Convex-hull constraint",
  "shapes.toc.rings": "Ring structure",
  "shapes.toc.balls": "Ball-chain family",
  "shapes.toc.seat": "Eye seating",
  "shapes.toc.ref": "Cheat sheet",
  "shapes.toc.sources": "Data sources",
};
