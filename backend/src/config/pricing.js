// Central, documented defaults for order pricing. Both are overridable via
// env vars — see backend/.env.example. Getters (not values computed once at
// require-time) so a changed env var is never masked by an earlier cached
// read, matching config/verification.js.
function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const pricingConfig = {
  // Flat per-order handling fee (AED), charged once regardless of item count.
  get handlingChargeAed() {
    return numberFromEnv('HANDLING_CHARGE_AED', 30);
  },

  // VAT rate as a fraction (0.05 = 5%).
  get vatRate() {
    return numberFromEnv('VAT_RATE', 0.05);
  },

  // Documents an assumption, not a fact recovered from existing data:
  // Product.price carries no VAT-inclusive/exclusive marker anywhere in the
  // schema or seed data. Checkout treats stored prices as VAT-exclusive and
  // adds VAT on top. If prices are ever re-entered as VAT-inclusive, this
  // flag and pricingService.calculateOrderTotals must change together.
  pricesAreVatExclusive: true,
};

module.exports = pricingConfig;
