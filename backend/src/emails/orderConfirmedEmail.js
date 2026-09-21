const verificationConfig = require('../config/verification');
const { escapeHtml } = require('../utils/html');

function money(value) {
  return `AED ${Number(value).toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatSupportPhone() {
  const raw = process.env.WHATSAPP_NUMBER || '';
  if (!raw.startsWith('971')) return raw ? `+${raw}` : '';
  return `+971 ${raw.slice(3).replace(/(\d{2})(\d{4})(\d+)/, '$1 $2 $3')}`;
}

// Built entirely from the saved Order (+ its items/customer, loaded fresh by
// the caller) — never recomputed from current catalogue prices — so this
// always matches the invoice and order-detail page for the same order. Only
// ever called for an order whose status is genuinely "Confirmed" (see
// notificationService.js), so it never has to guess whether that's true.
function buildOrderConfirmedEmail({ order }) {
  const appUrl = verificationConfig.appUrl;
  const logoUrl = `${appUrl}/logo.png`;
  const supportEmail = verificationConfig.email.supportEmail;
  const supportPhone = formatSupportPhone();
  const orderUrl = `${appUrl}/account/orders/${order.id}`;
  const customerName = order.customer?.name || order.customerName || 'there';
  const safeName = escapeHtml(customerName);
  const subject = `Your Dexline order #${order.orderNumber} is confirmed`;

  const addressLine = [order.shipLine1, order.shipLine2, order.shipCity, order.shipState, order.shipPincode]
    .filter(Boolean)
    .join(', ');

  const itemsRowsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${escapeHtml(item.name)}</td>
          <td style="padding:8px 0;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;text-align:right;">${money(item.price)}</td>
          <td style="padding:8px 0;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;text-align:right;">${money(Number(item.price) * item.quantity)}</td>
        </tr>`
    )
    .join('');

  const itemsRowsText = order.items
    .map((item) => `  - ${item.name} x${item.quantity} @ ${money(item.price)} = ${money(Number(item.price) * item.quantity)}`)
    .join('\n');

  const vatPct = Math.round(Number(order.vatRate) * 100);
  const totalsRows = [
    ['Items subtotal', money(order.subtotalAmount)],
    ...(Number(order.discountAmount) > 0
      ? [[`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `-${money(order.discountAmount)}`]]
      : []),
    ['Handling charge', money(order.handlingAmount)],
    ['Total before VAT', money(order.taxableAmount)],
    [`VAT (${vatPct}%)`, money(order.taxAmount)],
  ];

  const totalsRowsHtml = totalsRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:3px 0;font-size:12px;color:#64748b;">${escapeHtml(label)}</td>
          <td style="padding:3px 0;font-size:12px;color:#64748b;text-align:right;">${value}</td>
        </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <div style="background:#f1f5f9;padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:#1b4fcc;padding:24px;text-align:center;">
          <img src="${logoUrl}" alt="Dexline Technologies" height="32" style="height:32px;" />
        </div>
        <div style="padding:32px 28px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Your order is confirmed</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
            Hi ${safeName}, your order has been successfully confirmed. Thank you for shopping with Dexline Store.
          </p>

          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td style="font-size:12px;color:#94a3b8;padding:2px 0;">Order number</td>
              <td style="font-size:12px;color:#0f172a;font-weight:600;text-align:right;">${escapeHtml(order.orderNumber)}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#94a3b8;padding:2px 0;">Order date</td>
              <td style="font-size:12px;color:#0f172a;font-weight:600;text-align:right;">${formatDate(order.createdAt)}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#94a3b8;padding:2px 0;">Status</td>
              <td style="font-size:12px;color:#1b4fcc;font-weight:700;text-align:right;">Confirmed</td>
            </tr>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <thead>
              <tr>
                <th style="text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">Item</th>
                <th style="text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">Qty</th>
                <th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">Unit Price</th>
                <th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">Line Total</th>
              </tr>
            </thead>
            <tbody>${itemsRowsHtml}</tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
            ${totalsRowsHtml}
            <tr>
              <td style="padding:10px 0 0;font-size:15px;color:#0f172a;font-weight:700;border-top:1px solid #e2e8f0;">Final total</td>
              <td style="padding:10px 0 0;font-size:15px;color:#1b4fcc;font-weight:700;text-align:right;border-top:1px solid #e2e8f0;">${money(order.totalAmount)}</td>
            </tr>
          </table>

          <div style="margin:24px 0;padding:16px;background:#f8fafc;border-radius:8px;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;">Delivery details</p>
            <p style="margin:0;font-size:13px;color:#334155;">
              ${addressLine ? escapeHtml(addressLine) : 'No physical delivery address on file — this order will be coordinated directly with you.'}
            </p>
          </div>

          <div style="text-align:center;margin:28px 0;">
            <a href="${orderUrl}" style="background:#1b4fcc;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;display:inline-block;">
              View Your Order
            </a>
          </div>

          <p style="margin:0;font-size:11px;color:#94a3b8;">
            This confirms your order was accepted. It does not confirm that payment has been received or that the
            order has shipped — you'll get a separate update as those happen.
          </p>
        </div>
        <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            Need help? Contact us at
            <a href="mailto:${supportEmail}" style="color:#1b4fcc;">${supportEmail}</a>${supportPhone ? ` or ${supportPhone}` : ''}
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    'Your order is confirmed',
    '',
    `Hi ${customerName}, your order has been successfully confirmed. Thank you for shopping with Dexline Store.`,
    '',
    `Order number: ${order.orderNumber}`,
    `Order date: ${formatDate(order.createdAt)}`,
    'Status: Confirmed',
    '',
    'Items:',
    itemsRowsText,
    '',
    ...totalsRows.map(([label, value]) => `${label}: ${value}`),
    `Final total: ${money(order.totalAmount)}`,
    '',
    'Delivery details:',
    addressLine || 'No physical delivery address on file — this order will be coordinated directly with you.',
    '',
    'This confirms your order was accepted. It does not confirm that payment has been received or that the order',
    'has shipped — you will get a separate update as those happen.',
    '',
    `View your order: ${orderUrl}`,
    '',
    `Need help? Contact us at ${supportEmail}${supportPhone ? ` or ${supportPhone}` : ''}`,
  ].join('\n');

  return { subject, html, text };
}

module.exports = { buildOrderConfirmedEmail };
