"use client";

import { useEffect, useRef } from "react";

// WHY: Decorative canvas that draws a scrolling oil-price chart trending
// upward — visually demonstrates the problem PumpLock solves (rising prices)
// with a dashed "Your max price" line showing protection.

const LINE_COLOR = "rgba(5, 150, 105, 0.22)";
const FILL_TOP = "rgba(5, 150, 105, 0.08)";
const FILL_BOT = "rgba(5, 150, 105, 0.00)";
const GRID_COLOR = "rgba(0, 0, 0, 0.04)";
const LABEL_COLOR = "rgba(0, 0, 0, 0.18)";

// WHY: Speed tuned so the chart scrolls smoothly — fast enough to feel alive
// but slow enough not to distract from the quote form on top.
const SPEED = 0.5;
const SEG_WIDTH = 3;

// WHY: Upward drift makes the chart trend higher over time (the "problem"),
// while mean-reversion keeps it from running off the canvas.
const VOLATILITY = 0.008;
const UPWARD_DRIFT = 0.0004;

export function PriceChartBg({ step = 1 }: { step?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let prices: number[] = [];
    let offset = 0;
    // WHY: Accumulates the rebate over time as the price exceeds the locked price.
    // Grows every frame the price is above the line — resets on resize.
    let rebateTotal = 0;

    function generatePrice(prev: number): number {
      // WHY: Combines upward drift with mean-reversion to a ceiling around 0.75.
      // This creates a chart that trends up, plateaus, occasionally dips, and resumes climbing.
      const ceiling = 0.75;
      const floor = 0.2;
      const revert = prev > ceiling ? (ceiling - prev) * 0.02 : prev < floor ? (floor - prev) * 0.02 : 0;
      const drift = prev < ceiling ? UPWARD_DRIFT : 0;
      return Math.max(0.05, Math.min(0.95,
        prev + drift + revert + (Math.random() - 0.48) * VOLATILITY
      ));
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pointsNeeded = Math.ceil(w / SEG_WIDTH) + 100;
      if (prices.length < pointsNeeded) {
        // WHY: Start low so the upward trend is visible as the chart scrolls.
        const last = prices.length > 0 ? prices[prices.length - 1] : 0.25;
        for (let i = prices.length; i < pointsNeeded; i++) {
          prices.push(generatePrice(i === 0 ? last : prices[i - 1]));
        }
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const chartTop = h * 0.08;
      const chartBot = h * 0.92;
      const chartH = chartBot - chartTop;

      // Horizontal grid lines
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = chartTop + (chartH * i) / 5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Y-axis price labels (gas prices rising)
      ctx.font = "15px monospace";
      ctx.fillStyle = LABEL_COLOR;
      const labels = ["$4.50", "$4.00", "$3.50", "$3.00", "$2.50", "$2.00"];
      for (let i = 0; i <= 5; i++) {
        const y = chartTop + (chartH * i) / 5;
        ctx.fillText(labels[i], 6, y - 4);
      }

      // Price line
      const startIdx = Math.floor(offset / SEG_WIDTH);
      const subOffset = offset % SEG_WIDTH;
      const pointsOnScreen = Math.ceil(w / SEG_WIDTH) + 2;

      // Generate new points as needed
      while (startIdx + pointsOnScreen >= prices.length) {
        prices.push(generatePrice(prices[prices.length - 1]));
      }

      // Trim old points to prevent memory growth
      // WHY: Keep a buffer of 200 behind the visible window, drop the rest.
      if (startIdx > 200) {
        prices = prices.slice(startIdx - 200);
        offset -= (startIdx - 200) * SEG_WIDTH;
      }

      const recalcStart = Math.floor(offset / SEG_WIDTH);
      const recalcSub = offset % SEG_WIDTH;

      // Build path points
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i <= pointsOnScreen; i++) {
        const x = i * SEG_WIDTH - recalcSub;
        const price = prices[recalcStart + i] ?? 0.5;
        // WHY: Invert so higher price = higher on screen (lower y value)
        const y = chartTop + (1 - price) * chartH;
        points.push({ x, y });
      }

      // Fill under the line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, chartBot);
      ctx.lineTo(points[0].x, chartBot);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, chartTop, 0, chartBot);
      grad.addColorStop(0, FILL_TOP);
      grad.addColorStop(1, FILL_BOT);
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke the price line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Ticker key (upper-left, Google Finance style) ──
      // WHY: Adds realism — looks like a real commodity chart at a glance.
      // WHY: On mobile (<640px) show only the ticker box (scaled down).
      // On desktop show both ticker and rebate boxes side by side.
      const isMobile = w < 640;

      const keyPad = isMobile ? 8 : 12;
      const keyX = isMobile ? 16 + keyPad : 100;
      const keyBoxX = keyX - keyPad;
      // WHY: Fixed pixel position so the box doesn't scale/distort
      // when the section grows taller with more form content.
      const keyBoxY = isMobile ? 12 : 30;
      const keyBoxW = isMobile ? 190 : 250;
      const keyBoxH = isMobile ? 90 : 108;

      // WHY: Display a price that tracks the actual animated line so the
      // ticker feels alive, not static.
      const currentPrice = prices[recalcStart + pointsOnScreen - 1] ?? 0.5;
      const displayPrice = 2.00 + currentPrice * 2.50; // maps 0-1 to $2.00-$4.50

      // "Your max price" dashed line — positioned at ~$3.50 area
      // WHY: Shows the protection ceiling visually. Placed at 40% from top
      // so the rising price line crosses above it, illustrating the problem.
      const strikeY = chartTop + chartH * 0.55;
      ctx.setLineDash([8, 5]);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.40)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, strikeY);
      ctx.lineTo(w, strikeY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "14px sans-serif";
      ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
      ctx.fillText("YOUR LOCKED PRICE", w - 195, strikeY - 5);

      const lockedPriceFrac = 0.45; // corresponds to strikeY at 0.55
      const lockedDisplayPrice = 2.00 + lockedPriceFrac * 2.50;
      const overage = displayPrice - lockedDisplayPrice;

      // WHY: Only accumulate when price is above the locked line.
      if (overage > 0) {
        rebateTotal += overage * 0.02;
      }

      // ── Ticker box (always shown — scaled down on mobile) ──
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.roundRect(keyBoxX, keyBoxY, keyBoxW, keyBoxH, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();

      let keyY = keyBoxY + keyPad + 4;
      ctx.textAlign = "left";

      ctx.font = `bold ${isMobile ? 11 : 13}px sans-serif`;
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillText("RBW00:NYMEX", keyX, keyY);
      keyY += isMobile ? 16 : 19;

      ctx.font = `${isMobile ? 11 : 14}px sans-serif`;
      ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
      ctx.fillText("RBOB Gasoline Futures", keyX, keyY);
      keyY += isMobile ? 20 : 26;

      ctx.font = `bold ${isMobile ? 22 : 28}px monospace`;
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillText(`$${displayPrice.toFixed(2)}`, keyX, keyY);
      keyY += isMobile ? 18 : 22;

      const changeAmt = (displayPrice - 2.85).toFixed(2);
      const changePct = (((displayPrice - 2.85) / 2.85) * 100).toFixed(1);
      ctx.font = `${isMobile ? 11 : 14}px sans-serif`;
      ctx.fillStyle = "rgba(239, 68, 68, 0.30)";
      ctx.fillText(`▲ +${changePct}% (+${changeAmt})  Today`, keyX, keyY);

      // ── Rebate box (upper-right, desktop only) ──
      if (!isMobile) {
      const rebPad = 12;
      const rebBoxW = 250;
      const rebBoxH = 108;
      const rebBoxX = w - rebBoxW - 50;
      const rebBoxY = 30;

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.roundRect(rebBoxX, rebBoxY, rebBoxW, rebBoxH, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(5, 150, 105, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const rebX = rebBoxX + rebPad;
      let rebY = rebBoxY + rebPad + 4;
      ctx.textAlign = "left";

      // ── PumpLock logo (shield + nozzle) ──
      const logoSize = 36;
      const logoX = rebBoxX + rebBoxW - rebPad - logoSize;
      const logoY = rebBoxY + rebPad;
      const ls = logoSize / 64;
      ctx.save();
      ctx.translate(logoX, logoY);
      ctx.scale(ls, ls);

      ctx.strokeStyle = "rgba(5, 150, 105, 0.30)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(32, 30, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(5, 150, 105, 0.25)";
      ctx.beginPath();
      ctx.moveTo(32, 10);
      ctx.lineTo(19, 17);
      ctx.lineTo(19, 32);
      ctx.quadraticCurveTo(19, 40, 32, 48);
      ctx.quadraticCurveTo(45, 40, 45, 32);
      ctx.lineTo(45, 17);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(5, 150, 105, 0.30)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(45, 24);
      ctx.lineTo(49, 24);
      ctx.lineTo(49, 28);
      ctx.lineTo(47, 30);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(47, 30);
      ctx.quadraticCurveTo(50, 33, 50, 36);
      ctx.lineTo(50, 42);
      ctx.stroke();

      ctx.fillStyle = "rgba(5, 150, 105, 0.25)";
      ctx.beginPath();
      ctx.moveTo(48, 42);
      ctx.lineTo(52, 42);
      ctx.lineTo(52, 47);
      ctx.lineTo(50.5, 49);
      ctx.lineTo(49.5, 47);
      ctx.lineTo(48, 47);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "rgba(5, 150, 105, 0.25)";
      ctx.fillText("PUMPLOCK MEMBER", rebX, rebY);
      rebY += 19;

      ctx.font = "14px sans-serif";
      ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
      ctx.fillText("Membership Rebate", rebX, rebY);
      rebY += 26;

      ctx.font = "bold 28px monospace";
      ctx.fillStyle = "rgba(5, 150, 105, 0.25)";
      ctx.fillText(`$${rebateTotal.toFixed(2)}`, rebX, rebY);
      rebY += 22;

      if (overage > 0) {
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "rgba(5, 150, 105, 0.30)";
        ctx.fillText(`▲ +$${overage.toFixed(2)}/gal above locked price`, rebX, rebY);
      } else {
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
        ctx.fillText("Price below locked — no rebate yet", rebX, rebY);
      }
      } // end rebate box (desktop only)
      offset += SPEED;
      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    animRef.current = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full pointer-events-none"
      style={{ height: "100vh", maxHeight: "100vh" }}
      aria-hidden="true"
    />
  );
}
