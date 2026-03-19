"""
Gas Price Shield — Vehicle Database

Maps make/model/year to tank size and fuel efficiency (MPG).
In production this would call the EPA fueleconomy.gov API or a similar
data source. For now, a curated lookup of common US vehicles.

Data source: fueleconomy.gov combined MPG estimates, rounded.
"""

from dataclasses import dataclass


@dataclass
class VehicleSpec:
    """Fuel-relevant specs for a registered vehicle."""
    year: int
    make: str
    model: str
    tank_gallons: float     # Fuel tank capacity in gallons
    combined_mpg: float     # EPA combined city/highway MPG
    fuel_type: str = "regular"  # regular, midgrade, premium, diesel


# WHY: This covers the top-selling vehicles in the US by volume (2020-2025).
# A production system would use the EPA API at fueleconomy.gov/ws/rest/vehicle
# to cover all ~45,000 model-year combinations.
VEHICLE_DATABASE: list[VehicleSpec] = [
    # --- Trucks ---
    VehicleSpec(2024, "Ford", "F-150", 26.0, 24, "regular"),
    VehicleSpec(2023, "Ford", "F-150", 26.0, 24, "regular"),
    VehicleSpec(2022, "Ford", "F-150", 26.0, 24, "regular"),
    VehicleSpec(2021, "Ford", "F-150", 26.0, 23, "regular"),
    VehicleSpec(2020, "Ford", "F-150", 26.0, 23, "regular"),
    VehicleSpec(2024, "Chevrolet", "Silverado 1500", 24.0, 23, "regular"),
    VehicleSpec(2023, "Chevrolet", "Silverado 1500", 24.0, 23, "regular"),
    VehicleSpec(2022, "Chevrolet", "Silverado 1500", 24.0, 23, "regular"),
    VehicleSpec(2024, "RAM", "1500", 26.0, 22, "regular"),
    VehicleSpec(2023, "RAM", "1500", 26.0, 22, "regular"),
    VehicleSpec(2022, "RAM", "1500", 26.0, 22, "regular"),
    VehicleSpec(2024, "Toyota", "Tacoma", 21.1, 24, "regular"),
    VehicleSpec(2023, "Toyota", "Tacoma", 21.1, 22, "regular"),
    VehicleSpec(2024, "Toyota", "Tundra", 22.5, 20, "regular"),
    VehicleSpec(2023, "Toyota", "Tundra", 22.5, 20, "regular"),
    VehicleSpec(2024, "GMC", "Sierra 1500", 24.0, 23, "regular"),
    VehicleSpec(2023, "GMC", "Sierra 1500", 24.0, 23, "regular"),
    VehicleSpec(2024, "Nissan", "Frontier", 21.1, 24, "regular"),
    VehicleSpec(2023, "Nissan", "Frontier", 21.1, 24, "regular"),

    # --- SUVs ---
    VehicleSpec(2024, "Toyota", "RAV4", 14.5, 30, "regular"),
    VehicleSpec(2023, "Toyota", "RAV4", 14.5, 30, "regular"),
    VehicleSpec(2022, "Toyota", "RAV4", 14.5, 30, "regular"),
    VehicleSpec(2024, "Honda", "CR-V", 14.0, 30, "regular"),
    VehicleSpec(2023, "Honda", "CR-V", 14.0, 30, "regular"),
    VehicleSpec(2024, "Tesla", "Model Y", 0.0, 0, "electric"),  # No gas needed
    VehicleSpec(2024, "Chevrolet", "Equinox", 14.9, 31, "regular"),
    VehicleSpec(2023, "Chevrolet", "Equinox", 14.9, 31, "regular"),
    VehicleSpec(2024, "Ford", "Explorer", 17.9, 26, "regular"),
    VehicleSpec(2023, "Ford", "Explorer", 17.9, 26, "regular"),
    VehicleSpec(2024, "Jeep", "Grand Cherokee", 24.6, 22, "regular"),
    VehicleSpec(2023, "Jeep", "Grand Cherokee", 24.6, 22, "regular"),
    VehicleSpec(2024, "Jeep", "Wrangler", 17.5, 22, "regular"),
    VehicleSpec(2023, "Jeep", "Wrangler", 17.5, 22, "regular"),
    VehicleSpec(2024, "Hyundai", "Tucson", 13.7, 29, "regular"),
    VehicleSpec(2023, "Hyundai", "Tucson", 13.7, 29, "regular"),
    VehicleSpec(2024, "Kia", "Sportage", 13.7, 29, "regular"),
    VehicleSpec(2023, "Kia", "Sportage", 13.7, 29, "regular"),
    VehicleSpec(2024, "Subaru", "Outback", 18.5, 29, "regular"),
    VehicleSpec(2023, "Subaru", "Outback", 18.5, 29, "regular"),
    VehicleSpec(2024, "Toyota", "Highlander", 17.9, 25, "regular"),
    VehicleSpec(2023, "Toyota", "Highlander", 17.9, 25, "regular"),
    VehicleSpec(2024, "Ford", "Bronco", 17.4, 21, "regular"),
    VehicleSpec(2023, "Ford", "Bronco", 17.4, 21, "regular"),
    VehicleSpec(2024, "Chevrolet", "Tahoe", 24.0, 19, "regular"),
    VehicleSpec(2023, "Chevrolet", "Tahoe", 24.0, 19, "regular"),
    VehicleSpec(2024, "Ford", "Expedition", 23.2, 19, "regular"),
    VehicleSpec(2023, "Ford", "Expedition", 23.2, 19, "regular"),
    VehicleSpec(2024, "Chevrolet", "Suburban", 24.0, 19, "regular"),
    VehicleSpec(2023, "Chevrolet", "Suburban", 24.0, 19, "regular"),

    # --- Sedans ---
    VehicleSpec(2024, "Toyota", "Camry", 14.5, 32, "regular"),
    VehicleSpec(2023, "Toyota", "Camry", 14.5, 32, "regular"),
    VehicleSpec(2022, "Toyota", "Camry", 14.5, 32, "regular"),
    VehicleSpec(2024, "Honda", "Civic", 12.4, 36, "regular"),
    VehicleSpec(2023, "Honda", "Civic", 12.4, 36, "regular"),
    VehicleSpec(2024, "Honda", "Accord", 14.8, 32, "regular"),
    VehicleSpec(2023, "Honda", "Accord", 14.8, 32, "regular"),
    VehicleSpec(2024, "Toyota", "Corolla", 13.2, 35, "regular"),
    VehicleSpec(2023, "Toyota", "Corolla", 13.2, 35, "regular"),
    VehicleSpec(2024, "Hyundai", "Elantra", 12.4, 36, "regular"),
    VehicleSpec(2023, "Hyundai", "Elantra", 12.4, 36, "regular"),
    VehicleSpec(2024, "Nissan", "Altima", 16.2, 32, "regular"),
    VehicleSpec(2023, "Nissan", "Altima", 16.2, 32, "regular"),
    VehicleSpec(2024, "Hyundai", "Sonata", 16.0, 32, "regular"),
    VehicleSpec(2023, "Hyundai", "Sonata", 16.0, 32, "regular"),
    VehicleSpec(2024, "Kia", "K5", 15.8, 32, "regular"),
    VehicleSpec(2023, "Kia", "K5", 15.8, 32, "regular"),

    # --- Minivans ---
    VehicleSpec(2024, "Honda", "Odyssey", 19.5, 22, "regular"),
    VehicleSpec(2023, "Honda", "Odyssey", 19.5, 22, "regular"),
    VehicleSpec(2024, "Toyota", "Sienna", 18.0, 36, "regular"),  # Hybrid only
    VehicleSpec(2023, "Toyota", "Sienna", 18.0, 36, "regular"),
    VehicleSpec(2024, "Chrysler", "Pacifica", 19.0, 22, "regular"),
    VehicleSpec(2023, "Chrysler", "Pacifica", 19.0, 22, "regular"),

    # --- Sports / Premium ---
    VehicleSpec(2024, "BMW", "3 Series", 15.6, 30, "premium"),
    VehicleSpec(2023, "BMW", "3 Series", 15.6, 30, "premium"),
    VehicleSpec(2024, "Mercedes-Benz", "C-Class", 17.4, 30, "premium"),
    VehicleSpec(2023, "Mercedes-Benz", "C-Class", 17.4, 30, "premium"),
    VehicleSpec(2024, "Audi", "A4", 15.3, 30, "premium"),
    VehicleSpec(2023, "Audi", "A4", 15.3, 30, "premium"),
    VehicleSpec(2024, "Lexus", "RX", 17.7, 28, "regular"),
    VehicleSpec(2023, "Lexus", "RX", 17.7, 28, "regular"),
]


