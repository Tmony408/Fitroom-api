import { BadRequestException } from '@nestjs/common';
import { FitService } from './fit.service';
import { FitCheckInput } from './fit.types';

const SENATOR_CHART = {
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  chest: [96, 100, 104, 108, 112],
  waist: [84, 88, 92, 96, 100],
};

function base(overrides: Partial<FitCheckInput> = {}): FitCheckInput {
  return {
    category: 'Senator',
    stretch: 'LOW',
    sizeChart: SENATOR_CHART,
    chest: 100,
    waist: 90,
    chestConfidence: 88,
    waistConfidence: 80,
    fitPreference: 'regular',
    ...overrides,
  };
}

describe('FitService', () => {
  let service: FitService;
  const idx = (s: string) => SENATOR_CHART.sizes.indexOf(s);

  beforeEach(() => {
    service = new FitService();
  });

  it('returns a valid size from the chart', () => {
    const r = service.computeFit(base());
    expect(SENATOR_CHART.sizes).toContain(r.recommendedSize);
    expect(r.fitConfidence).toBeGreaterThanOrEqual(40);
    expect(r.fitConfidence).toBeLessThanOrEqual(97);
  });

  it('recommends a larger size for oversized than for regular', () => {
    const reg = service.computeFit(base({ fitPreference: 'regular' }));
    const over = service.computeFit(base({ fitPreference: 'oversized' }));
    expect(idx(over.recommendedSize)).toBeGreaterThanOrEqual(idx(reg.recommendedSize));
  });

  it('recommends a smaller-or-equal size for tight than for relaxed', () => {
    const tight = service.computeFit(base({ fitPreference: 'tight' }));
    const relaxed = service.computeFit(base({ fitPreference: 'relaxed' }));
    expect(idx(tight.recommendedSize)).toBeLessThanOrEqual(idx(relaxed.recommendedSize));
  });

  it('warns when the body is larger than the biggest garment', () => {
    const r = service.computeFit(base({ chest: 120, waist: 118, fitPreference: 'tight' }));
    expect(r.warnings.some((w) => w.toLowerCase().includes('chest'))).toBe(true);
    expect(r.warnings.some((w) => w.toLowerCase().includes('waist'))).toBe(true);
  });

  it('higher fabric stretch never reduces available room (size <= no-stretch case for same body)', () => {
    const none = service.computeFit(base({ chest: 106, stretch: 'NONE' }));
    const high = service.computeFit(base({ chest: 106, stretch: 'HIGH' }));
    expect(idx(high.recommendedSize)).toBeLessThanOrEqual(idx(none.recommendedSize));
  });

  it('uses Kaftan ease (more generous) — same body fits a smaller nominal size than Senator', () => {
    const senator = service.computeFit(base({ category: 'Senator' }));
    const kaftan = service.computeFit(base({ category: 'Kaftan' }));
    // Kaftan adds more ease, so the target chest is larger -> size index >= senator
    expect(idx(kaftan.recommendedSize)).toBeGreaterThanOrEqual(idx(senator.recommendedSize));
  });

  it('provides an alternative size unless already at the top of the chart', () => {
    const small = service.computeFit(base({ chest: 90 }));
    expect(small.alternativeSize).not.toBeNull();
    const huge = service.computeFit(base({ chest: 130, fitPreference: 'oversized' }));
    expect(huge.alternativeSize).toBeNull();
  });

  it('is deterministic for identical input', () => {
    const a = service.computeFit(base());
    const b = service.computeFit(base());
    expect(a).toEqual(b);
  });

  it('rejects a malformed size chart', () => {
    expect(() =>
      service.computeFit(base({ sizeChart: { sizes: ['M'], chest: [], waist: [] } })),
    ).toThrow(BadRequestException);
  });

  it('rejects non-positive body measurements', () => {
    expect(() => service.computeFit(base({ chest: 0 }))).toThrow(BadRequestException);
  });
});
