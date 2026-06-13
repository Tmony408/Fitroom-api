/**
 * Order state machine (Batch 2) — pure & deterministic, no I/O.
 *
 * Encodes the legal lifecycle of a custom order and which actor may perform
 * each transition. Kept framework-free so it can be unit-tested in isolation
 * and reused by the service layer + any future workflow engine.
 */

export type OrderStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'PAID'
  | 'CUTTING'
  | 'SEWING'
  | 'QUALITY_CHECK'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type Actor = 'CUSTOMER' | 'DESIGNER' | 'SYSTEM';

/** Ordered production stages a paid order moves through. */
export const PRODUCTION_STAGES: OrderStatus[] = [
  'PAID',
  'CUTTING',
  'SEWING',
  'QUALITY_CHECK',
  'SHIPPED',
  'DELIVERED',
];

interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  actors: Actor[];
}

const TRANSITIONS: Transition[] = [
  { from: 'REQUESTED', to: 'QUOTED', actors: ['DESIGNER'] },
  { from: 'QUOTED', to: 'PAID', actors: ['SYSTEM'] }, // triggered by payment (Batch 4); SYSTEM stub for now
  { from: 'PAID', to: 'CUTTING', actors: ['DESIGNER'] },
  { from: 'CUTTING', to: 'SEWING', actors: ['DESIGNER'] },
  { from: 'SEWING', to: 'QUALITY_CHECK', actors: ['DESIGNER'] },
  { from: 'QUALITY_CHECK', to: 'SHIPPED', actors: ['DESIGNER'] },
  { from: 'SHIPPED', to: 'DELIVERED', actors: ['DESIGNER', 'CUSTOMER'] },
  // Cancellation is allowed only before money/production.
  { from: 'REQUESTED', to: 'CANCELLED', actors: ['CUSTOMER', 'DESIGNER'] },
  { from: 'QUOTED', to: 'CANCELLED', actors: ['CUSTOMER', 'DESIGNER'] },
];

export class OrderStateMachine {
  /** Returns true if `actor` may move an order from `from` to `to`. */
  static can(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
    return TRANSITIONS.some(
      (t) => t.from === from && t.to === to && t.actors.includes(actor),
    );
  }

  /** The next production stage after `current`, or null if none/at end. */
  static nextProductionStage(current: OrderStatus): OrderStatus | null {
    const i = PRODUCTION_STAGES.indexOf(current);
    if (i === -1 || i >= PRODUCTION_STAGES.length - 1) return null;
    return PRODUCTION_STAGES[i + 1];
  }

  static isProductionStage(status: OrderStatus): boolean {
    return PRODUCTION_STAGES.includes(status);
  }

  static isTerminal(status: OrderStatus): boolean {
    return status === 'DELIVERED' || status === 'CANCELLED';
  }

  /** All statuses an actor can move to from `from` (for UI affordances). */
  static allowedNext(from: OrderStatus, actor: Actor): OrderStatus[] {
    return TRANSITIONS.filter((t) => t.from === from && t.actors.includes(actor)).map(
      (t) => t.to,
    );
  }
}
