const PDFDocument = require('pdfkit');

// pdfkit's standard 14 PDF fonts (Helvetica etc.) only cover WinAnsi/Latin-1 —
// the ₹ glyph isn't in that set and silently renders as a broken character.
// "Rs." avoids embedding a custom Unicode font just for one symbol.
function money(value) {
  return `Rs. ${Number(value).toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Renders the invoice PDF directly to the response stream — never written to
// disk. The order's line items/totals are already an immutable snapshot, so
// regenerating on every download is always byte-for-byte deterministic.
function streamInvoicePdf(res, { order, invoice }) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(20).fillColor('#0b3d91').text('Dexline Store', { continued: false });
  doc.fontSize(9).fillColor('#666').text('Dexline Technologies — dexline.store');
  doc.moveDown(1.5);

  doc.fontSize(14).fillColor('#111').text(`Invoice ${invoice.invoiceNumber}`);
  doc.fontSize(9).fillColor('#666');
  doc.text(`Issued: ${formatDate(invoice.issuedAt)}`);
  doc.text(`Order: ${order.orderNumber} (placed ${formatDate(order.createdAt)})`);
  doc.moveDown(1);

  doc.fontSize(10).fillColor('#111').text('Bill To', { underline: true });
  doc.fontSize(9).fillColor('#333');
  doc.text(order.customerName);
  doc.text(order.customerPhone);
  const addressLine = [order.shipLine1, order.shipLine2, order.shipCity, order.shipState, order.shipPincode]
    .filter(Boolean)
    .join(', ');
  if (addressLine) doc.text(addressLine);
  doc.moveDown(1.5);

  // Item table — pdfkit has no built-in table primitive, so columns are
  // hand-positioned.
  const tableTop = doc.y;
  const col = { name: 50, qty: 320, price: 380, total: 470 };

  doc.fontSize(9).fillColor('#fff');
  doc.rect(50, tableTop, 495, 20).fill('#0b3d91');
  doc.fillColor('#fff');
  doc.text('Item', col.name, tableTop + 6);
  doc.text('Qty', col.qty, tableTop + 6);
  doc.text('Unit Price', col.price, tableTop + 6);
  doc.text('Line Total', col.total, tableTop + 6);

  let y = tableTop + 26;
  doc.fillColor('#333').fontSize(9);
  order.items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.rect(50, y - 4, 495, 20).fill('#f5f7fb');
      doc.fillColor('#333');
    }
    doc.text(item.name, col.name, y, { width: 260 });
    doc.text(String(item.quantity), col.qty, y);
    doc.text(money(item.price), col.price, y);
    doc.text(money(Number(item.price) * item.quantity), col.total, y);
    y += 20;
  });

  doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor('#ddd').stroke();
  y += 14;

  // Dedicated totals block, wide enough for the longest label ("Discount
  // (COUPONCODE)") to stay on one line rather than wrapping into the row below.
  const totalsLabelX = 330;
  const totalsLabelWidth = 145;
  const totalsValueX = 480;
  const totalsValueWidth = 65;

  const totals = [
    ['Subtotal', money(order.subtotalAmount)],
    ...(Number(order.discountAmount) > 0
      ? [[`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `-${money(order.discountAmount)}`]]
      : []),
    ['Tax', money(order.taxAmount)],
    ['Shipping', money(order.shippingAmount)],
  ];
  totals.forEach(([label, value]) => {
    doc.fontSize(9).fillColor('#555').text(label, totalsLabelX, y, { width: totalsLabelWidth, align: 'left' });
    doc.text(value, totalsValueX, y, { width: totalsValueWidth, align: 'right' });
    y += 16;
  });

  doc.fontSize(11).fillColor('#111');
  doc.text('Total', totalsLabelX, y, { width: totalsLabelWidth, align: 'left' });
  doc.text(money(order.totalAmount), totalsValueX, y, { width: totalsValueWidth, align: 'right' });
  y += 30;

  doc.fontSize(9).fillColor('#555').text(`Payment status: ${order.status}`, 50, y);
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text(
    'This invoice was generated automatically. Payment is coordinated and confirmed manually via WhatsApp — no online payment gateway is used.',
    50,
    doc.y,
    { width: 495 }
  );

  doc.end();
}

module.exports = { streamInvoicePdf };
