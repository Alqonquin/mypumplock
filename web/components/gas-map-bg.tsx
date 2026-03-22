"use client";

import { useEffect, useRef } from "react";

// WHY: Decorative canvas that draws a stylized street-map with gas station
// price markers — visually demonstrates that PumpLock averages local prices
// across many stations, not just one. Designed as a subtle background.

// Map colors — muted so FAQ text remains readable
const ROAD_COLOR = "rgba(0, 0, 0, 0.06)";
const ROAD_MAJOR_COLOR = "rgba(0, 0, 0, 0.09)";
const BG_COLOR = "#fafbfc";
const BLOCK_COLORS = [
  "rgba(5, 150, 105, 0.015)",
  "rgba(5, 150, 105, 0.025)",
  "rgba(0, 0, 0, 0.008)",
  "rgba(0, 0, 0, 0.012)",
];

// WHY: Pin radius and font sized so prices are legible but not dominant.
const PIN_RADIUS = 16;
const PIN_FONT = "bold 9px sans-serif";
const PIN_LABEL_FONT = "7px sans-serif";

// WHY: Seeded random for deterministic layout — same map every load
// so it doesn't feel chaotic or shift on re-render.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

interface Station {
  x: number; // fractional 0-1
  y: number;
  price: number;
  brand: string;
}

// WHY: Realistic price spread around a base — stations within a few miles
// can vary $0.20+, which is exactly what PumpLock averages across.
function generateStations(rng: () => number, count: number): Station[] {
  const brands = [
    "Shell", "BP", "Chevron", "Exxon", "Mobil", "Sunoco",
    "Marathon", "Circle K", "Wawa", "Costco", "7-Eleven",
    "QuikTrip", "RaceTrac", "Valero", "Phillips 66",
  ];
  const basePrice = 3.29 + rng() * 0.30; // $3.29–$3.59 base
  const stations: Station[] = [];

  for (let i = 0; i < count; i++) {
    stations.push({
      x: 0.05 + rng() * 0.90,
      y: 0.05 + rng() * 0.90,
      // WHY: ±$0.25 spread from base creates realistic local variation.
      price: basePrice + (rng() - 0.4) * 0.50,
      brand: brands[Math.floor(rng() * brands.length)],
    });
  }
  return stations;
}

// WHY: Grid of horizontal and vertical lines simulates a road map.
// Major roads are thicker/darker; minor roads fill the blocks.
interface Road {
  x1: number; y1: number; x2: number; y2: number;
  major: boolean;
}

function generateRoads(rng: () => number): Road[] {
  const roads: Road[] = [];

  // Major grid — roughly 4-5 horizontal + vertical arteries
  const hMajor = [0.15, 0.38, 0.62, 0.85];
  const vMajor = [0.12, 0.35, 0.55, 0.78, 0.92];
  for (const y of hMajor) {
    const jitter = (rng() - 0.5) * 0.02;
    roads.push({ x1: 0, y1: y + jitter, x2: 1, y2: y + jitter, major: true });
  }
  for (const x of vMajor) {
    const jitter = (rng() - 0.5) * 0.02;
    roads.push({ x1: x + jitter, y1: 0, x2: x + jitter, y2: 1, major: true });
  }

  // Minor roads — fill in the grid blocks
  for (let i = 0; i < 12; i++) {
    const isHorizontal = rng() > 0.5;
    const pos = 0.05 + rng() * 0.90;
    const start = rng() * 0.3;
    const end = 0.7 + rng() * 0.3;
    if (isHorizontal) {
      roads.push({ x1: start, y1: pos, x2: end, y2: pos, major: false });
    } else {
      roads.push({ x1: pos, y1: start, x2: pos, y2: end, major: false });
    }
  }

  return roads;
}

