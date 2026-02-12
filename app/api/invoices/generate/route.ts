/**
 * API Route: Generate Invoice from Breakdown
 * POST /api/invoices/generate
 *
 * Creates an invoice from an existing customer breakdown sheet.
 * Requires billing.edit permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { breakdownService } from '@/lib/breakdown-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      breakdownId,
      dueInDays,
      terms,
      notes,
      createdBy,
      createdByName
    } = body;

    if (!breakdownId) {
      return NextResponse.json(
        { error: 'breakdownId is required' },
        { status: 400 }
      );
    }

    if (!createdBy || !createdByName) {
      return NextResponse.json(
        { error: 'createdBy and createdByName are required' },
        { status: 400 }
      );
    }

    const invoice = await breakdownService.generateInvoice(breakdownId, {
      dueInDays: dueInDays || 30,
      terms,
      notes: notes || [],
      createdBy,
      createdByName
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Breakdown not found or invoice generation failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice,
      message: `Invoice ${invoice.invoiceNumber} generated successfully`
    });
  } catch (error: any) {
    console.error('Error generating invoice:', error);

    if (error.message === 'Invoice already exists for this breakdown') {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
