// @ts-ignore bun test runner types
import { describe, it, expect } from 'bun:test';
import { needsPromoValidation } from './bookingPromo';

describe('booking promo validation before payment', () => {
  it('validates a typed code even when Apply was not pressed', () => {
    expect(needsPromoValidation('ZAHRAN')).toBe(true);
  });
  it('does not require a code for a booking without a promo', () => {
    expect(needsPromoValidation('   ')).toBe(false);
  });
  it('keeps an already applied code without another validation', () => {
    expect(needsPromoValidation(' zahran ', 'ZAHRAN')).toBe(false);
  });
  it('requires validation again when the code changes', () => {
    expect(needsPromoValidation('OTHER', 'ZAHRAN')).toBe(true);
  });
});