export function GasMapBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rng = seededRandom(42);
    const stations = generateStations(rng, 18);
    const roads = generateRoads(rng);

    // WHY: Generate city blocks as filled rectangles between major roads
    // to give the map depth and a neighborhood feel.
    const blocks: { x: number; y: number; w: number; h: number; color: string }[] = [];
    const hLines = [0, 0.15, 0.38, 0.62, 0.85, 1];
    const vLines = [0, 0.12, 0.35, 0.55, 0.78, 0.92, 1];
    for (let r = 0; r < hLines.length - 1; r++) {
      for (let c = 0; c < vLines.length - 1; c++) {
        const inset = 0.005;
        blocks.push({
          x: vLines[c] + inset,
          y: hLines[r] + inset,
          w: vLines[c + 1] - vLines[c] - inset * 2,
          h: hLines[r + 1] - hLines[r] - inset * 2,
          color: BLOCK_COLORS[Math.floor(rng() * BLOCK_COLORS.length)],
        });
      }
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background
      ctx!.fillStyle = BG_COLOR;
      ctx!.fillRect(0, 0, w, h);

      // City blocks
      for (const b of blocks) {
        ctx!.fillStyle = b.color;
        ctx!.beginPath();
        ctx!.roundRect(b.x * w, b.y * h, b.w * w, b.h * h, 3);
        ctx!.fill();
      }

      // Roads
      for (const r of roads) {
        ctx!.strokeStyle = r.major ? ROAD_MAJOR_COLOR : ROAD_COLOR;
        ctx!.lineWidth = r.major ? 3 : 1.5;
        ctx!.beginPath();
        ctx!.moveTo(r.x1 * w, r.y1 * h);
        ctx!.lineTo(r.x2 * w, r.y2 * h);
        ctx!.stroke();
      }

      // Station pins
      for (const s of stations) {
        const sx = s.x * w;
        const sy = s.y * h;

        // WHY: Color-code pins green→amber→red based on price relative to
        // the group average, visually showing the spread PumpLock averages.
        const avg = stations.reduce((sum, st) => sum + st.price, 0) / stations.length;
        const diff = s.price - avg;
        let pinColor: string;
        let pinBorder: string;
        let textColor: string;
        if (diff < -0.08) {
          pinColor = "rgba(5, 150, 105, 0.85)";
          pinBorder = "rgba(5, 150, 105, 1)";
          textColor = "#fff";
        } else if (diff > 0.08) {
          pinColor = "rgba(239, 68, 68, 0.85)";
          pinBorder = "rgba(239, 68, 68, 1)";
          textColor = "#fff";
        } else {
          pinColor = "rgba(245, 158, 11, 0.85)";
          pinBorder = "rgba(245, 158, 11, 1)";
          textColor = "#fff";
        }

        // Drop shadow
        ctx!.beginPath();
        ctx!.arc(sx, sy + 2, PIN_RADIUS, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(0,0,0,0.08)";
        ctx!.fill();

        // Pin circle
        ctx!.beginPath();
        ctx!.arc(sx, sy, PIN_RADIUS, 0, Math.PI * 2);
        ctx!.fillStyle = pinColor;
        ctx!.fill();
        ctx!.strokeStyle = pinBorder;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        // Price text
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.font = PIN_FONT;
        ctx!.fillStyle = textColor;
        ctx!.fillText(`$${s.price.toFixed(2)}`, sx, sy);

        // Brand name below pin
        ctx!.font = PIN_LABEL_FONT;
        ctx!.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx!.fillText(s.brand, sx, sy + PIN_RADIUS + 9);
      }

      // WHY: "Average" callout in the corner reinforces the PumpLock value prop.
      const avg = stations.reduce((sum, st) => sum + st.price, 0) / stations.length;
      const boxW = 190;
      const boxH = 52;
      const boxX = w - boxW - 20;
      const boxY = 20;

      ctx!.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx!.beginPath();
      ctx!.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx!.fill();
      ctx!.strokeStyle = "rgba(5, 150, 105, 0.2)";
      ctx!.lineWidth = 1;
      ctx!.stroke();

      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      ctx!.font = "bold 11px sans-serif";
      ctx!.fillStyle = "rgba(5, 150, 105, 0.7)";
      ctx!.fillText("LOCAL AVERAGE", boxX + 12, boxY + 10);

      ctx!.font = "bold 22px monospace";
      ctx!.fillStyle = "rgba(5, 150, 105, 0.8)";
      ctx!.fillText(`$${avg.toFixed(2)}/gal`, boxX + 12, boxY + 26);
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
