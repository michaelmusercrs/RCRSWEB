import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  groupMeService,
  getGroupMeConfigFromEnv,
  NotificationType,
  GroupMeNotification,
  GroupMeConfig,
} from '@/lib/groupme-service';

// POST - Send a GroupMe notification
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      type,
      title,
      message,
      details,
      priority,
      mentionAll,
      // Direct notification data for specific types
      leadData,
      profileEditData,
      inventoryData,
      jobStatusData,
      portalActivityData,
      deliveryData,
      slaAlertData,
      // Override config
      botId: overrideBotId,
    } = body;

    // Get config from environment
    const config = getGroupMeConfigFromEnv();

    // Allow bot ID override for testing
    if (overrideBotId) {
      config.botId = overrideBotId;
    }

    // If config is not enabled and no override, return early
    if (!config.enabled && !overrideBotId) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: 'GroupMe notifications are disabled'
      });
    }

    let notification: GroupMeNotification;

    // Build notification based on type and data
    if (leadData) {
      notification = groupMeService.createNewLeadNotification(leadData);
    } else if (profileEditData) {
      notification = groupMeService.createProfileEditNotification(profileEditData);
    } else if (inventoryData) {
      notification = groupMeService.createLowInventoryNotification(inventoryData);
    } else if (jobStatusData) {
      notification = groupMeService.createJobStatusNotification(jobStatusData);
    } else if (portalActivityData) {
      notification = groupMeService.createPortalActivityNotification(portalActivityData);
    } else if (deliveryData) {
      notification = groupMeService.createDeliveryUpdateNotification(deliveryData);
    } else if (slaAlertData) {
      notification = groupMeService.createSLAAlertNotification(slaAlertData);
    } else if (type && title && message) {
      // Generic notification
      notification = {
        type: type as NotificationType,
        title,
        message,
        details,
        priority: priority || 'normal',
        mentionAll: mentionAll || false,
      };
    } else {
      return NextResponse.json(
        { error: 'Missing required notification data. Provide either specific data (leadData, inventoryData, etc.) or generic notification fields (type, title, message).' },
        { status: 400 }
      );
    }

    // Send the notification
    const result = await groupMeService.sendNotification(config, notification);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Notification sent successfully',
        notification: {
          type: notification.type,
          title: notification.title,
        }
      });
    } else if (result.skipped) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: result.error || 'Notification skipped'
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending GroupMe notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// GET - Test GroupMe connection and get config status
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const testBotId = searchParams.get('botId');

    // Get current config
    const config = getGroupMeConfigFromEnv();

    if (action === 'test') {
      // Test the connection
      const botIdToTest = testBotId || config.botId;
      if (!botIdToTest) {
        return NextResponse.json(
          { error: 'No bot ID provided for test' },
          { status: 400 }
        );
      }

      const result = await groupMeService.testConnection(botIdToTest);
      return NextResponse.json({
        success: result.success,
        message: result.success
          ? 'Test message sent successfully! Check your GroupMe group.'
          : `Test failed: ${result.error}`,
      });
    }

    // Return current config status (without sensitive data)
    return NextResponse.json({
      enabled: config.enabled,
      configured: !!config.botId,
      notifyOn: config.notifyOn,
    });
  } catch (error) {
    console.error('Error checking GroupMe config:', error);
    return NextResponse.json(
      { error: 'Failed to check GroupMe configuration' },
      { status: 500 }
    );
  }
}
