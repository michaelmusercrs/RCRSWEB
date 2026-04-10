/**
 * RCRS Surveys API
 *
 * GET  /api/surveys - List surveys or get public survey by token
 * POST /api/surveys - Create survey or submit response
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { customerSurveyService } from '@/lib/customer-survey-service';

/**
 * GET /api/surveys
 *
 * Query params:
 * - token: get survey for a public token (used by survey page)
 * - surveyId: get a specific survey
 * - (none): list all surveys with response counts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const surveyId = searchParams.get('surveyId');

    // Public survey by token
    if (token) {
      const result = await customerSurveyService.getSurveyByToken(token);
      if (!result) {
        return NextResponse.json(
          { error: 'Survey not found or already submitted' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        survey: result.survey,
        customerName: result.invitation.customerName,
      });
    }

    // Specific survey
    if (surveyId) {
      const survey = await customerSurveyService.getSurvey(surveyId);
      if (!survey) {
        return NextResponse.json(
          { error: 'Survey not found' },
          { status: 404 }
        );
      }
      const responses = await customerSurveyService.getResponses({ surveyId });
      return NextResponse.json({
        success: true,
        survey,
        responseCount: responses.length,
      });
    }

    // List all surveys with stats
    const surveys = await customerSurveyService.getSurveys();
    const surveysWithStats = await Promise.all(surveys.map(async (s) => {
      const responses = await customerSurveyService.getResponses({ surveyId: s.id });
      const avgRating = responses.length > 0
        ? Math.round((responses.reduce((sum, r) => sum + r.overallRating, 0) / responses.length) * 100) / 100
        : 0;
      return {
        ...s,
        responseCount: responses.length,
        avgRating,
      };
    }));

    return NextResponse.json({
      success: true,
      surveys: surveysWithStats,
      total: surveysWithStats.length,
    });
  } catch (error) {
    console.error('[Surveys API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surveys' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/surveys
 *
 * Two modes:
 * 1. Create survey: body has { name, type, questions }
 * 2. Submit response: body has { token, answers }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    // Submit response mode
    if (body.token && body.answers) {
      const { token, answers } = body;

      if (!Array.isArray(answers) || answers.length === 0) {
        return NextResponse.json(
          { error: 'Answers array is required' },
          { status: 400 }
        );
      }

      const response = await customerSurveyService.submitResponse(token, answers);
      return NextResponse.json({
        success: true,
        message: 'Thank you for your feedback!',
        response,
      }, { status: 201 });
    }

    // Create survey mode
    if (body.name && body.type && body.questions) {
      const validTypes = ['post_install', 'annual_checkup', 'service_call', 'general'];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `Invalid survey type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }

      if (!Array.isArray(body.questions) || body.questions.length === 0) {
        return NextResponse.json(
          { error: 'At least one question is required' },
          { status: 400 }
        );
      }

      const survey = await customerSurveyService.createSurvey({
        name: body.name,
        type: body.type,
        questions: body.questions,
      });

      return NextResponse.json({
        success: true,
        survey,
      }, { status: 201 });
    }

    // Get responses list
    if (body.action === 'getResponses') {
      const responses = await customerSurveyService.getResponses({
        surveyId: body.surveyId,
        repSlug: body.repSlug,
        startDate: body.startDate,
        endDate: body.endDate,
        sentiment: body.sentiment,
        followUpNeeded: body.followUpNeeded,
      });

      return NextResponse.json({
        success: true,
        responses,
        total: responses.length,
      });
    }

    // Mark follow-up
    if (body.action === 'markFollowUp') {
      if (!body.responseId || !body.note) {
        return NextResponse.json(
          { error: 'responseId and note are required' },
          { status: 400 }
        );
      }
      const response = await customerSurveyService.markFollowUp(
        body.responseId,
        body.note,
        body.completed
      );
      return NextResponse.json({ success: true, response });
    }

    return NextResponse.json(
      { error: 'Invalid request. Provide either {name,type,questions} to create a survey or {token,answers} to submit a response' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Surveys API] POST error:', error);
    const message = error?.message || 'Failed to process request';
    const statusCode = message.includes('not found') ? 404
      : message.includes('already submitted') ? 409
      : message.includes('Missing required') ? 400
      : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
