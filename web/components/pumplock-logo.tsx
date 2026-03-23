/** Shield + gas nozzle logo — PumpLock brand mark
 *
 * WHY: The nozzle is a bold L-shape (vertical grip + angled spout) — the most
 * recognizable fuel-nozzle silhouette at small sizes. The hose forms a loop:
 * exits the shield upper-right, curves to the nozzle, then returns from the
 * nozzle base back to the shield, so it looks like a real pump at rest.
 * The shield is shifted slightly left within the circle to give the nozzle
 * more visual weight and room to breathe.
 */
export function PumpLockLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      {/* Outer circle */}
      <circle cx="32" cy="30" r="26" stroke="#059669" strokeWidth="3" />
      {/* Shield — filled, shifted slightly left to give nozzle more room */}
      <path
        d="M30 10 L17 17 L17 32 C17 40 30 48 30 48 C30 48 43 40 43 32 L43 17 Z"
        fill="#059669"
      />
      {/* Hose top: from shield upper-right, arcs out to nozzle */}
      <path
        d="M42 18 C50 13 58 17 56 26"
        stroke="#059669" strokeWidth="2.5" fill="none" strokeLinecap="round"
      />
      {/* Nozzle collar — where hose meets the grip */}
      <path
        d="M53 24 L59 24"
        stroke="#059669" strokeWidth="3" strokeLinecap="round"
      />
      {/* Nozzle handle — vertical grip, thick and prominent */}
      <path
        d="M56 24 L56 38"
        stroke="#059669" strokeWidth="4" strokeLinecap="round"
      />
      {/* Nozzle spout — angled down-left, pointing back toward shield */}
      <path
        d="M56 30 L46 38"
        stroke="#059669" strokeWidth="3.5" strokeLinecap="round"
      />
      {/* Hose bottom: from nozzle base, curves back to shield lower-right */}
      <path
        d="M56 38 C55 44 48 44 43 37"
        stroke="#059669" strokeWidth="2.5" fill="none" strokeLinecap="round"
      />
    </svg>
  );
}
