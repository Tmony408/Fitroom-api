import { BadRequestException, Injectable } from '@nestjs/common';

export type MeasurementMap = Record<string, { val: number; conf: number }>;

export interface EstimateInput {
  declaredHeightCm: number;
  hasFront: boolean;
  hasSide: boolean;
  qualityScore?: number; // 0..1 capture quality (lighting/pose); defaults 0.7
}

export interface EstimateResult {
  measurements: MeasurementMap;
  modelVersion: string;
}

/**
 * Measurement estimator (Batch 3) — pure & deterministic.
 *
 * MVP approach: anthropometric ratio scaling. Given a declared height and the
 * presence/quality of front+side photos, we scale standard adult body
 * proportions to produce a full measurement set with per-field confidence.
 * This is a legitimate, explainable baseline AND a clean seam: a real
 * photo-based model / SDK (3DLOOK, Bold Metrics, MirrorSize) can replace
 * `estimate()` behind the same interface without touching callers.
 */
@Injectable()
export class MeasurementEstimatorService {
  static readonly MODEL_VERSION = 'heuristic-anthro-v1';

  /** Body proportions as a fraction of height (approx adult male baseline). */
  private static readonly RATIOS: Record<string, number> = {
    height: 1.0,
    shoulder: 0.245,
    chest: 0.52,
    waist: 0.45,
    hip: 0.515,
    neck: 0.205,
    armLength: 0.34,
    sleeve: 0.33,
    bicep: 0.18,
    wrist: 0.095,
    thigh: 0.31,
    topLength: 0.44,
    trouser: 0.58,
    inseam: 0.45,
  };

  /** Length-type fields are easier to infer from height than circumferences. */
  private static readonly LENGTH_FIELDS = new Set([
    'height', 'shoulder', 'armLength', 'sleeve', 'wrist', 'topLength', 'trouser', 'inseam',
  ]);

  estimate(input: EstimateInput): EstimateResult {
    const h = input.declaredHeightCm;
    if (!(h >= 120 && h <= 230)) {
      throw new BadRequestException('declaredHeightCm must be between 120 and 230');
    }
    const quality = input.qualityScore ?? 0.7;

    const measurements: MeasurementMap = {};
    for (const [field, ratio] of Object.entries(MeasurementEstimatorService.RATIOS)) {
      const val = Math.round(h * ratio);
      measurements[field] = { val, conf: this.confidence(field, input, quality) };
    }
    // Height itself is declared, not estimated → high confidence.
    measurements.height = { val: h, conf: 99 };

    return { measurements, modelVersion: MeasurementEstimatorService.MODEL_VERSION };
  }

  private confidence(field: string, input: EstimateInput, quality: number): number {
    let c = 50;
    if (input.hasFront) c += 14;
    if (input.hasSide) c += 14;
    // photos help circumferences (chest/waist/hip) the most
    const isLength = MeasurementEstimatorService.LENGTH_FIELDS.has(field);
    c += isLength ? 6 : input.hasSide ? 4 : -6; // circumferences really want a side view
    c += Math.round((quality - 0.7) * 20); // quality nudges +/-
    return Math.max(40, Math.min(92, Math.round(c)));
  }
}
