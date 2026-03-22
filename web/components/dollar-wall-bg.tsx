"use client";

import { useEffect, useRef } from "react";

// WHY: Decorative canvas that draws a subtle tiled pattern of dollar bills.
// Used behind the bottom CTA section to subconsciously suggest savings/money.
// Static render — no animation needed, just visual texture.

// WHY: Muted green tones so the bills blend into the emerald background
// without competing with the white CTA text on top.
const BILL_STROKE = "rgba(255, 255, 255, 0.08)";
const BILL_FILL = "rgba(255, 255, 255, 0.03)";
const DETAIL_COLOR = "rgba(255, 255, 255, 0.06)";

export function DollarWallBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      // WHY: Bill dimensions roughly match real US dollar proportions (2.61:1).
      // Sized so several bills tile across even a narrow mobile screen.
      const billW = 120;
      const billH = 50;
      const gapX = 30;
      const gapY = 25;

      // WHY: Slight rotation on alternating rows creates organic, wallpaper-like
      // texture instead of a rigid grid.
      const cols = Math.ceil(w / (billW + gapX)) + 2;
      const rows = Math.ceil(h / (billH + gapY)) + 2;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const offsetX = row % 2 === 0 ? 0 : (billW + gapX) / 2;
          const x = col * (billW + gapX) + offsetX;
          const y = row * (billH + gapY);

          // WHY: Alternate between slight clockwise and counter-clockwise tilt
          // so the pattern feels hand-laid, not machine-stamped.
          const angle = row % 2 === 0 ? -0.04 : 0.04;

          ctx!.save();
          ctx!.translate(x + billW / 2, y + billH / 2);
          ctx!.rotate(angle);

          // Bill outline
          ctx!.strokeStyle = BILL_STROKE;
          ctx!.lineWidth = 1;
          ctx!.fillStyle = BILL_FILL;
          ctx!.beginPath();
          ctx!.roundRect(-billW / 2, -billH / 2, billW, billH, 3);
          ctx!.fill();
          ctx!.stroke();

          // Inner border (like the ornamental border on real bills)
          ctx!.strokeStyle = DETAIL_COLOR;
          ctx!.lineWidth = 0.5;
          ctx!.beginPath();
          ctx!.roundRect(-billW / 2 + 6, -billH / 2 + 4, billW - 12, billH - 8, 2);
          ctx!.stroke();

          // Center circle (portrait area on a real bill)
          ctx!.beginPath();
          ctx!.arc(0, 0, 12, 0, Math.PI * 2);
          ctx!.stroke();

          // Inner circle detail
          ctx!.beginPath();
          ctx!.arc(0, 0, 8, 0, Math.PI * 2);
          ctx!.stroke();

          // Dollar sign in the center
          ctx!.font = "bold 11px serif";
          ctx!.fillStyle = DETAIL_COLOR;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText("$", 0, 0);

          // Corner denomination marks
          ctx!.font = "7px monospace";
          ctx!.fillStyle = DETAIL_COLOR;
          ctx!.textAlign = "left";
          ctx!.textBaseline = "top";
          ctx!.fillText("1", -billW / 2 + 9, -billH / 2 + 6);
          ctx!.textAlign = "right";
          ctx!.fillText("1", billW / 2 - 9, -billH / 2 + 6);
          ctx!.textBaseline = "bottom";
          ctx!.fillText("1", billW / 2 - 9, billH / 2 - 6);
          ctx!.textAlign = "left";
          ctx!.fillText("1", -billW / 2 + 9, billH / 2 - 6);

          // Horizontal filigree lines (like the fine lines on currency)
          ctx!.strokeStyle = DETAIL_COLOR;
          ctx!.lineWidth = 0.3;
          for (let i = -2; i <= 2; i++) {
            if (i === 0) continue; // skip center (circle is there)
            const ly = i * 6;
            // Left side lines
            ctx!.beginPath();
            ctx!.moveTo(-billW / 2 + 10, ly);
            ctx!.lineTo(-18, ly);
            ctx!.stroke();
            // Right side lines
            ctx!.beginPath();
            ctx!.moveTo(18, ly);
            ctx!.lineTo(billW / 2 - 10, ly);
            ctx!.stroke();
          }

          ctx!.restore();
        }
      }
    }

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
