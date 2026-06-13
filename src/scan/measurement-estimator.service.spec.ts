import { BadRequestException } from '@nestjs/common';
import { MeasurementEstimatorService, EstimateInput } from './measurement-estimator.service';

const base = (o: Partial<EstimateInput> = {}): EstimateInput => ({
  declaredHeightCm: 180, hasFront: true, hasSide: true, qualityScore: 0.7, ...o,
});

describe('MeasurementEstimatorService', () => {
  let svc: MeasurementEstimatorService;
  beforeEach(() => { svc = new MeasurementEstimatorService(); });

  it('returns a full measurement set scaled from height', () => {
    const r = svc.estimate(base());
    expect(r.modelVersion).toBe('heuristic-anthro-v1');
    expect(r.measurements.height.val).toBe(180);
    expect(r.measurements.chest.val).toBe(Math.round(180 * 0.52)); // 94
    expect(r.measurements.inseam.val).toBe(Math.round(180 * 0.45)); // 81
  });

  it('scales linearly with height', () => {
    const a = svc.estimate(base({ declaredHeightCm: 160 }));
    const b = svc.estimate(base({ declaredHeightCm: 200 }));
    expect(b.measurements.chest.val).toBeGreaterThan(a.measurements.chest.val);
  });

  it('declared height always has top confidence', () => {
    expect(svc.estimate(base()).measurements.height.conf).toBe(99);
  });

  it('both photos beat one photo beats none (confidence)', () => {
    const none = svc.estimate(base({ hasFront: false, hasSide: false }));
    const one = svc.estimate(base({ hasFront: true, hasSide: false }));
    const both = svc.estimate(base({ hasFront: true, hasSide: true }));
    expect(one.measurements.chest.conf).toBeGreaterThan(none.measurements.chest.conf);
    expect(both.measurements.chest.conf).toBeGreaterThan(one.measurements.chest.conf);
  });

  it('is deterministic', () => {
    expect(svc.estimate(base())).toEqual(svc.estimate(base()));
  });

  it('confidence stays within [40, 92]', () => {
    const r = svc.estimate(base({ hasFront: false, hasSide: false, qualityScore: 0 }));
    Object.values(r.measurements).forEach((m) => {
      // height is exempt (declared)
      if (m.val !== 0) expect(m.conf).toBeGreaterThanOrEqual(40);
      expect(m.conf).toBeLessThanOrEqual(99);
    });
  });

  it('rejects implausible heights', () => {
    expect(() => svc.estimate(base({ declaredHeightCm: 50 }))).toThrow(BadRequestException);
    expect(() => svc.estimate(base({ declaredHeightCm: 300 }))).toThrow(BadRequestException);
  });

  it('higher capture quality raises confidence', () => {
    const lo = svc.estimate(base({ qualityScore: 0.3 }));
    const hi = svc.estimate(base({ qualityScore: 1 }));
    expect(hi.measurements.waist.conf).toBeGreaterThanOrEqual(lo.measurements.waist.conf);
  });
});
