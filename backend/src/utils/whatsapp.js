function buildWhatsappLink(order) {
  const number = process.env.WHATSAPP_NUMBER;

  const lines = [
    `Hi Dexline Store, I'd like to confirm my order *${order.orderNumber}*.`,
    '',
    'Items:',
    ...order.items.map(
      (item) => `- ${item.name} x${item.quantity} = AED ${(Number(item.price) * item.quantity).toFixed(2)}`
    ),
    '',
    `Total: AED ${Number(order.totalAmount).toFixed(2)}`,
    '',
    `Name: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
  ];

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${number}?text=${text}`;
}

module.exports = buildWhatsappLink;
