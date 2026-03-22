"use client";

import { useEffect, useRef } from "react";

// WHY: Decorative canvas that draws a realistic-looking street map with gas
// station price markers — visually demonstrates that PumpLock averages local
// prices across many stations. Designed as a subtle FAQ background.

// WHY: Seeded random for deterministic layout — same map every page load.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

interface Station {
  x: number;
  y: number;
  price: number;
  brand: string;
}

// WHY: Realistic price spread — stations within a few miles can vary $0.20+.
function generateStations(rng: () => number, count: number): Station[] {
  const brands = [
    "Shell", "BP", "Chevron", "Exxon", "Mobil", "Sunoco",
    "Marathon", "Circle K", "Wawa", "Costco", "7-Eleven",
    "QuikTrip", "RaceTrac", "Valero", "Phillips 66",
  ];
  const basePrice = 3.29 + rng() * 0.30;
  const stations: Station[] = [];
  for (let i = 0; i < count; i++) {
    stations.push({
      x: 0.06 + rng() * 0.88,
      y: 0.06 + rng() * 0.88,
      price: basePrice + (rng() - 0.4) * 0.50,
      brand: brands[Math.floor(rng() * brands.length)],
    });
  }
  return stations;
}

// WHY: Bezier curves through waypoints make roads look organic, not grid-like.
interface RoadPath {
  points: { x: number; y: number }[];
  width: number;
  color: string;
  label?: string;
}

function generateRoadNetwork(rng: () => number): RoadPath[] {
  const roads: RoadPath[] = [];

  // WHY: Major roads curve gently across the map — like real arterials.
  // Each has 4-6 waypoints with randomized offsets for organic shape.
  const majorColor = "rgba(255, 255, 255, 0.95)";
  const minorColor = "rgba(255, 255, 255, 0.7)";

  // Horizontal arterials (3 roads with curves)
  const hPositions = [0.22, 0.52, 0.78];
  const hLabels = ["W 42nd St", "Main St", "Oak Ave"];
  for (let i = 0; i < hPositions.length; i++) {
    const base = hPositions[i];
    const pts: { x: number; y: number }[] = [];
    for (let t = 0; t <= 1; t += 0.15) {
      pts.push({
        x: t,
        y: base + (rng() - 0.5) * 0.06 + Math.sin(t * Math.PI) * (rng() - 0.5) * 0.04,
      });
    }
    roads.push({ points: pts, width: 6, color: majorColor, label: hLabels[i] });
  }

  // Vertical arterials (3 roads with curves)
  const vPositions = [0.18, 0.48, 0.75];
  const vLabels = ["N 5th Ave", "Elm Blvd", "Park Dr"];
  for (let i = 0; i < vPositions.length; i++) {
    const base = vPositions[i];
    const pts: { x: number; y: number }[] = [];
    for (let t = 0; t <= 1; t += 0.15) {
      pts.push({
        x: base + (rng() - 0.5) * 0.05 + Math.sin(t * Math.PI * 1.5) * (rng() - 0.5) * 0.03,
        y: t,
      });
    }
    roads.push({ points: pts, width: 6, color: majorColor, label: vLabels[i] });
  }

  // Diagonal / curved collector roads
  roads.push({
    points: [
      { x: 0.05, y: 0.90 },
      { x: 0.15, y: 0.72 },
      { x: 0.30, y: 0.60 },
      { x: 0.50, y: 0.55 },
      { x: 0.70, y: 0.58 },
      { x: 0.85, y: 0.50 },
    ],
    width: 4, color: majorColor,
  });
  roads.push({
    points: [
      { x: 0.10, y: 0.15 },
      { x: 0.25, y: 0.30 },
      { x: 0.40, y: 0.35 },
      { x: 0.60, y: 0.30 },
      { x: 0.90, y: 0.35 },
    ],
    width: 4, color: majorColor,
  });

  // Minor residential streets — short, connecting segments
  for (let i = 0; i < 20; i++) {
    const sx = rng();
    const sy = rng();
    const len = 0.08 + rng() * 0.15;
    const angle = rng() * Math.PI * 2;
    const ex = sx + Math.cos(angle) * len;
    const ey = sy + Math.sin(angle) * len;
    // WHY: Add a midpoint with slight curve to avoid ruler-straight lines.
    const mx = (sx + ex) / 2 + (rng() - 0.5) * 0.03;
    const my = (sy + ey) / 2 + (rng() - 0.5) * 0.03;
    roads.push({
      points: [{ x: sx, y: sy }, { x: mx, y: my }, { x: ex, y: ey }],
      width: 2, color: minorColor,
    });
  }

  return roads;
}

