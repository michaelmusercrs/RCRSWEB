/**
 * RCRS Subcontractors API
 *
 * GET  /api/subcontractors - List/search subcontractors
 * POST /api/subcontractors - Add a new subcontractor
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { subcontractorService } from '@/lib/subcontractor-service';
import type { SubcontractorSpecialty, SubcontractorStatus } from '@/lib/subcontractor-service';

/**
 * GET /api/subcontractors
 *
 * Query params:
 * - specialty: filter by specialty
 * - status: filter by status (active, inactive, probation, blacklisted)
 * - search: text search across name, email, phone, specialties
 * - minRating: minimum rating filter
 * - sortBy: name | rating | reliability | recent
 * - sortOrder: asc | desc
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const specialty = searchParams.get('specialty') as SubcontractorSpecialty | null;
    const status = searchParams.get('status') as SubcontractorStatus | null;
    const search = searchParams.get('search') || undefined;
    const minRating = searchParams.get('minRating');
    const sortBy = searchParams.get('sortBy') as 'name' | 'rating' | 'reliability' | 'recent' | null;
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;

    const subcontractors = await subcontractorService.getSubcontractors({
      specialty: specialty || undefined,
      status: status || undefined,
      search,
      minRating: minRating ? parseFloat(minRating) : undefined,
      sortBy: sortBy || undefined,
      sortOrder: sortOrder || undefined,
    });

    const stats = await subcontractorService.getSubcontractorStats();

    return NextResponse.json({
      success: true,
      subcontractors,
      total: subcontractors.length,
      stats,
    });
  } catch (error) {
    console.error('[Subcontractors API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subcontractors' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subcontractors
 *
 * Body: Subcontractor data (minus id, jobHistory, timestamps)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    if (!body.companyName || !body.contactName) {
      return NextResponse.json(
        { error: 'Company name and contact name are required' },
        { status: 400 }
      );
    }

    if (!body.phone && !body.email) {
      return NextResponse.json(
        { error: 'At least one contact method (phone or email) is required' },
        { status: 400 }
      );
    }

    const sub = await subcontractorService.addSubcontractor({
      companyName: body.companyName,
      contactName: body.contactName,
      phone: body.phone || '',
      email: body.email || '',
      address: body.address || '',
      specialty: body.specialty || [],
      licenseNumber: body.licenseNumber,
      insuranceExpiry: body.insuranceExpiry,
      rating: body.rating || 0,
      reliability: body.reliability || 0,
      quality: body.quality || 0,
      status: body.status || 'active',
      hourlyRate: body.hourlyRate,
      perSquareRate: body.perSquareRate,
      notes: body.notes || '',
      documents: body.documents || [],
    });

    return NextResponse.json({ success: true, subcontractor: sub }, { status: 201 });
  } catch (error) {
    console.error('[Subcontractors API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to add subcontractor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
