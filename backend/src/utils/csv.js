// Minimal RFC4180-ish CSV serializer — no new dependency for two small admin exports.
function escapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// rows: array of plain objects; columns: [{ key, header }]
function toCsv(rows, columns) {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','));
  return [headerLine, ...lines].join('\r\n');
}

module.exports = { toCsv };
