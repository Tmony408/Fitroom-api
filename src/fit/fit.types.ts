// Local, ORM-independent stretch type. Prisma's GarmentStretch enum
// ('NONE' | 'LOW' | 'MEDIUM' | 'HIGH') is assignable to this, so the pure
// engine stays decoupled from the database layer (and unit-testable without it).
export type GarmentStretch = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type FitPreference = 'tight' | 'regular' | 'relaxed' | 'oversized';

export interface SizeChart {
  sizes: string[];
  chest: number[];
  waist: number[];
}

export interface FitCheckInput {
  category: string; // Senator | Kaftan | Agbada | ...
  stretch: GarmentStretch;
  sizeChart: SizeChart;
  chest: number; // body chest (cm)
  waist: number; // body waist (cm)
  chestConfidence?: number; // 0-100
  waistConfidence?: number; // 0-100
  fitPreference: FitPreference;
}

export interface FitCheckResult {
  recommendedSize: string;
  fitConfidence: number; // 0-100
  warnings: string[];
  alternativeSize: string | null;
}
