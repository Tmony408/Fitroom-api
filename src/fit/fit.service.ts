import { BadRequestException, Injectable } from '@nestjs/common';
import { FitCheckInput, FitCheckResult, FitPreference, GarmentStretch, SizeChart } from './fit.types';

/**
 * Rules-based fit/size engine (Batch 1).
 *
 * Ported from the validated prototype logic. Pure & deterministic so it can be
 * unit-tested without a database and later A/B-compared against an ML model.
 *
 * Inputs are in centimetres. Money/size logic never depends on I/O.
 */
@Injectable()
export class FitService {
  /** Ease allowance (cm) added to body measurement, per garment category. */
  private static readonly EASE: Record<string, { chest: number; waist: number }> = {
    Senator: { chest: 8, waist: 6 },
    Kaftan: { chest: 12, waist: 14 },
    Agbada: { chest: 16, waist: 18 },
  };

  private static readonly DEFAULT_EASE = { chest: 8, waist: 6 };

  /** Effective extra room (cm) the fabric gives by stretch class. */
  private static readonly STRETCH_BONUS: Record<GarmentStretch, number> = {
    NONE: 0,
    LOW: 2,
    MEDIUM: 5,
    HIGH: 9,
  };

  /** Adjustment (cm) applied to the target measurement by fit preference. */
  private static readonly PREF_ADJ: Record<FitPreference, number> = {
    tight: -2,
    regular: 0,
    relaxed: 3,
    oversized: 7,
  };

  computeFit(input: FitCheckInput): FitCheckResult {
    this.validate(input);

    const ease = FitService.EASE[input.category] ?? FitService.DEFAULT_EASE;
    const stretch = FitService.STRETCH_BONUS[input.stretch] ?? 0;
    const adj = FitService.PREF_ADJ[input.fitPreference] ?? 0;

    const targetChest = input.chest + ease.chest + adj;

    // Pick the size whose stretched chest is closest to the target chest.
    let bestIdx = 0;
    let bestGap = Number.POSITIVE_INFINITY;
    input.sizeChart.sizes.forEach((_size, i) => {
      const gap = Math.abs(input.sizeChart.chest[i] + stretch - targetChest);
      if (gap < bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    });

    const garChest = input.sizeChart.chest[bestIdx] + stretch;
    const garWaist = input.sizeChart.waist[bestIdx] + stretch;

    const warnings: string[] = [];
    if (garChest < input.chest + 2) {
      warnings.push(`Chest may be tight by ${input.chest + 2 - garChest}cm`);
    }
    if (garWaist < input.waist + 1) {
      warnings.push(`Waist may be tight by ${input.waist + 1 - garWaist}cm`);
    }
    if (garChest > targetChest + 6) {
      warnings.push('Loose through the chest — size down for a sharper fit');
    }

    const mConf =
      ((input.chestConfidence ?? 90) + (input.waistConfidence ?? 90)) / 2;
    const fitConfidence = Math.max(40, Math.min(97, Math.round(mConf - bestGap * 2)));

    const alternativeSize =
      bestIdx < input.sizeChart.sizes.length - 1
        ? input.sizeChart.sizes[bestIdx + 1]
        : null;

    return {
      recommendedSize: input.sizeChart.sizes[bestIdx],
      fitConfidence,
      warnings,
      alternativeSize,
    };
  }

  private validate(input: FitCheckInput): void {
    const sc: SizeChart | undefined = input.sizeChart;
    if (!sc || !Array.isArray(sc.sizes) || sc.sizes.length === 0) {
      throw new BadRequestException('sizeChart.sizes must be a non-empty array');
    }
    if (sc.chest?.length !== sc.sizes.length || sc.waist?.length !== sc.sizes.length) {
      throw new BadRequestException('sizeChart chest/waist must align with sizes');
    }
    if (!(input.chest > 0) || !(input.waist > 0)) {
      throw new BadRequestException('chest and waist must be positive numbers');
    }
  }
}
