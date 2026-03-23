/** PumpLock brand mark — padlock with fuel nozzle.
 *
 * WHY: Uses the designer-provided PNG rather than hand-coded SVG paths,
 * because the fuel nozzle detail doesn't reproduce well as simple strokes.
 * The PNG is in /public/pumplock-icon.png and renders crisp at all sizes.
 */
export function PumpLockLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <img
      src="/pumplock-icon.png"
      alt="PumpLock"
      className={className}
    />
  );
}
