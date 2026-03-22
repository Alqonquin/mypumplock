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
          // WHY: 15° tilt makes the dollar pattern feel scattered/organic
          // instead of a rigid grid. The oversized dimensions (-20% inset,
          // 140% size) ensure the rotated tile still covers the full section
          // without leaving empty corners.
          position: "absolute",
          top: "-20%",
          left: "-20%",
          width: "140%",
          height: "140%",
          backgroundImage: "url(/dollar-bill.svg)",
          backgroundSize: "220px 95px",
          backgroundRepeat: "repeat",
          transform: "rotate(-15deg)",
        }}
      />
    </div>
  );
}
