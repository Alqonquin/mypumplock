import { NextRequest, NextResponse } from "next/server";

const EPA_BASE = "https://www.fueleconomy.gov/ws/rest";
const HEADERS = { Accept: "application/json" };

/**
 * Proxy for the EPA fueleconomy.gov API.
 * Query params:
 *   - step=makes&year=2005          → list of makes for that year
 *   - step=models&year=2005&make=Porsche  → list of models
 *   - step=options&year=2005&make=Porsche&model=Cayenne → trims/options
 *   - step=vehicle&id=21455         → full vehicle data (MPG, fuel type, etc.)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const step = searchParams.get("step");

  if (!step) {
    return NextResponse.json({ error: "Missing step parameter" }, { status: 400 });
  }

  try {
    let url: string;

    switch (step) {
      case "makes": {
        const year = searchParams.get("year");
        if (!year) return NextResponse.json({ error: "Missing year" }, { status: 400 });
        url = `${EPA_BASE}/vehicle/menu/make?year=${year}`;
        break;
      }
      case "models": {
        const year = searchParams.get("year");
        const make = searchParams.get("make");
        if (!year || !make) return NextResponse.json({ error: "Missing year or make" }, { status: 400 });
        url = `${EPA_BASE}/vehicle/menu/model?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}`;
        break;
      }
      case "options": {
        const year = searchParams.get("year");
        const make = searchParams.get("make");
        const model = searchParams.get("model");
        if (!year || !make || !model) return NextResponse.json({ error: "Missing year, make, or model" }, { status: 400 });
        url = `${EPA_BASE}/vehicle/menu/options?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
        break;
      }
      case "vehicle": {
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Missing vehicle id" }, { status: 400 });
        url = `${EPA_BASE}/vehicle/${encodeURIComponent(id)}`;
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      return NextResponse.json({ error: `EPA API returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch from EPA API" }, { status: 502 });
  }
}
