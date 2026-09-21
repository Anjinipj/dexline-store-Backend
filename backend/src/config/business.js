// Business-level settings that more than one module needs to agree on.
//
// Timezone: the store operates in the UAE. Admin filters ("orders placed on
// 21 Sep") and every admin timestamp are interpreted in this zone rather than
// the server's or the viewer's local zone, so two admins in different places
// see (and filter by) the same calendar day. Override with BUSINESS_TIMEZONE
// if the business ever moves; the frontend reads NEXT_PUBLIC_BUSINESS_TIMEZONE.
module.exports = {
  get timezone() {
    return process.env.BUSINESS_TIMEZONE || 'Asia/Dubai';
  },
};
