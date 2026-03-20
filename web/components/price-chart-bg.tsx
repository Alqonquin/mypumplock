"use client";

import { useEffect, useRef } from "react";

// WHY: Decorative canvas that draws a scrolling oil-price chart trending
// upward — visually demonstrates the problem PumpLock solves (rising prices)
// with a dashed "Your locked price" line showing protection. Styled to
// resemble a real financial terminal / Google Finance chart.

const LINE_COLOR = "rgba(5, 150, 105, 0.30)";
const FILL_TOP = "rgba(5, 150, 105, 0.10)";
const FILL_BOT = "rgba(5, 150, 105, 0.00)";
const GRID_COLOR = "rgba(0, 0, 0, 0.05)";
const GRID_COLOR_MINOR = "rgba(0, 0, 0, 0.025)";
const LABEL_COLOR = "rgba(0, 0, 0, 0.13)";
const AXIS_COLOR = "rgba(0, 0, 0, 0.10)";
const TICK_COLOR = "rgba(0, 0, 0, 0.08)";

const SPEED = 0.5;
const SEG_WIDTH = 3;
// WHY: Higher volatility + stronger drift = the chart clearly trends upward
// with realistic wiggles, not a flat ocean of noise.
const VOLATILITY = 0.008;
const UPWARD_DRIFT = 0.0005;

// WHY: Y-axis prices span a realistic retail gas range so the chart
// reads like real market data at a glance.
const PRICE_MIN = 2.00;
const PRICE_MAX = 5.00;
const PRICE_STEP = 0.25; // tick every 25 cents
const PRICE_MAJOR_STEP = 0.50; // bold grid every 50 cents

