/**
 * Address autocomplete using OpenStreetMap Nominatim (free, no API key).
 *
 * WHY Nominatim: No billing setup, no API key, sufficient accuracy for
 * city/state-level gas price lookup. Rate limit is 1 req/sec — we debounce
 * on the client side to stay well within that.
 */

export interface AddressResult {
  displayName: string;
  city: string;
  state: string;
  stateCode: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
}

// WHY: Map full state names to 2-letter codes for gas price lookup.
// Nominatim returns full names; our gas-prices.ts uses codes.
const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

function stateNameToCode(name: string): string {
  return STATE_NAME_TO_CODE[name.toLowerCase()] ?? name;
}

/**
 * Search for US addresses using Nominatim.
 * Returns up to 5 results, filtered to US only.
 */
export async function searchAddresses(query: string): Promise<AddressResult[]> {
  if (query.length < 3) return [];

  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    countrycodes: "us", // WHY: Only return US results server-side
    limit: "5",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        // WHY: Nominatim TOS requires identifying your app
        "User-Agent": "PumpLock/1.0 (mypumplock.com)",
      },
    }
  );

  if (!res.ok) return [];

  const data = await res.json();

  return data
    .filter((item: any) => item.address?.country_code === "us")
    .map((item: any) => {
      const addr = item.address;
      const city =
        addr.city || addr.town || addr.village || addr.hamlet || addr.county || "";
      const state = addr.state || "";
      return {
        displayName: formatDisplayName(city, state),
        city,
        state,
        stateCode: stateNameToCode(state),
        country: addr.country || "United States",
        countryCode: addr.country_code || "us",
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      };
    })
    // WHY: Deduplicate results that resolve to the same city+state
    .filter(
      (item: AddressResult, index: number, arr: AddressResult[]) =>
        arr.findIndex(
          (other) => other.city === item.city && other.stateCode === item.stateCode
        ) === index
    );
}

function formatDisplayName(city: string, state: string): string {
  if (city && state) return `${city}, ${stateNameToCode(state)}`;
  if (state) return state;
  if (city) return city;
  return "Unknown location";
}

/**
 * Check if a raw query looks like a non-US address.
 * Used for the free-text fallback when Nominatim returns no US results.
 */
export async function isNonUsAddress(query: string): Promise<boolean> {
  if (query.length < 3) return false;

  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "3",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: { "User-Agent": "PumpLock/1.0 (mypumplock.com)" },
    }
  );

  if (!res.ok) return false;

  const data = await res.json();
  // If we get results but none are US, it's a non-US address
  return data.length > 0 && data.every((item: any) => item.address?.country_code !== "us");
}
