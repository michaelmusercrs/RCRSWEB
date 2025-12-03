import { NextRequest, NextResponse } from 'next/server';
import { generateInvoiceHTML, generateMaterialTicketHTML, generateJobCostSummaryHTML } from '@/lib/invoice-pdf-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    let html = '';

    switch (type) {
      case 'invoice':
        html = generateInvoiceHTML({
          invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
          invoiceDate: data.invoiceDate || new Date().toLocaleDateString(),
          dueDate: data.dueDate || 'Due on Receipt',
          companyName: 'River City Roofing Solutions',
          companyAddress: '123 Main Street, Huntsville, AL 35801',
          companyPhone: '(256) 555-ROOF',
          companyEmail: 'billing@rivercityroofingsolutions.com',
          customerName: data.customerName,
          customerAddress: data.customerAddress || data.jobAddress,
          customerCity: data.customerCity || data.city,
          customerState: data.customerState || data.state || 'AL',
          customerZip: data.customerZip || data.zip,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          jobId: data.jobId,
          jobName: data.jobName,
          jobAddress: data.jobAddress,
          projectManager: data.projectManager,
          deliveryDate: data.deliveryDate,
          items: data.items.map((item: any) => ({
            description: item.productName || item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.chargeAmount || item.chargePrice || item.unitPrice,
            total: (item.chargeAmount || item.chargePrice || item.unitPrice) * item.quantity
          })),
          subtotal: data.subtotal || data.items.reduce((sum: number, item: any) =>
            sum + ((item.chargeAmount || item.chargePrice || item.unitPrice) * item.quantity), 0),
          deliveryFee: data.deliveryFee || 75,
          handlingFee: data.handlingFee || 25,
          rushFee: data.rushFee,
          tax: data.tax || 0,
          total: data.total || (data.subtotal || 0) + (data.deliveryFee || 75) + (data.handlingFee || 25) + (data.rushFee || 0) + (data.tax || 0),
          notes: data.notes,
          terms: data.terms
        });
        break;

      case 'material-ticket':
        html = generateMaterialTicketHTML({
          ticketId: data.ticketId,
          ticketDate: data.ticketDate || new Date().toLocaleDateString(),
          jobId: data.jobId,
          jobName: data.jobName,
          jobAddress: data.jobAddress,
          customerName: data.customerName,
          projectManager: data.projectManager,
          driver: data.driver || data.assignedDriverName || 'N/A',
          items: data.items.map((item: any) => ({
            description: item.productName || item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.chargeAmount || item.chargePrice || item.unitPrice,
            total: (item.chargeAmount || item.chargePrice || item.unitPrice) * item.quantity
          })),
          subtotal: data.subtotal || data.items.reduce((sum: number, item: any) =>
            sum + ((item.chargeAmount || item.chargePrice || item.unitPrice) * item.quantity), 0),
          deliveryFee: data.deliveryFee || 0,
          total: data.total || 0,
          deliveredAt: data.deliveredAt,
          signature: data.signature,
          notes: data.notes || data.specialInstructions
        });
        break;

      case 'job-cost-summary':
        html = generateJobCostSummaryHTML({
          jobId: data.jobId,
          jobName: data.jobName,
          jobAddress: data.jobAddress,
          customerName: data.customerName,
          projectManager: data.projectManager,
          tickets: data.tickets,
          totalOurCost: data.totalOurCost,
          totalCharged: data.totalCharged,
          profit: data.profit,
          profitMargin: data.profitMargin
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid PDF type' }, { status: 400 });
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
