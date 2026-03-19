"""
Gas Price Shield — Local Gas Price Lookup

Fetches average retail gas prices by area. In production, this would use:
- GasBuddy API (real-time station-level pricing)
- AAA Gas Prices API
- EIA (Energy Information Administration) weekly regional data
- CollectAPI or similar aggregators

For now, we use the EIA's publicly available regional averages as defaults
and provide a structure for plugging in real-time APIs later.
"""

from dataclasses import dataclass

# WHY: EIA divides the US into 5 PADDs (Petroleum Administration for Defense
# Districts). These are the standard regions for fuel price reporting.
# Prices below are approximate March 2026 retail regular averages ($/gal).
# In production, these would be fetched live from the EIA API.

EIA_PADD_PRICES = {
    "PADD 1 (East Coast)": 3.15,
    "PADD 1A (New England)": 3.25,
    "PADD 1B (Central Atlantic)": 3.20,
    "PADD 1C (Lower Atlantic)": 3.00,
    "PADD 2 (Midwest)": 2.95,
    "PADD 3 (Gulf Coast)": 2.75,
    "PADD 4 (Rocky Mountain)": 3.10,
    "PADD 5 (West Coast)": 4.15,
}

# WHY: State-level averages give better precision than PADD regions.
# These approximate values are for illustration; production would
# pull from AAA or GasBuddy daily.
STATE_AVERAGES: dict[str, float] = {
    "AL": 2.80, "AK": 3.60, "AZ": 3.25, "AR": 2.75, "CA": 4.55,
    "CO": 3.05, "CT": 3.30, "DE": 3.10, "FL": 3.10, "GA": 2.90,
    "HI": 4.70, "ID": 3.20, "IL": 3.40, "IN": 3.10, "IA": 2.90,
    "KS": 2.85, "KY": 2.95, "LA": 2.70, "ME": 3.20, "MD": 3.15,
    "MA": 3.25, "MI": 3.15, "MN": 3.00, "MS": 2.70, "MO": 2.80,
    "MT": 3.15, "NE": 2.90, "NV": 3.75, "NH": 3.15, "NJ": 3.10,
    "NM": 3.05, "NY": 3.40, "NC": 2.95, "ND": 3.00, "OH": 3.05,
    "OK": 2.75, "OR": 3.70, "PA": 3.35, "RI": 3.25, "SC": 2.85,
    "SD": 3.00, "TN": 2.85, "TX": 2.75, "UT": 3.15, "VT": 3.25,
    "VA": 3.00, "WA": 4.00, "WV": 3.10, "WI": 2.95, "WY": 3.15,
    "DC": 3.30,
}

# WHY: Major metro areas often diverge significantly from state averages
# due to local taxes, refinery proximity, and competition.
METRO_AVERAGES: dict[str, float] = {
    "Miami, FL": 3.25, "Fort Lauderdale, FL": 3.20, "Tampa, FL": 3.05,
    "Orlando, FL": 3.10, "Jacksonville, FL": 2.95,
    "New York, NY": 3.55, "Los Angeles, CA": 4.65, "San Francisco, CA": 4.80,
    "Chicago, IL": 3.50, "Houston, TX": 2.70, "Dallas, TX": 2.80,
    "Phoenix, AZ": 3.30, "Philadelphia, PA": 3.40, "San Antonio, TX": 2.75,
    "San Diego, CA": 4.50, "Austin, TX": 2.80, "Denver, CO": 3.10,
    "Seattle, WA": 4.10, "Portland, OR": 3.75, "Atlanta, GA": 2.95,
    "Boston, MA": 3.35, "Nashville, TN": 2.90, "Charlotte, NC": 2.95,
    "Detroit, MI": 3.20, "Minneapolis, MN": 3.05, "Las Vegas, NV": 3.80,
    "Baltimore, MD": 3.20, "Washington, DC": 3.35, "Milwaukee, WI": 3.00,
    "Kansas City, MO": 2.85, "St. Louis, MO": 2.85, "Indianapolis, IN": 3.10,
    "Columbus, OH": 3.10, "Cleveland, OH": 3.10, "Pittsburgh, PA": 3.30,
    "Cincinnati, OH": 3.05, "Salt Lake City, UT": 3.20,
    "San Jose, CA": 4.70, "Sacramento, CA": 4.40,
}


@dataclass
class LocalPriceResult:
    """Result of a local gas price lookup."""
    price: float            # Average price $/gal
    area_name: str          # Name of the matched area
    source: str             # "metro", "state", "padd", or "national"
    fuel_type: str = "regular"


# WHY: National average is the ultimate fallback when no location match exists.
NATIONAL_AVERAGE = 3.10


def lookup_price_by_state(state_code: str) -> LocalPriceResult | None:
    """Look up average gas price by 2-letter state code."""
    code = state_code.upper().strip()
    if code in STATE_AVERAGES:
        return LocalPriceResult(
            price=STATE_AVERAGES[code],
            area_name=code,
            source="state",
        )
    return None


def lookup_price_by_metro(metro_query: str) -> LocalPriceResult | None:
    """Fuzzy-match a metro area name and return its gas price."""
    query = metro_query.lower().strip()
    for metro_name, price in METRO_AVERAGES.items():
        if query in metro_name.lower():
            return LocalPriceResult(
                price=price,
                area_name=metro_name,
                source="metro",
            )
    return None


def lookup_price(query: str) -> LocalPriceResult:
    """
    Try to resolve a location query to a gas price.
    Checks metro areas first, then states, then falls back to national average.
    """
    # Try metro first (most specific)
    result = lookup_price_by_metro(query)
    if result:
        return result

    # Try state code
    result = lookup_price_by_state(query)
    if result:
        return result

    # Fallback to national average
    return LocalPriceResult(
        price=NATIONAL_AVERAGE,
        area_name="National Average",
        source="national",
    )


def get_all_metros() -> list[str]:
    """Return sorted list of all metro area names."""
    return sorted(METRO_AVERAGES.keys())


def get_all_states() -> list[str]:
    """Return sorted list of all state codes."""
    return sorted(STATE_AVERAGES.keys())
