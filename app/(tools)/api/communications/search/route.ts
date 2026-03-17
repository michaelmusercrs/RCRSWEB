/**
 * RCRS Communications Hub - Customer Search API
 *
 * GET /api/communications/search?q=query - Search customers by name, phone, email, address
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { communicationHubService } from '@/lib/communication-hub-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    if (!query.trim()) {
      // Return all customers sorted by last contact when no query
      const allCustomers = communicationHubService.getAllCustomers();
      return NextResponse.json({
        success: true,
        data: {
          customers: allCustomers.slice(0, limit),
          total: allCustomers.length,
          query: '',
        },
      });
    }

    // Sanitize query - remove any characters that could cause issues
    const sanitizedQuery = query.replace(/[<>{}]/g, '').trim();

    if (sanitizedQuery.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const customers = await communicationHubService.searchCustomers(sanitizedQuery);

    // Enrich each customer with unread count
    const enriched = customers.slice(0, limit).map(customer => ({
      ...customer,
      unreadCount: communicationHubService.getUnreadCount(customer.id),
    }));

    return NextResponse.json({
      success: true,
      data: {
        customers: enriched,
        total: customers.length,
        query: sanitizedQuery,
      },
    });
  } catch (error) {
    console.error('[Communications Search API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search customers' },
      { status: 500 }
    );
  }
}
