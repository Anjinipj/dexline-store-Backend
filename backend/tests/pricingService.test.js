const { calculateOrderTotals } = require('../src/services/pricingService');

describe('pricingService.calculateOrderTotals', () => {
  test('the documented AED 1,000 example', () => {
    const totals = calculateOrderTotals([{ price: 1000, quantity: 1 }]);
    expect(totals.itemsSubtotal).toBe(1000);
    expect(totals.handlingAmount).toBe(30);
    expect(totals.taxableAmount).toBe(1030);
    expect(totals.vatRate).toBe(0.05);
    expect(totals.vatAmount).toBe(51.5);
    expect(totals.totalAmount).toBe(1081.5);
  });

  test('multiple line items with quantities greater than 1', () => {
    // 3 x 199.99 + 2 x 49.5 = 599.97 + 99 = 698.97
    const totals = calculateOrderTotals([
      { price: 199.99, quantity: 3 },
      { price: 49.5, quantity: 2 },
    ]);
    expect(totals.itemsSubtotal).toBe(698.97);
    expect(totals.handlingAmount).toBe(30);
    expect(totals.taxableAmount).toBe(728.97);
    expect(totals.vatAmount).toBeCloseTo(36.45, 2); // 728.97 * 0.05
    expect(totals.totalAmount).toBeCloseTo(765.42, 2);
  });

  test('the handling charge is flat — one item or ten items charges the same AED 30', () => {
    const one = calculateOrderTotals([{ price: 50, quantity: 1 }]);
    const ten = calculateOrderTotals([{ price: 50, quantity: 10 }]);
    expect(one.handlingAmount).toBe(30);
    expect(ten.handlingAmount).toBe(30);
  });

  test('an empty cart produces all-zero totals — no handling charge is applied', () => {
    const totals = calculateOrderTotals([]);
    expect(totals).toEqual({
      itemsSubtotal: 0,
      discountAmount: 0,
      handlingAmount: 0,
      taxableAmount: 0,
      vatRate: 0.05,
      vatAmount: 0,
      totalAmount: 0,
    });
  });

  test('a discount is applied before handling and VAT', () => {
    // subtotal 1000, discount 100 -> taxable = 900 + 30 = 930, vat = 46.5, total = 976.5
    const totals = calculateOrderTotals([{ price: 1000, quantity: 1 }], { discountAmount: 100 });
    expect(totals.discountAmount).toBe(100);
    expect(totals.taxableAmount).toBe(930);
    expect(totals.vatAmount).toBe(46.5);
    expect(totals.totalAmount).toBe(976.5);
  });

  test('a discount can never exceed the items subtotal (clamped, never goes negative)', () => {
    const totals = calculateOrderTotals([{ price: 20, quantity: 1 }], { discountAmount: 500 });
    expect(totals.discountAmount).toBe(20);
    expect(totals.taxableAmount).toBe(30); // 20 - 20 + 30 handling
  });

  test('decimal unit prices round to the nearest fils, not a repeating binary fraction', () => {
    // 3 x 10.15 = 30.45 exactly, but 10.15 cannot be represented exactly in
    // binary floating point — this guards against drift like 30.449999999996.
    const totals = calculateOrderTotals([{ price: 10.15, quantity: 3 }]);
    expect(totals.itemsSubtotal).toBe(30.45);
    expect(Number.isInteger(totals.itemsSubtotal * 100)).toBe(true);
    expect(Number.isInteger(totals.vatAmount * 100)).toBe(true);
    expect(Number.isInteger(totals.totalAmount * 100)).toBe(true);
  });

  test('a Prisma Decimal-like price (string-valued) is handled the same as a number', () => {
    const totals = calculateOrderTotals([{ price: '1000.00', quantity: 1 }]);
    expect(totals.itemsSubtotal).toBe(1000);
    expect(totals.totalAmount).toBe(1081.5);
  });
});
