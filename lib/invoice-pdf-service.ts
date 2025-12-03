// PDF Invoice Generation Service
// Generates HTML-based invoices that can be converted to PDF via browser print

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;

  // Company Info
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo?: string;

  // Customer Info
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerZip: string;
  customerPhone: string;
  customerEmail?: string;

  // Job Info
  jobId: string;
  jobName: string;
  jobAddress: string;
  projectManager: string;
  deliveryDate?: string;

  // Line Items (NO COST PRICE - only charge amount)
  items: InvoiceLineItem[];

  // Totals
  subtotal: number;
  deliveryFee: number;
  handlingFee: number;
  rushFee?: number;
  tax: number;
  total: number;

  // Notes
  notes?: string;
  terms?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number; // This is the CHARGE price, NOT cost price
  total: number;
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const itemsHTML = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity} ${item.unit}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #1f2937;
      background: white;
      padding: 40px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #65a30d;
    }
    .company-info h1 {
      font-size: 28px;
      font-weight: 800;
      color: #65a30d;
      margin-bottom: 8px;
    }
    .company-info p {
      color: #6b7280;
      font-size: 13px;
      line-height: 1.6;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h2 {
      font-size: 36px;
      font-weight: 800;
      color: #1f2937;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .invoice-number {
      font-size: 16px;
      color: #65a30d;
      font-weight: 600;
      margin-top: 8px;
    }
    .meta-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .meta-box {
      flex: 1;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
      margin-right: 20px;
    }
    .meta-box:last-child {
      margin-right: 0;
    }
    .meta-box h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .meta-box p {
      line-height: 1.8;
      color: #374151;
    }
    .meta-box strong {
      display: block;
      font-size: 16px;
      color: #1f2937;
      margin-bottom: 4px;
    }
    .dates-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .date-item label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      display: block;
      margin-bottom: 4px;
    }
    .date-item span {
      font-weight: 600;
      color: #1f2937;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .items-table thead {
      background: #65a30d;
      color: white;
    }
    .items-table th {
      padding: 14px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
    .items-table th:last-child,
    .items-table th:nth-child(3) {
      text-align: right;
    }
    .items-table th:nth-child(2) {
      text-align: center;
    }
    .items-table tbody tr:hover {
      background: #f9fafb;
    }
    .totals-section {
      display: flex;
      justify-content: flex-end;
    }
    .totals-box {
      width: 300px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.total {
      border-bottom: none;
      border-top: 2px solid #65a30d;
      margin-top: 10px;
      padding-top: 16px;
      font-size: 18px;
      font-weight: 700;
    }
    .totals-row.total .amount {
      color: #65a30d;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .footer h4 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .footer p {
      color: #6b7280;
      line-height: 1.8;
      font-size: 13px;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: #fef3c7;
      color: #92400e;
      margin-top: 8px;
    }
    .print-button {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #65a30d;
      color: white;
      border: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(101, 163, 13, 0.4);
    }
    .print-button:hover {
      background: #84cc16;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>${data.companyName}</h1>
        <p>
          ${data.companyAddress}<br>
          ${data.companyPhone}<br>
          ${data.companyEmail}
        </p>
      </div>
      <div class="invoice-title">
        <h2>Invoice</h2>
        <div class="invoice-number">${data.invoiceNumber}</div>
      </div>
    </div>

    <div class="meta-section">
      <div class="meta-box">
        <h3>Bill To</h3>
        <p>
          <strong>${data.customerName}</strong>
          ${data.customerAddress}<br>
          ${data.customerCity}, ${data.customerState} ${data.customerZip}<br>
          ${data.customerPhone}
          ${data.customerEmail ? `<br>${data.customerEmail}` : ''}
        </p>
      </div>
      <div class="meta-box">
        <h3>Job Details</h3>
        <p>
          <strong>${data.jobName}</strong>
          ${data.jobAddress}<br>
          Project Manager: ${data.projectManager}
          ${data.deliveryDate ? `<br>Delivered: ${data.deliveryDate}` : ''}
        </p>
      </div>
      <div class="meta-box" style="background: #f0fdf4;">
        <h3>Invoice Info</h3>
        <div class="dates-grid">
          <div class="date-item">
            <label>Invoice Date</label>
            <span>${data.invoiceDate}</span>
          </div>
          <div class="date-item">
            <label>Due Date</label>
            <span>${data.dueDate}</span>
          </div>
        </div>
        <div class="status-badge">Due on Receipt</div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Quantity</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>$${data.subtotal.toFixed(2)}</span>
        </div>
        ${data.deliveryFee > 0 ? `
        <div class="totals-row">
          <span>Delivery Fee</span>
          <span>$${data.deliveryFee.toFixed(2)}</span>
        </div>
        ` : ''}
        ${data.handlingFee > 0 ? `
        <div class="totals-row">
          <span>Handling Fee</span>
          <span>$${data.handlingFee.toFixed(2)}</span>
        </div>
        ` : ''}
        ${data.rushFee && data.rushFee > 0 ? `
        <div class="totals-row">
          <span>Rush Fee</span>
          <span>$${data.rushFee.toFixed(2)}</span>
        </div>
        ` : ''}
        ${data.tax > 0 ? `
        <div class="totals-row">
          <span>Tax</span>
          <span>$${data.tax.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="totals-row total">
          <span>Total Due</span>
          <span class="amount">$${data.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-grid">
        ${data.notes ? `
        <div>
          <h4>Notes</h4>
          <p>${data.notes}</p>
        </div>
        ` : '<div></div>'}
        <div>
          <h4>Payment Terms</h4>
          <p>${data.terms || 'Payment is due upon receipt. Please make checks payable to River City Roofing Solutions. Thank you for your business!'}</p>
        </div>
      </div>
    </div>
  </div>

  <button class="print-button no-print" onclick="window.print()">
    Print / Save PDF
  </button>
</body>
</html>
`;
}

// Generate a Material Ticket for Job Folder (internal use)
export function generateMaterialTicketHTML(data: {
  ticketId: string;
  ticketDate: string;
  jobId: string;
  jobName: string;
  jobAddress: string;
  customerName: string;
  projectManager: string;
  driver: string;
  items: InvoiceLineItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveredAt?: string;
  signature?: string;
  notes?: string;
}): string {
  const itemsHTML = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.unit}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Material Ticket ${data.ticketId}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #1f2937;
      background: white;
      padding: 30px;
    }
    .ticket-container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #65a30d;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background: #65a30d;
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
    }
    .ticket-id {
      font-size: 18px;
      font-weight: 600;
      background: white;
      color: #65a30d;
      padding: 8px 16px;
      border-radius: 4px;
    }
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 20px;
      background: #f9fafb;
    }
    .info-box h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .info-box p {
      line-height: 1.6;
      color: #374151;
    }
    .info-box strong {
      color: #1f2937;
    }
    .items-section {
      padding: 20px;
    }
    .items-section h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #65a30d;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #65a30d;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f3f4f6;
      padding: 12px 10px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
    }
    th:nth-child(2), th:nth-child(3) { text-align: center; }
    th:nth-child(4), th:nth-child(5) { text-align: right; }
    .totals {
      padding: 20px;
      background: #f9fafb;
      display: flex;
      justify-content: flex-end;
    }
    .totals-box {
      width: 250px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .totals-row.total {
      font-size: 18px;
      font-weight: 700;
      border-top: 2px solid #65a30d;
      padding-top: 12px;
      margin-top: 8px;
      color: #65a30d;
    }
    .signature-section {
      padding: 20px;
      border-top: 1px solid #e5e7eb;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .signature-box {
      border-top: 2px solid #374151;
      padding-top: 8px;
      margin-top: 40px;
    }
    .signature-box label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
    }
    .footer {
      background: #1f2937;
      color: white;
      padding: 16px 20px;
      text-align: center;
      font-size: 12px;
    }
    .copy-label {
      position: absolute;
      top: 10px;
      right: 10px;
      background: #fef3c7;
      color: #92400e;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .print-button {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #65a30d;
      color: white;
      border: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(101, 163, 13, 0.4);
    }
  </style>
