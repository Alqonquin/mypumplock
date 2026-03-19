export interface VehicleSpec {
  year: number;
  make: string;
  model: string;
  tankGallons: number;
  combinedMpg: number;
  fuelType: "regular" | "midgrade" | "premium" | "diesel" | "electric";
}

// WHY: Top-selling US vehicles by volume (2020-2025). A production system
// would use the EPA API at fueleconomy.gov/ws/rest/vehicle to cover all
// ~45,000 model-year combinations.
export const VEHICLE_DATABASE: VehicleSpec[] = [
  // Trucks
  { year: 2024, make: "Ford", model: "F-150", tankGallons: 26.0, combinedMpg: 24, fuelType: "regular" },
  { year: 2023, make: "Ford", model: "F-150", tankGallons: 26.0, combinedMpg: 24, fuelType: "regular" },
  { year: 2022, make: "Ford", model: "F-150", tankGallons: 26.0, combinedMpg: 24, fuelType: "regular" },
  { year: 2021, make: "Ford", model: "F-150", tankGallons: 26.0, combinedMpg: 23, fuelType: "regular" },
  { year: 2020, make: "Ford", model: "F-150", tankGallons: 26.0, combinedMpg: 23, fuelType: "regular" },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500", tankGallons: 24.0, combinedMpg: 23, fuelType: "regular" },
  { year: 2023, make: "Chevrolet", model: "Silverado 1500", tankGallons: 24.0, combinedMpg: 23, fuelType: "regular" },
  { year: 2022, make: "Chevrolet", model: "Silverado 1500", tankGallons: 24.0, combinedMpg: 23, fuelType: "regular" },
  { year: 2024, make: "RAM", model: "1500", tankGallons: 26.0, combinedMpg: 22, fuelType: "regular" },
  { year: 2023, make: "RAM", model: "1500", tankGallons: 26.0, combinedMpg: 22, fuelType: "regular" },
  { year: 2022, make: "RAM", model: "1500", tankGallons: 26.0, combinedMpg: 22, fuelType: "regular" },
  { year: 2024, make: "Toyota", model: "Tacoma", tankGallons: 21.1, combinedMpg: 24, fuelType: "regular" },
  { year: 2023, make: "Toyota", model: "Tacoma", tankGallons: 21.1, combinedMpg: 22, fuelType: "regular" },
  { year: 2024, make: "Toyota", model: "Tundra", tankGallons: 22.5, combinedMpg: 20, fuelType: "regular" },
  { year: 2023, make: "Toyota", model: "Tundra", tankGallons: 22.5, combinedMpg: 20, fuelType: "regular" },
  { year: 2024, make: "GMC", model: "Sierra 1500", tankGallons: 24.0, combinedMpg: 23, fuelType: "regular" },
  { year: 2023, make: "GMC", model: "Sierra 1500", tankGallons: 24.0, combinedMpg: 23, fuelType: "regular" },
  { year: 2024, make: "Nissan", model: "Frontier", tankGallons: 21.1, combinedMpg: 24, fuelType: "regular" },
  { year: 2023, make: "Nissan", model: "Frontier", tankGallons: 21.1, combinedMpg: 24, fuelType: "regular" },

  // SUVs
  { year: 2024, make: "Toyota", model: "RAV4", tankGallons: 14.5, combinedMpg: 30, fuelType: "regular" },
  { year: 2023, make: "Toyota", model: "RAV4", tankGallons: 14.5, combinedMpg: 30, fuelType: "regular" },
  { year: 2022, make: "Toyota", model: "RAV4", tankGallons: 14.5, combinedMpg: 30, fuelType: "regular" },
  { year: 2024, make: "Honda", model: "CR-V", tankGallons: 14.0, combinedMpg: 30, fuelType: "regular" },
  { year: 2023, make: "Honda", model: "CR-V", tankGallons: 14.0, combinedMpg: 30, fuelType: "regular" },
  { year: 2024, make: "Tesla", model: "Model Y", tankGallons: 0, combinedMpg: 0, fuelType: "electric" },
  { year: 2024, make: "Chevrolet", model: "Equinox", tankGallons: 14.9, combinedMpg: 31, fuelType: "regular" },
  { year: 2023, make: "Chevrolet", model: "Equinox", tankGallons: 14.9, combinedMpg: 31, fuelType: "regular" },
  { year: 2024, make: "Ford", model: "Explorer", tankGallons: 17.9, combinedMpg: 26, fuelType: "regular" },
  { year: 2023, make: "Ford", model: "Explorer", tankGallons: 17.9, combinedMpg: 26, fuelType: "regular" },
  { year: 2024, make: "Jeep", model: "Grand Cherokee", tankGallons: 24.6, combinedMpg: 22, fuelType: "regular" },
  { year: 2023, make: "Jeep", model: "Grand Cherokee", tankGallons: 24.6, combinedMpg: 22, fuelType: "regular" },
  { year: 2024, make: "Jeep", model: "Wrangler", tankGallons: 17.5, combinedMpg: 22, fuelType: "regular" },
  { year: 2023, make: "Jeep", model: "Wrangler", tankGallons: 17.5, combinedMpg: 22, fuelType: "regular" },
  { year: 2024, make: "Hyundai", model: "Tucson", tankGallons: 13.7, combinedMpg: 29, fuelType: "regular" },
  { year: 2023, make: "Hyundai", model: "Tucson", tankGallons: 13.7, combinedMpg: 29, fuelType: "regular" },
  { year: 2024, make: "Kia", model: "Sportage", tankGallons: 13.7, combinedMpg: 29, fuelType: "regular" },
  { year: 2023, make: "Kia", model: "Sportage", tankGallons: 13.7, combinedMpg: 29, fuelType: "regular" },
  { year: 2024, make: "Subaru", model: "Outback", tankGallons: 18.5, combinedMpg: 29, fuelType: "regular" },
  { year: 2023, make: "Subaru", model: "Outback", tankGallons: 18.5, combinedMpg: 29, fuelType: "regular" },
  { year: 2024, make: "Toyota", model: "Highlander", tankGallons: 17.9, combinedMpg: 25, fuelType: "regular" },
  { year: 2023, make: "Toyota", model: "Highlander", tankGallons: 17.9, combinedMpg: 25, fuelType: "regular" },
  { year: 2024, make: "Ford", model: "Bronco", tankGallons: 17.4, combinedMpg: 21, fuelType: "regular" },
  { year: 2023, make: "Ford", model: "Bronco", tankGallons: 17.4, combinedMpg: 21, fuelType: "regular" },
  { year: 2024, make: "Chevrolet", model: "Tahoe", tankGallons: 24.0, combinedMpg: 19, fuelType: "regular" },
  { year: 2023, make: "Chevrolet", model: "Tahoe", tankGallons: 24.0, combinedMpg: 19, fuelType: "regular" },
  { year: 2024, make: "Ford", model: "Expedition", tankGallons: 23.2, combinedMpg: 19, fuelType: "regular" },
  { year: 2023, make: "Ford", model: "Expedition", tankGallons: 23.2, combinedMpg: 19, fuelType: "regular" },
  { year: 2024, make: "Chevrolet", model: "Suburban", tankGallons: 24.0, combinedMpg: 19, fuelType: "regular" },
  { year: 2023, make: "Chevrolet", model: "Suburban", tankGallons: 24.0, combinedMpg: 19, fuelType: "regular" },

  // Sedans
  { year: 2024, make: "Toyota", model: "Camry", tankGallons: 14.5, combinedMpg: 32, fuelType: "regular" },
  { year: 2023, make: "Toyota", model: "Camry", tankGallons: 14.5, combinedMpg: 32, fuelType: "regular" },
  { year: 2022, make: "Toyota", model: "Camry", tankGallons: 14.5, combinedMpg: 32, fuelType: "regular" },
  { year: 2024, make: "Honda", model: "Civic", tankGallons: 12.4, combinedMpg: 36, fuelType: "regular" },
  { year: 2023, make: "Honda", model: "Civic", tankGallons: 12.4, combinedMpg: 36, fuelType: "regular" },
  { year: 2024, make: "Honda", model: "Accord", tankGallons: 14.8, combinedMpg: 32, fuelType: "regular" },
  { year: 2023, make: "Honda", model: "Accord", tankGallons: 14.8, combinedMpg: 32, fuelType: "regular" },
  { year: 2024, make: "Toyota", model: "Corolla", tankGallons: 13.2, combinedMpg: 35, fuelType: "regular" },
  { year: 2023, make: "Toyota", model: "Corolla", tankGallons: 13.2, combinedMpg: 35, fuelType: "regular" },
  { year: 2024, make: "Hyundai", model: "Elantra", tankGallons: 12.4, combinedMpg: 36, fuelType: "regular" },
  { year: 2023, make: "Hyundai", model: "Elantra", tankGallons: 12.4, combinedMpg: 36, fuelType: "regular" },
  { year: 2024, make: "Nissan", model: "Altima", tankGallons: 16.2, combinedMpg: 32, fuelType: "regular" },
  { year: 2023, make: "Nissan", model: "Altima", tankGallons: 16.2, combinedMpg: 32, fuelType: "regular" },
  { year: 2024, make: "Hyundai", model: "Sonata", tankGallons: 16.0, combinedMpg: 32, fuelType: "regular" },
  { year: 2023, make: "Hyundai", model: "Sonata", tankGallons: 16.0, combinedMpg: 32, fuelType: "regular" },
  { year: 2024, make: "Kia", model: "K5", tankGallons: 15.8, combinedMpg: 32, fuelType: "regular" },
  { year: 2023, make: "Kia", model: "K5", tankGallons: 15.8, combinedMpg: 32, fuelType: "regular" },

  // Minivans
  { year: 2024, make: "Honda", model: "Odyssey", tankGallons: 19.5, combinedMpg: 22, fuelType: "regular" },
  { year: 2023, make: "Honda", model: "Odyssey", tankGallons: 19.5, combinedMpg: 22, fuelType: "regular" },
  { year: 2024, make: "Toyota", model: "Sienna", tankGallons: 18.0, combinedMpg: 36, fuelType: "regular" },
  { year: 2023, make: "Toyota", model: "Sienna", tankGallons: 18.0, combinedMpg: 36, fuelType: "regular" },
  { year: 2024, make: "Chrysler", model: "Pacifica", tankGallons: 19.0, combinedMpg: 22, fuelType: "regular" },
  { year: 2023, make: "Chrysler", model: "Pacifica", tankGallons: 19.0, combinedMpg: 22, fuelType: "regular" },

  // Sports / Premium
  { year: 2024, make: "BMW", model: "3 Series", tankGallons: 15.6, combinedMpg: 30, fuelType: "premium" },
  { year: 2023, make: "BMW", model: "3 Series", tankGallons: 15.6, combinedMpg: 30, fuelType: "premium" },
  { year: 2024, make: "Mercedes-Benz", model: "C-Class", tankGallons: 17.4, combinedMpg: 30, fuelType: "premium" },
  { year: 2023, make: "Mercedes-Benz", model: "C-Class", tankGallons: 17.4, combinedMpg: 30, fuelType: "premium" },
  { year: 2024, make: "Audi", model: "A4", tankGallons: 15.3, combinedMpg: 30, fuelType: "premium" },
  { year: 2023, make: "Audi", model: "A4", tankGallons: 15.3, combinedMpg: 30, fuelType: "premium" },
  { year: 2024, make: "Lexus", model: "RX", tankGallons: 17.7, combinedMpg: 28, fuelType: "regular" },
  { year: 2023, make: "Lexus", model: "RX", tankGallons: 17.7, combinedMpg: 28, fuelType: "regular" },
];

export function getUniqueMakes(): string[] {
  return [...new Set(VEHICLE_DATABASE.map((v) => v.make))].sort();
}

export function getModelsForMake(make: string): string[] {
  return [
    ...new Set(
      VEHICLE_DATABASE.filter((v) => v.make === make).map((v) => v.model),
    ),
  ].sort();
}

export function getYearsForMakeModel(make: string, model: string): number[] {
  return [
    ...new Set(
      VEHICLE_DATABASE.filter(
        (v) => v.make === make && v.model === model,
      ).map((v) => v.year),
    ),
  ].sort((a, b) => b - a);
}

export function estimateMonthlyGallons(
  mpg: number,
  monthlyMiles: number,
): number {
  if (mpg <= 0) return 0;
  return Math.round(monthlyMiles / mpg);
}
