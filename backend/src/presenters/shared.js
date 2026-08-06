// Core presentation primitives shared by every entity presenter.
// No entity-specific knowledge lives here — see presenters/<entity>Presenter.js for that.

// The frontend only ever reads Mongo-style `_id`, never Prisma's plain `id`.
function mapId(record) {
  if (!record) return record;
  const { id, ...rest } = record;
  return { _id: id, ...rest };
}

// Prisma serializes Decimal fields to strings. Left unconverted, comparisons like
// `product.compareAtPrice > product.price` become wrong lexicographic string comparisons.
function toNumber(decimal) {
  if (decimal === null || decimal === undefined) return decimal;
  return Number(decimal);
}

// Reassembles the { line1, line2, city, state, pincode } shape the frontend expects
// from a set of flat `<prefix>Line1`/`<prefix>City`/... columns.
function buildAddress(record, prefix) {
  return {
    line1: record[`${prefix}Line1`] ?? '',
    line2: record[`${prefix}Line2`] ?? '',
    city: record[`${prefix}City`] ?? '',
    state: record[`${prefix}State`] ?? '',
    pincode: record[`${prefix}Pincode`] ?? '',
  };
}

module.exports = { mapId, toNumber, buildAddress };
