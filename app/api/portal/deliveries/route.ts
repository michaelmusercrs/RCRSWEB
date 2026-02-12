import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { deliveryPortalService } from '@/lib/delivery-portal-service';
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId') || undefined;
    const status = searchParams.get('status') as any || undefined;
    const date = searchParams.get('date') || undefined;

    const deliveries = await deliveryPortalService.getDeliveries(driverId, status, date);
    return apiSuccess({ deliveries });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return apiError(getErrorMessage(error), 500, 'DELIVERIES_FETCH_FAILED');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const delivery = await deliveryPortalService.createDelivery(data);
    return apiSuccess({ delivery });
  } catch (error) {
    console.error('Error creating delivery:', error);
    return apiError(getErrorMessage(error), 500, 'DELIVERY_CREATE_FAILED');
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { deliveryId, action, ...updates } = data;

    if (!deliveryId) {
      return apiError('Delivery ID is required', 400, 'MISSING_DELIVERY_ID');
    }

    switch (action) {
      case 'confirmLoad':
        await deliveryPortalService.confirmLoad(deliveryId, updates.driverName);
        break;
      case 'updateStatus':
        await deliveryPortalService.updateDeliveryStatus(deliveryId, updates.status, updates);
        break;
      default:
        return apiError('Invalid action', 400, 'INVALID_ACTION');
    }

    return apiSuccess({ deliveryId, action }, 200, 'Delivery updated');
  } catch (error) {
    console.error('Error updating delivery:', error);
    return apiError(getErrorMessage(error), 500, 'DELIVERY_UPDATE_FAILED');
  }
}