</head>
<body>
  <div class="ticket-container" style="position: relative;">
    <div class="copy-label">JOB FOLDER COPY</div>

    <div class="header">
      <h1>Material Delivery Ticket</h1>
      <div class="ticket-id">${data.ticketId}</div>
    </div>

    <div class="info-section">
      <div class="info-box">
        <h3>Job Information</h3>
        <p>
          <strong>${data.jobName}</strong><br>
          ${data.jobAddress}<br>
          Customer: ${data.customerName}
        </p>
      </div>
      <div class="info-box">
        <h3>Delivery Information</h3>
        <p>
          Date: <strong>${data.ticketDate}</strong><br>
          PM: ${data.projectManager}<br>
          Driver: ${data.driver}
          ${data.deliveredAt ? `<br>Delivered: ${data.deliveredAt}` : ''}
        </p>
      </div>
    </div>

    <div class="items-section">
      <h2>Materials Delivered</h2>
      <table>
        <thead>
          <tr>
            <th>Item Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row">
          <span>Materials Subtotal</span>
          <span>$${data.subtotal.toFixed(2)}</span>
        </div>
        ${data.deliveryFee > 0 ? `
        <div class="totals-row">
          <span>Delivery</span>
          <span>$${data.deliveryFee.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="totals-row total">
          <span>Total</span>
          <span>$${data.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="signature-section">
      <div>
        <div class="signature-box">
          <label>Customer/Site Signature</label>
        </div>
      </div>
      <div>
        <div class="signature-box">
          <label>Date & Time Received</label>
        </div>
      </div>
    </div>

    ${data.notes ? `
    <div style="padding: 16px 20px; background: #fef3c7; border-top: 1px solid #e5e7eb;">
      <strong style="color: #92400e;">Notes:</strong> ${data.notes}
    </div>
    ` : ''}

    <div class="footer">
      River City Roofing Solutions &bull; Material Delivery Record &bull; Keep for Job File
    </div>
  </div>

  <button class="print-button no-print" onclick="window.print()">
    Print / Save PDF
  </button>
</body>
</html>
`;
}

