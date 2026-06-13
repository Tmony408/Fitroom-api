import { OrderStateMachine as SM, PRODUCTION_STAGES } from './order-state-machine';

describe('OrderStateMachine', () => {
  it('lets a designer quote a requested order', () => {
    expect(SM.can('REQUESTED', 'QUOTED', 'DESIGNER')).toBe(true);
  });

  it('forbids a customer from quoting', () => {
    expect(SM.can('REQUESTED', 'QUOTED', 'CUSTOMER')).toBe(false);
  });

  it('only SYSTEM (payment) moves QUOTED -> PAID', () => {
    expect(SM.can('QUOTED', 'PAID', 'SYSTEM')).toBe(true);
    expect(SM.can('QUOTED', 'PAID', 'DESIGNER')).toBe(false);
    expect(SM.can('QUOTED', 'PAID', 'CUSTOMER')).toBe(false);
  });

  it('walks production stages in order for the designer', () => {
    for (let i = 0; i < PRODUCTION_STAGES.length - 1; i++) {
      expect(SM.can(PRODUCTION_STAGES[i], PRODUCTION_STAGES[i + 1], 'DESIGNER')).toBe(true);
    }
  });

  it('forbids skipping a production stage', () => {
    expect(SM.can('PAID', 'SEWING', 'DESIGNER')).toBe(false); // must cut first
  });

  it('computes the next production stage', () => {
    expect(SM.nextProductionStage('PAID')).toBe('CUTTING');
    expect(SM.nextProductionStage('QUALITY_CHECK')).toBe('SHIPPED');
    expect(SM.nextProductionStage('DELIVERED')).toBeNull();
    expect(SM.nextProductionStage('REQUESTED')).toBeNull();
  });

  it('allows cancellation only before payment', () => {
    expect(SM.can('REQUESTED', 'CANCELLED', 'CUSTOMER')).toBe(true);
    expect(SM.can('QUOTED', 'CANCELLED', 'DESIGNER')).toBe(true);
    expect(SM.can('PAID', 'CANCELLED', 'CUSTOMER')).toBe(false);
    expect(SM.can('CUTTING', 'CANCELLED', 'DESIGNER')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(SM.isTerminal('DELIVERED')).toBe(true);
    expect(SM.isTerminal('CANCELLED')).toBe(true);
    expect(SM.isTerminal('PAID')).toBe(false);
  });

  it('lets either party confirm delivery from SHIPPED', () => {
    expect(SM.can('SHIPPED', 'DELIVERED', 'CUSTOMER')).toBe(true);
    expect(SM.can('SHIPPED', 'DELIVERED', 'DESIGNER')).toBe(true);
  });

  it('exposes allowed next states for UI', () => {
    expect(SM.allowedNext('REQUESTED', 'DESIGNER').sort()).toEqual(['CANCELLED', 'QUOTED']);
    expect(SM.allowedNext('DELIVERED', 'DESIGNER')).toEqual([]);
  });

  it('rejects unknown transitions', () => {
    expect(SM.can('DELIVERED', 'REQUESTED', 'SYSTEM')).toBe(false);
  });
});
