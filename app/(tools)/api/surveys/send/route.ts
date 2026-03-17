/**
 * RCRS Survey Send API
 *
 * POST /api/surveys/send - Send a survey to a customer
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { customerSurveyService } from '@/lib/customer-survey-service';

/**
 * POST /api/surveys/send
 *
 * Body: { surveyId, customerId, customerName, customerEmail, method?, repSlug?, repName?, jobId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { surveyId, customerId, customerName, customerEmail } = body;

    if (!surveyId) {
      return NextResponse.json(
        { error: 'surveyId is required' },
        { status: 400 }
      );
    }
    if (!customerId || !customerName) {
      return NextResponse.json(
        { error: 'customerId and customerName are required' },
        { status: 400 }
      );
    }
    if (!customerEmail) {
      return NextResponse.json(
        { error: 'customerEmail is required' },
        { status: 400 }
      );
    }

    const result = customerSurveyService.sendSurvey(
      surveyId,
      customerId,
      customerName,
      customerEmail,
      body.method || 'email',
      body.repSlug,
      body.repName,
      body.jobId
    );

    return NextResponse.json({
      success: true,
      message: `Survey sent to ${customerEmail} via ${body.method || 'email'}`,
      token: result.token,
      surveyUrl: result.surveyUrl,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Survey Send API] POST error:', error);
    const message = error?.message || 'Failed to send survey';
    const statusCode = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
