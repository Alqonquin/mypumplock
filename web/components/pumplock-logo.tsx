/** Shield + gas nozzle logo — PumpLock brand mark */
export function PumpLockLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      {/* Outer circle */}
      <circle cx="32" cy="30" r="26" stroke="#059669" strokeWidth="3" />
      {/* Shield — filled */}
      <path d="M32 10 L19 17 L19 32 C19 40 32 48 32 48 C32 48 45 40 45 32 L45 17 Z"
            fill="#059669" />
      {/* Gas nozzle handle */}
      <path d="M45 24 L49 24 L49 28 L47 30" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Hose curving down */}
      <path d="M47 30 C48 32 50 33 50 36 L50 42" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      {/* Nozzle tip */}
      <path d="M48 42 L52 42 L52 47 L50.5 49 L49.5 47 L48 47 Z" fill="#059669" />
    </svg>
  );
}
