function money(value) {
  return `AED ${Number(value).toFixed(2)}`;
}

// Breakdown lines mirror the saved Order fields exactly (never recomputed
// here) so this message always matches the invoice and the order detail
// page for the same order.
function buildWhatsappLink(order) {
  const number = process.env.WHATSAPP_NUMBER;
  const vatPct = Math.round(Number(order.vatRate) * 100);

  const lines = [
    `Hi Dexline Store, I'd like to confirm my order *${order.orderNumber}*.`,
    '',
    'Items:',
    ...order.items.map(
      (item) => `- ${item.name} x${item.quantity} = ${money(Number(item.price) * item.quantity)}`
    ),
    '',
    `Items subtotal: ${money(order.subtotalAmount)}`,
    ...(Number(order.discountAmount) > 0
      ? [`Discount${order.couponCode ? ` (${order.couponCode})` : ''}: -${money(order.discountAmount)}`]
      : []),
    `Handling charge: ${money(order.handlingAmount)}`,
    `Total before VAT: ${money(order.taxableAmount)}`,
    `VAT (${vatPct}%): ${money(order.taxAmount)}`,
    `Total: ${money(order.totalAmount)}`,
    '',
    `Name: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
  ];

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${number}?text=${text}`;
}

module.exports = buildWhatsappLink;