// Generate Job Cost Summary (internal - shows both cost and charge)
export function generateJobCostSummaryHTML(data: {
  jobId: string;
  jobName: string;
  jobAddress: string;
  customerName: string;
  projectManager: string;
  tickets: Array<{
    ticketId: string;
    date: string;
    type: string;
    items: Array<{
      description: string;
      quantity: number;
      unit: string;
      ourCost: number;
      chargePrice: number;
    }>;
  }>;
  totalOurCost: number;
  totalCharged: number;
  profit: number;
  profitMargin: number;
}): string {
  let ticketsHTML = '';

  data.tickets.forEach(ticket => {
    const itemsHTML = ticket.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity} ${item.unit}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626;">$${item.ourCost.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #16a34a;">$${item.chargePrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${(item.chargePrice - item.ourCost).toFixed(2)}</td>
      </tr>
    `).join('');

    ticketsHTML += `
      <div style="margin-bottom: 30px;">
        <div style="background: #f3f4f6; padding: 12px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #1f2937;">${ticket.ticketId}</strong>
            <span style="color: #6b7280; margin-left: 12px;">${ticket.date}</span>
          </div>
          <span style="background: ${ticket.type === 'delivery' ? '#dbeafe' : ticket.type === 'return' ? '#fef3c7' : '#f3e8ff'}; color: ${ticket.type === 'delivery' ? '#1e40af' : ticket.type === 'return' ? '#92400e' : '#6b21a8'}; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${ticket.type}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-top: none;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Item</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 11px; text-transform: uppercase; color: #6b7280;">Qty</th>
              <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #dc2626;">Our Cost</th>
              <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #16a34a;">Charge</th>
              <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280;">Profit</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
      </div>
    `;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Job Cost Summary - ${data.jobName}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #1f2937;
      background: white;
      padding: 30px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { color: #9ca3af; }
    .confidential {
      background: #fef2f2;
      border: 2px solid #dc2626;
      color: #dc2626;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: inline-block;
      margin-top: 16px;
    }
    .job-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
    }
    .info-card h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 12px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    .summary-card {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card.cost { background: #fef2f2; }
    .summary-card.charged { background: #f0fdf4; }
    .summary-card.profit { background: #eff6ff; }
    .summary-card.margin { background: #faf5ff; }
    .summary-card h4 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .summary-card .value {
      font-size: 28px;
      font-weight: 700;
    }
    .summary-card.cost .value { color: #dc2626; }
    .summary-card.charged .value { color: #16a34a; }
    .summary-card.profit .value { color: #2563eb; }
    .summary-card.margin .value { color: #7c3aed; }
    .print-button {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #1f2937;
      color: white;
      border: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Job Cost Summary</h1>
      <p>Internal Financial Report - Do Not Share with Customer</p>
      <div class="confidential">Confidential - Internal Use Only</div>
    </div>

    <div class="job-info">
      <div class="info-card">
        <h3>Job Details</h3>
        <p><strong style="font-size: 18px;">${data.jobName}</strong></p>
        <p style="color: #6b7280; margin-top: 8px;">${data.jobAddress}</p>
        <p style="margin-top: 8px;">Customer: ${data.customerName}</p>
      </div>
      <div class="info-card">
        <h3>Project Information</h3>
        <p>Job ID: <strong>${data.jobId}</strong></p>
        <p style="margin-top: 8px;">Project Manager: ${data.projectManager}</p>
        <p style="margin-top: 8px;">Total Deliveries: ${data.tickets.length}</p>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card cost">
        <h4>Our Cost</h4>
        <div class="value">$${data.totalOurCost.toFixed(2)}</div>
      </div>
      <div class="summary-card charged">
        <h4>Amount Charged</h4>
        <div class="value">$${data.totalCharged.toFixed(2)}</div>
      </div>
      <div class="summary-card profit">
        <h4>Gross Profit</h4>
        <div class="value">$${data.profit.toFixed(2)}</div>
      </div>
      <div class="summary-card margin">
        <h4>Profit Margin</h4>
        <div class="value">${data.profitMargin.toFixed(1)}%</div>
      </div>
    </div>

    <h2 style="font-size: 18px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">Material Transactions</h2>

    ${ticketsHTML}

  </div>

  <button class="print-button no-print" onclick="window.print()">
    Print / Save PDF
  </button>
</body>
</html>
`;
}
