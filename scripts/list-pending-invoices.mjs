/**
 * List delivery tickets, identifying which need invoices generated.
 * Filters out obvious test data.
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/sheet-dump.json', 'utf8'));
const tickets = data.tabs['Delivery Tickets'].rows;
const invoices = data.tabs.Invoices.rows;
const inventory = [...data.tabs.Inventory.rows, ...data.tabs.Inventory_Products.rows];

console.log(`Total delivery tickets: ${tickets.length}`);
console.log(`Total invoices: ${invoices.length}`);
console.log();

// Map of ticketId -> invoiceId (which tickets have invoices already)
const invoiced = new Set(invoices.map(i => i.ticketId).filter(Boolean));

// Sort by createdAt descending (newest first)
tickets.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

console.log('Tickets ordered newest first:\n');
const real = [];
for (const t of tickets) {
  const isTest = /test|debug/i.test(t.jobName || t.customerName || t.createdBy || '');
  const hasInvoice = invoiced.has(t.ticketId);
  const tag = isTest ? '[TEST]' : hasInvoice ? '[HAS-INVOICE]' : '[NEEDS-INVOICE]';
  console.log(`${tag.padEnd(18)} ${t.ticketId.padEnd(28)} ${(t.createdAt || '').slice(0, 10)}  status=${t.status.padEnd(20)}  ${t.customerName} — ${t.jobName}`);
  if (!isTest && !hasInvoice) real.push(t);
}

console.log();
console.log(`Real tickets needing invoice: ${real.length}`);
console.log();

// Output the real ones for the next step
fs.writeFileSync('scripts/pending-invoices.json', JSON.stringify(real, null, 2));
console.log('Wrote pending-invoices.json with', real.length, 'tickets');
