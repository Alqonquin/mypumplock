/**
 * CME Globex Market Hours Detection
 *
 * Determines whether the CME NYMEX RBOB/HO futures market is currently
 * open and calculates the after-hours volatility buffer for pricing.
 *
 * Schedule (all times Eastern):
 *   Sunday 6:00 PM  →  Friday 5:00 PM  (continuous)
 *   Daily maintenance break: 5:00 PM - 6:00 PM ET (Mon-Thu)
 *
 * WHY: When the CME is closed, we can't execute hedges. If a member
 * signs up at stale prices and the market gaps on open, we eat the
 * difference. The buffer compensates for this "gapping risk."
 */

// WHY: CME observes these holidays (US markets closed).
// This list covers the major closures. The admin can also use the
// kill switch for unscheduled closures or half-days.
const CME_HOLIDAYS_2026: string[] = [
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Day
  "2026-02-16", // Presidents' Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-07-03", // Independence Day (observed)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
];

// WHY: Maintain a rolling set of holiday years. Add 2027 when known.
// The CME publishes its holiday calendar annually around November.
const CME_HOLIDAYS = new Set(CME_HOLIDAYS_2026);

/**
 * Convert a Date to Eastern Time components.
 *
 * WHY: CME schedule is defined in Eastern Time. Using Intl.DateTimeFormat
 * handles DST transitions automatically (EST ↔ EDT) without pulling in
 * a timezone library.
 */
function toEastern(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  dateStr: string; // "YYYY-MM-DD"
} {
  // WHY: formatToParts gives us each component in the target timezone.
  // This is more reliable than offset arithmetic, which breaks around DST.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const year = parseInt(get("year"));
  const month = parseInt(get("month"));
  const day = parseInt(get("day"));
  let hour = parseInt(get("hour"));
  const minute = parseInt(get("minute"));

  // WHY: hour12=false can return "24" for midnight in some locales.
  if (hour === 24) hour = 0;

  const weekdayStr = get("weekday");
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayStr);

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { year, month, day, hour, minute, dayOfWeek, dateStr };
}

/**
 * Check if the CME NYMEX market is currently open.
 *
 * Returns true during Globex trading hours:
 *   Sunday 6:00 PM ET  through  Friday 5:00 PM ET
 *   with a daily maintenance break 5:00 PM - 6:00 PM ET (Mon-Thu)
 */
export function isMarketOpen(now?: Date): boolean {
  const date = now ?? new Date();
  const et = toEastern(date);
  const timeMinutes = et.hour * 60 + et.minute;

  // WHY: CME holidays = full-day closure (no Globex session).
  if (CME_HOLIDAYS.has(et.dateStr)) {
    return false;
  }

  // Saturday: always closed
  if (et.dayOfWeek === 6) return false;

  // Sunday: closed until 6:00 PM ET
  if (et.dayOfWeek === 0) {
    return timeMinutes >= 18 * 60; // 6:00 PM = 1080 minutes
  }

  // Friday: closes at 5:00 PM ET for the weekend
  if (et.dayOfWeek === 5) {
    return timeMinutes < 17 * 60; // Before 5:00 PM
  }

  // Mon-Thu: open except 5:00 PM - 6:00 PM maintenance break
  if (timeMinutes >= 17 * 60 && timeMinutes < 18 * 60) {
    return false; // Maintenance window
  }

  return true;
}

/**
 * Calculate hours since the market last closed.
 *
 * WHY: The after-hours buffer scales with sqrt(time) — the longer
 * the market has been closed, the more the underlying can move.
 * Returns 0 if the market is currently open.
 */
export function getHoursSinceClose(now?: Date): number {
  const date = now ?? new Date();

  if (isMarketOpen(date)) return 0;

  // Walk backward in 15-minute increments to find when market last closed
  // WHY: 15-min steps balance precision vs computation. The buffer formula
  // uses sqrt(hours/24), so 15-min precision changes the buffer by <0.1%.
  const maxLookback = 96 * 4; // 96 hours = 4 days (covers long weekends)
  const checkDate = new Date(date);

  for (let i = 0; i < maxLookback; i++) {
    checkDate.setMinutes(checkDate.getMinutes() - 15);
    if (isMarketOpen(checkDate)) {
      return (date.getTime() - checkDate.getTime()) / (1000 * 60 * 60);
    }
  }

  // WHY: If we can't find when it closed (e.g., extended holiday),
  // cap at 96 hours to avoid absurd buffer values.
  return 96;
}

/**
 * Calculate the after-hours volatility buffer as a multiplier.
 *
 * Formula: buffer = baseRate × sqrt(hoursSinceClose / 24)
 *
 * WHY: Price movements scale with the square root of time (same
 * principle underlying Black-Scholes). A 2-day weekend produces
 * ~1.4× the risk of a 1-day gap, not 2×.
 *
 * @param baseRate  Admin-tunable base rate (default 0.03 = 3%)
 * @returns Multiplier to inflate spot price (e.g., 0.035 = 3.5% buffer)
 *          Returns 0 if market is open.
 */
export function getAfterHoursBuffer(baseRate: number = 0.03, now?: Date): number {
  const hours = getHoursSinceClose(now);
  if (hours <= 0) return 0;

  return baseRate * Math.sqrt(hours / 24);
}

/**
 * Get the buffered spot price for pricing calculations.
 *
 * WHY: This is the entry point for the pricing engine. When the market
 * is open, returns the spot price unchanged. When closed, inflates it
 * by the time-scaled buffer. The member never sees the buffer — it's
 * baked silently into the premium.
 */
export function getBufferedSpotPrice(
  spotPrice: number,
  baseRate: number = 0.03,
  now?: Date
): number {
  const buffer = getAfterHoursBuffer(baseRate, now);
  return spotPrice * (1 + buffer);
}

/**
 * Get a human-readable market status for the admin dashboard.
 */
export function getMarketStatus(now?: Date): {
  isOpen: boolean;
  hoursSinceClose: number;
  currentBuffer: number;
  nextOpen: string;
} {
  const date = now ?? new Date();
  const open = isMarketOpen(date);
  const hours = open ? 0 : getHoursSinceClose(date);
  const buffer = open ? 0 : getAfterHoursBuffer(0.03, date);

  let nextOpen = "";
  if (!open) {
    const et = toEastern(date);
    if (et.dayOfWeek === 5 && et.hour * 60 + et.minute >= 17 * 60) {
      nextOpen = "Sunday 6:00 PM ET";
    } else if (et.dayOfWeek === 6) {
      nextOpen = "Sunday 6:00 PM ET";
    } else if (et.dayOfWeek === 0 && et.hour * 60 + et.minute < 18 * 60) {
      nextOpen = "Today 6:00 PM ET";
    } else {
      // Daily maintenance break (Mon-Thu 5-6 PM)
      nextOpen = "Today 6:00 PM ET";
    }
  }

  return { isOpen: open, hoursSinceClose: hours, currentBuffer: buffer, nextOpen };
}