// WHY: Organic shapes for parks and water give the map a real cartographic feel
// instead of looking like a grid layout.
interface MapFeature {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
  type: "park" | "water";
}

function generateFeatures(rng: () => number): MapFeature[] {
  const features: MapFeature[] = [];
  // Parks (green spaces)
  for (let i = 0; i < 4; i++) {
    features.push({
      cx: 0.1 + rng() * 0.8,
      cy: 0.1 + rng() * 0.8,
      rx: 0.03 + rng() * 0.05,
      ry: 0.02 + rng() * 0.04,
      rotation: rng() * Math.PI,
      type: "park",
    });
  }
  // Water (pond / lake)
  features.push({
    cx: 0.82 + rng() * 0.08,
    cy: 0.75 + rng() * 0.10,
    rx: 0.06 + rng() * 0.04,
    ry: 0.04 + rng() * 0.03,
    rotation: rng() * Math.PI * 0.5,
    type: "water",
  });
  return features;
}

// WHY: Draw a smooth curve through waypoints using quadratic bezier segments.
// This is what makes roads look like real roads instead of zigzag lines.
function drawSmoothPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], w: number, h: number) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * w, points[0].y * h);
  if (points.length === 2) {
    ctx.lineTo(points[1].x * w, points[1].y * h);
  } else {
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      // WHY: Use midpoint as control point for smooth transitions between segments.
      const cpx = ((curr.x + next.x) / 2) * w;
      const cpy = ((curr.y + next.y) / 2) * h;
      ctx.quadraticCurveTo(curr.x * w, curr.y * h, cpx, cpy);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x * w, last.y * h);
  }
  ctx.stroke();
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
    const roads = generateRoadNetwork(rng);
    const features = generateFeatures(rng);
    const avg = stations.reduce((sum, st) => sum + st.price, 0) / stations.length;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // WHY: Base color matches Google Maps land color for familiarity.
      ctx!.fillStyle = "#e8e4da";
      ctx!.fillRect(0, 0, w, h);

      // Map features — parks and water bodies
      for (const f of features) {
        ctx!.save();
        ctx!.translate(f.cx * w, f.cy * h);
        ctx!.rotate(f.rotation);
        ctx!.beginPath();
        ctx!.ellipse(0, 0, f.rx * w, f.ry * h, 0, 0, Math.PI * 2);
        if (f.type === "park") {
          ctx!.fillStyle = "rgba(170, 210, 170, 0.5)";
        } else {
          ctx!.fillStyle = "rgba(170, 210, 230, 0.5)";
        }
        ctx!.fill();
        ctx!.restore();
      }

      // Roads — draw border (dark) then fill (light) for realistic road edges
      for (const road of roads) {
        // Road border/casing
        ctx!.strokeStyle = "rgba(0, 0, 0, 0.08)";
        ctx!.lineWidth = road.width + 2;
        ctx!.lineCap = "round";
        ctx!.lineJoin = "round";
        drawSmoothPath(ctx!, road.points, w, h);

        // Road fill
        ctx!.strokeStyle = road.color;
        ctx!.lineWidth = road.width;
        drawSmoothPath(ctx!, road.points, w, h);
      }

      // Road labels on major roads
      ctx!.font = "8px sans-serif";
      ctx!.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      for (const road of roads) {
        if (!road.label || road.points.length < 3) continue;
        // Place label at the midpoint of the road
        const mid = road.points[Math.floor(road.points.length / 2)];
        ctx!.fillText(road.label, mid.x * w, mid.y * h - 8);
      }

      // Station pins
      // WHY: Larger radius so the price text has room to be bigger and readable.
      const PIN_R = 20;
      for (const s of stations) {
        const sx = s.x * w;
        const sy = s.y * h;

        const diff = s.price - avg;
        let pinColor: string;
        let pinBorder: string;
        // WHY: Lighter, pastel-ish bubbles so they don't overpower the FAQ text.
        if (diff < -0.08) {
          pinColor = "rgba(74, 200, 160, 0.75)";
          pinBorder = "rgba(74, 200, 160, 0.9)";
        } else if (diff > 0.08) {
          pinColor = "rgba(240, 120, 110, 0.75)";
          pinBorder = "rgba(240, 120, 110, 0.9)";
        } else {
          pinColor = "rgba(250, 190, 80, 0.80)";
          pinBorder = "rgba(250, 190, 80, 0.9)";
        }

        // Drop shadow
        ctx!.beginPath();
        ctx!.arc(sx + 1, sy + 2, PIN_R, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(0,0,0,0.12)";
        ctx!.fill();

        // Pin pointer triangle (below circle)
        ctx!.beginPath();
        ctx!.moveTo(sx - 5, sy + PIN_R - 3);
        ctx!.lineTo(sx + 5, sy + PIN_R - 3);
        ctx!.lineTo(sx, sy + PIN_R + 7);
        ctx!.closePath();
        ctx!.fillStyle = pinColor;
        ctx!.fill();

        // Pin circle
        ctx!.beginPath();
        ctx!.arc(sx, sy, PIN_R, 0, Math.PI * 2);
        ctx!.fillStyle = pinColor;
        ctx!.fill();
        ctx!.strokeStyle = pinBorder;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        // Price text — larger for readability
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.font = "bold 13px sans-serif";
        ctx!.fillStyle = "#fff";
        ctx!.fillText(`$${s.price.toFixed(2)}`, sx, sy);

        // Brand name below pin
        ctx!.font = "8px sans-serif";
        ctx!.fillStyle = "rgba(0, 0, 0, 0.30)";
        ctx!.fillText(s.brand, sx, sy + PIN_R + 14);
      }

      // Local Average callout — Regular, Premium, Diesel
      const boxW = 200;
      const boxH = 82;
      const boxX = w - boxW - 20;
      const boxY = 16;

      ctx!.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx!.beginPath();
      ctx!.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx!.fill();
      ctx!.strokeStyle = "rgba(5, 150, 105, 0.25)";
      ctx!.lineWidth = 1;
      ctx!.stroke();

      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      ctx!.font = "bold 11px sans-serif";
      ctx!.fillStyle = "rgba(5, 150, 105, 0.75)";
      ctx!.fillText("LOCAL AVERAGE", boxX + 12, boxY + 10);

      // WHY: Show all three fuel types so the user sees we track
      // Regular, Premium, and Diesel — not just one grade.
      const regular = avg;
      const premium = avg + 0.60; // National avg spread: Premium ~+$0.60 vs Regular
      const diesel = avg + 0.40;  // National avg spread: Diesel ~+$0.40 vs Regular

      const rowY = boxY + 28;
      const colW = 60;
      const labels = ["Regular", "Premium", "Diesel"];
      const prices = [regular, premium, diesel];
      const colors = ["rgba(5, 150, 105, 0.85)", "rgba(30, 120, 200, 0.85)", "rgba(120, 80, 40, 0.85)"];

      for (let i = 0; i < 3; i++) {
        const cx = boxX + 12 + i * colW;
        ctx!.font = "8px sans-serif";
        ctx!.fillStyle = "rgba(0, 0, 0, 0.40)";
        ctx!.fillText(labels[i], cx, rowY);

        ctx!.font = "bold 15px monospace";
        ctx!.fillStyle = colors[i];
        ctx!.fillText(`$${prices[i].toFixed(2)}`, cx, rowY + 14);
      }

      // Fuel grade dots
      for (let i = 0; i < 3; i++) {
        const cx = boxX + 8 + i * colW;
        ctx!.beginPath();
        ctx!.arc(cx, rowY + 4, 2, 0, Math.PI * 2);
        ctx!.fillStyle = colors[i];
        ctx!.fill();
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