export function PriceChartBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let prices: number[] = [];
    let offset = 0;

    // WHY: Volume bars add visual density like a real trading terminal.
    // Generated alongside prices — taller bars on bigger price moves.
    let volumes: number[] = [];

    function generatePrice(prev: number): number {
      const ceiling = 0.78;
      const floor = 0.18;
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

      const pointsNeeded = Math.ceil(w / SEG_WIDTH) + 150;
      if (prices.length < pointsNeeded) {
        const last = prices.length > 0 ? prices[prices.length - 1] : 0.22;
        for (let i = prices.length; i < pointsNeeded; i++) {
          const prev = i === 0 ? last : prices[i - 1];
          const p = generatePrice(prev);
          prices.push(p);
          // WHY: Volume correlates with price movement magnitude — looks realistic.
          volumes.push(0.2 + Math.abs(p - prev) * 30 + Math.random() * 0.3);
        }
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // WHY: Leave margins for axis labels — mimics real chart framing.
      const marginLeft = 50;
      const marginRight = 12;
      const marginTop = 16;
      const marginBot = 40;
      const chartLeft = marginLeft;
      const chartRight = w - marginRight;
      const chartTop = marginTop;
      const chartBot = h - marginBot;
      const chartW = chartRight - chartLeft;
      const chartH = chartBot - chartTop;

      // WHY: Volume bars sit in the bottom 12% of the chart area,
      // faint enough not to compete with the price line.
      const volH = chartH * 0.12;
      const volBot = chartBot;

      // ── Y-axis: price grid lines + labels ──
      const priceRange = PRICE_MAX - PRICE_MIN;
      for (let p = PRICE_MIN; p <= PRICE_MAX; p += PRICE_STEP) {
        const yFrac = 1 - (p - PRICE_MIN) / priceRange;
        const y = chartTop + yFrac * chartH;
        const isMajor = Math.abs(p % PRICE_MAJOR_STEP) < 0.01;

        // Grid line
        ctx.strokeStyle = isMajor ? GRID_COLOR : GRID_COLOR_MINOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();

        // Tick mark on Y-axis
        ctx.strokeStyle = AXIS_COLOR;
        ctx.beginPath();
        ctx.moveTo(chartLeft - 4, y);
        ctx.lineTo(chartLeft, y);
        ctx.stroke();

        // Price label
        if (isMajor) {
          ctx.font = "10px monospace";
          ctx.fillStyle = LABEL_COLOR;
          ctx.textAlign = "right";
          ctx.fillText(`$${p.toFixed(2)}`, chartLeft - 7, y + 3);
        }
      }

      // Y-axis vertical line
      ctx.strokeStyle = AXIS_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartLeft, chartTop);
      ctx.lineTo(chartLeft, chartBot);
      ctx.stroke();

      // X-axis horizontal line
      ctx.beginPath();
      ctx.moveTo(chartLeft, chartBot);
      ctx.lineTo(chartRight, chartBot);
      ctx.stroke();

      // ── X-axis: time labels + vertical grid + tick marks ──
      // WHY: Fake 30-min interval timestamps that scroll with the chart
      // create the appearance of a real intraday chart.
      const timeLabels = [
        "9:30", "10:00", "10:30", "11:00", "11:30",
        "12:00", "12:30", "1:00", "1:30", "2:00",
        "2:30", "3:00", "3:30", "4:00",
      ];
      // WHY: 120px spacing between time labels — tight enough to fill the chart
      // but readable. Using modular offset so labels scroll with the chart.
      const timeSpacing = 120;
      const totalTimeWidth = timeLabels.length * timeSpacing;

      for (let i = 0; i < timeLabels.length; i++) {
        const rawX = chartLeft + i * timeSpacing - (offset * 0.3) % totalTimeWidth;
        // Wrap around
        const x = ((rawX - chartLeft) % totalTimeWidth + totalTimeWidth) % totalTimeWidth + chartLeft;
        if (x < chartLeft + 10 || x > chartRight - 10) continue;

        // Vertical grid line
        ctx.strokeStyle = GRID_COLOR_MINOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, chartTop);
        ctx.lineTo(x, chartBot);
        ctx.stroke();

        // Tick mark
        ctx.strokeStyle = TICK_COLOR;
        ctx.beginPath();
        ctx.moveTo(x, chartBot);
        ctx.lineTo(x, chartBot + 5);
        ctx.stroke();

        // Time label
        ctx.font = "9px monospace";
        ctx.fillStyle = LABEL_COLOR;
        ctx.textAlign = "center";
        ctx.fillText(timeLabels[i], x, chartBot + 15);
      }

      // Axis labels
      ctx.font = "8px sans-serif";
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.textAlign = "center";
      ctx.fillText("RBOB Gasoline Futures (USD/gal)", chartLeft + chartW / 2, chartBot + 30);

      // ── Price data ──
      const startIdx = Math.floor(offset / SEG_WIDTH);
      const subOffset = offset % SEG_WIDTH;
      const pointsOnScreen = Math.ceil(chartW / SEG_WIDTH) + 2;

      while (startIdx + pointsOnScreen >= prices.length) {
        const prev = prices[prices.length - 1];
        const p = generatePrice(prev);
        prices.push(p);
        volumes.push(0.2 + Math.abs(p - prev) * 30 + Math.random() * 0.3);
      }

      // Trim old data
      if (startIdx > 200) {
        prices = prices.slice(startIdx - 200);
        volumes = volumes.slice(startIdx - 200);
        offset -= (startIdx - 200) * SEG_WIDTH;
      }

      const si = Math.floor(offset / SEG_WIDTH);
      const so = offset % SEG_WIDTH;

      // ── Volume bars ──
      // WHY: Every 6th segment gets a volume bar to avoid clutter.
      ctx.fillStyle = "rgba(5, 150, 105, 0.06)";
      for (let i = 0; i <= pointsOnScreen; i += 6) {
        const x = chartLeft + i * SEG_WIDTH - so;
        if (x < chartLeft || x > chartRight) continue;
        const vol = volumes[si + i] ?? 0.3;
        const barH = vol * volH;
        ctx.fillRect(x - 2, volBot - barH, 4, barH);
      }

      // ── Build price path ──
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i <= pointsOnScreen; i++) {
        const x = chartLeft + i * SEG_WIDTH - so;
        const price = prices[si + i] ?? 0.5;
        const y = chartTop + (1 - price) * chartH;
        points.push({ x, y });
      }

      // Fill under line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.lineTo(points[points.length - 1].x, chartBot);
      ctx.lineTo(points[0].x, chartBot);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, chartTop, 0, chartBot);
      grad.addColorStop(0, FILL_TOP);
      grad.addColorStop(1, FILL_BOT);
      ctx.fillStyle = grad;
      ctx.fill();

      // Price line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Current price indicator (right edge) ──
      // WHY: A dot + price badge on the right edge mimics the live price
      // readout on Google Finance / Bloomberg charts.
      const lastPt = points[points.length - 1];
      const currentPrice = prices[si + pointsOnScreen] ?? 0.5;
      const displayPrice = PRICE_MIN + currentPrice * priceRange;

      // Dot
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(5, 150, 105, 0.35)";
      ctx.fill();

      // Price badge
      ctx.fillStyle = "rgba(5, 150, 105, 0.15)";
      const badgeW = 48;
      const badgeH = 18;
      const badgeX = chartRight - badgeW - 2;
      const badgeY = lastPt.y - badgeH / 2;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "rgba(5, 150, 105, 0.45)";
      ctx.textAlign = "center";
      ctx.fillText(`$${displayPrice.toFixed(2)}`, badgeX + badgeW / 2, badgeY + 13);

      // ── "Your locked price" dashed line ──
      const strikePriceFrac = (3.50 - PRICE_MIN) / priceRange;
      const strikeY = chartTop + (1 - strikePriceFrac) * chartH;

      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartLeft, strikeY);
      ctx.lineTo(chartRight, strikeY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Strike label
      ctx.font = "bold 8px sans-serif";
      ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
      ctx.textAlign = "left";
      ctx.fillText("YOUR LOCKED PRICE  $3.50", chartLeft + 6, strikeY - 5);

      // ── OHLC-style mini candles (sparse, for texture) ──
      // WHY: Small candlestick-like marks scattered across the chart add
      // the visual density of a real trading terminal.
      for (let i = 0; i <= pointsOnScreen; i += 12) {
        const x = chartLeft + i * SEG_WIDTH - so;
        if (x < chartLeft + 5 || x > chartRight - 5) continue;
        const p1 = prices[si + i] ?? 0.5;
        const p2 = prices[si + i + 1] ?? p1;
        const open = chartTop + (1 - p1) * chartH;
        const close = chartTop + (1 - p2) * chartH;
        const high = Math.min(open, close) - 2;
        const low = Math.max(open, close) + 2;
        const isUp = close < open; // lower y = higher price = green

        // Wick
        ctx.strokeStyle = isUp ? "rgba(5, 150, 105, 0.10)" : "rgba(239, 68, 68, 0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, high);
        ctx.lineTo(x, low);
        ctx.stroke();

        // Body
        ctx.fillStyle = isUp ? "rgba(5, 150, 105, 0.08)" : "rgba(239, 68, 68, 0.06)";
        const bodyTop = Math.min(open, close);
        const bodyH = Math.max(1, Math.abs(close - open));
        ctx.fillRect(x - 2, bodyTop, 4, bodyH);
      }

      // ── Crosshair-style horizontal line at current price ──
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = "rgba(5, 150, 105, 0.12)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(chartLeft, lastPt.y);
      ctx.lineTo(chartRight, lastPt.y);
      ctx.stroke();
      ctx.setLineDash([]);

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
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