def search_vehicles(
    make: str | None = None,
    model: str | None = None,
    year: int | None = None,
) -> list[VehicleSpec]:
    """
    Search the vehicle database with fuzzy matching on make/model.
    Returns matching vehicles sorted by year descending.
    """
    results = []
    for v in VEHICLE_DATABASE:
        if year is not None and v.year != year:
            continue
        if make is not None and make.lower() not in v.make.lower():
            continue
        if model is not None and model.lower() not in v.model.lower():
            continue
        results.append(v)

    results.sort(key=lambda v: (-v.year, v.make, v.model))
    return results


def get_unique_makes() -> list[str]:
    """Return sorted list of unique makes in the database."""
    return sorted(set(v.make for v in VEHICLE_DATABASE))


def get_models_for_make(make: str) -> list[str]:
    """Return sorted list of unique models for a given make."""
    return sorted(set(
        v.model for v in VEHICLE_DATABASE
        if make.lower() in v.make.lower()
    ))


def get_years_for_make_model(make: str, model: str) -> list[int]:
    """Return sorted list of available years for a make/model."""
    return sorted(set(
        v.year for v in VEHICLE_DATABASE
        if make.lower() in v.make.lower()
        and model.lower() in v.model.lower()
    ), reverse=True)


def estimate_monthly_gallons(vehicle: VehicleSpec, weekly_miles: float) -> float:
    """
    Estimate gallons consumed per month from weekly miles and the vehicle's MPG.

    WHY: 4.33 weeks/month is the standard conversion (52 weeks / 12 months).
    """
    if vehicle.combined_mpg <= 0:
        return 0.0  # Electric vehicle — no gas needed
    weekly_gallons = weekly_miles / vehicle.combined_mpg
    monthly_gallons = weekly_gallons * 4.33  # 52 weeks / 12 months ≈ 4.33
    return round(monthly_gallons, 1)
