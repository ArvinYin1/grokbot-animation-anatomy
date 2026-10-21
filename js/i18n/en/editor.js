/* 动画编辑器页（en）：editor.html 的 data-i18n / data-i18n-attrs 译文。
   侧栏/顶栏用 common.* 共享词条，不在这里重复。 */
export default {
  "editor.meta.title": "Animation Editor — GrokBot Anatomy",
  "editor.meta.description": "Clip / state animation editor based on the Grok Bot avatar engine (grok-player port): timeline keyframe editing with real-engine live preview.",
  "editor.theme.toggleAria": "Toggle theme",

  "editor.head.eyebrow": "Tools · Animation Editor",
  "editor.head.title": "Animation Editor",
  "editor.head.lede": "Edit clip / state animations on a keyframe timeline with live preview from the real engine (grok-player port); the playhead stays strictly aligned with the clip timeline.",
  "editor.head.hint": "<span class=\"kbd\">Double-click</span> empty lane space to add a keyframe · <span class=\"kbd\">⌘</span>+<span class=\"kbd\">wheel</span> zooms the timeline · <span class=\"kbd\">←</span><span class=\"kbd\">→</span> nudge (<span class=\"kbd\">Shift</span> for faster) · <span class=\"kbd\">⌘C</span>/<span class=\"kbd\">⌘V</span> copy &amp; paste · <span class=\"kbd\">Delete</span> deletes · <span class=\"kbd\">Esc</span> clears selection · <span class=\"kbd\">⌘Z</span> undo · <span class=\"kbd\">⌘⇧Z</span> redo",

  "editor.transport.playTitle": "Space",
  "editor.transport.pauseBtn": "⏸ Pause",
  "editor.transport.follow": "Gaze follow",
  "editor.transport.zoomOutTitle": "Timeline zoom (⌘+wheel)",
  "editor.transport.zoomInTitle": "Timeline zoom (⌘+wheel)",
  "editor.preview.hint": "The preview runs the original engine port (grok-player); the playhead is strictly aligned with the clip timeline (firstPhase = 0). Drag the playhead on the timeline below to scrub frame by frame (engine frozenAt deterministic mode).",

  "editor.timeline.hint": "Click empty space to clear selection; <b>double-click</b> empty lane space to add a keyframe; drag on empty space = marquee select; Shift+click diamonds to add/remove from the selection; drag diamonds to retime (snaps to a 0.05s grid and other keyframes, hold ⌘ to temporarily disable snapping, multi-selection moves as a whole); ⌘+wheel zooms the timeline; ←/→ nudge (Shift for faster); ⌘C/⌘V copy &amp; paste; Delete deletes; Esc clears selection; ⌘Z undo, ⌘⇧Z redo.",

  "editor.export.heading": "Export / Import",
  "editor.export.copy": "Copy JSON",
  "editor.export.downloadClip": "Download clip",
  "editor.export.downloadState": "Download state",
  "editor.export.import": "Load from textbox",
  "editor.export.hint": "The exported clip JSON is structurally identical to the original engine data: drop it into the <code>clips</code> array of grok-recipes.json and add its name to a state's <code>clips</code> pool for the engine to play it. 'Load from textbox' accepts <code>{clip, state}</code> or a single clip object.",
};
