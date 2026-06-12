import { IsIn, IsObject, IsOptional } from 'class-validator';
import { FitPreference } from '../../fit/fit.types';

/**
 * measurements shape: { [field: string]: { val: number; conf: number } }
 * Stored as JSON for flexibility across garment categories.
 */
export class CreateFitProfileDto {
  @IsObject()
  measurements: Record<string, { val: number; conf: number }>;

  @IsOptional()
  @IsIn(['tight', 'regular', 'relaxed', 'oversized'])
  fitPref?: FitPreference;
}
