// WHY: Tiled SVG dollar bill background for the bottom CTA section.
// Uses a static SVG image repeated via CSS — no canvas, no JS, no hydration cost.
// The SVG lives at /dollar-bill.svg with white-on-transparent elements
// so it layers cleanly over the emerald-600 section background.

export function DollarWallBg() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{
        backgroundImage: "url(/dollar-bill.svg)",
        // WHY: 220px tile width keeps bills recognizable on mobile while
        // fitting 2-3 across on small screens. 95px matches the 200:85
        // aspect ratio of the SVG.
        backgroundSize: "220px 95px",
        backgroundRepeat: "repeat",
      }}
    />
  );
}
