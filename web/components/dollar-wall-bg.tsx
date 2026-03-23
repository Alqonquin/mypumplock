// WHY: Tiled SVG dollar bill background for the bottom CTA section.
// Uses a static SVG image repeated via CSS — no canvas, no JS, no hydration cost.
// The SVG lives at /dollar-bill.svg with white-on-transparent elements
// so it layers cleanly over the emerald-600 section background.

export function DollarWallBg() {
  return (
    // WHY: Outer div clips the rotated inner div so the tilted pattern
    // doesn't spill outside the section boundaries.
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        style={{
          // WHY: 15° rotation exposes corners. The inner div must extend
          // well beyond the clipping parent so the tiled pattern covers
          // every pixel. -80% inset + 260% size adds extra rows at top
          // and bottom to eliminate any green gaps.
          position: "absolute",
          top: "-80%",
          left: "-80%",
          width: "260%",
          height: "260%",
          backgroundImage: "url(/dollar-bill.svg)",
          backgroundSize: "220px 95px",
          backgroundRepeat: "repeat",
          transform: "rotate(-15deg)",
        }}
      />
    </div>
  );
}
