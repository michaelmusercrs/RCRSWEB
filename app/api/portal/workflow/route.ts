import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { portalAuthService, WorkflowType } from '@/lib/portal-auth';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
    const type = searchParams.get('type') as WorkflowType | null;

    // Get pending approvals for a user (items they can approve)
    if (userId && status === 'pending') {
      const user = await portalAuthService.getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const pendingApprovals = await portalAuthService.getPendingApprovals(user.role);
      return NextResponse.json(pendingApprovals);
    }

    // Get workflows by type
    if (type) {
      const workflows = await portalAuthService.getWorkflowsByType(type);
      return NextResponse.json(workflows);
    }

    // Return empty array if no specific query
    return NextResponse.json([]);
  } catch (error) {
    console.error('Workflow API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        // Create a new workflow
        const workflow = await portalAuthService.createWorkflow({
          type: data.type as WorkflowType,
          referenceId: data.referenceId,
          title: data.title,
          description: data.description,
          requestedBy: data.requestedBy,
          data: data.workflowData || {},
        });

        // Send GroupMe notification for profile edit pending approval
        if (workflow && data.type === 'profile_update') {
          try {
            const groupMeConfig = getGroupMeConfigFromEnv();
            if (groupMeConfig.enabled && groupMeConfig.botId && groupMeConfig.notifyOn.profileEditPending) {
              const notification = groupMeService.createProfileEditNotification({
                teamMemberName: data.workflowData?.teamMemberName || 'Unknown',
                editType: data.workflowData?.editType || 'profile',
                editedBy: data.requestedBy,
              });
              await groupMeService.sendNotification(groupMeConfig, notification);
            }
          } catch (notifyError) {
            console.error('Failed to send profile edit notification:', notifyError);
          }
        }

        return NextResponse.json({ success: true, workflow });
      }

      case 'approve': {
        // Approve a workflow step
        const result = await portalAuthService.completeWorkflowStep(
          data.workflowId,
          data.userId,
          'approved',
          data.notes
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          workflow: result.workflow,
          message: 'Workflow approved successfully'
        });
      }

      case 'reject': {
        // Reject a workflow step
        const result = await portalAuthService.completeWorkflowStep(
          data.workflowId,
          data.userId,
          'rejected',
          data.notes
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          workflow: result.workflow,
          message: 'Workflow rejected'
        });
      }

      case 'cancel': {
        // Cancel a workflow
        const result = await portalAuthService.cancelWorkflow(data.workflowId, data.userId, data.reason);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, message: 'Workflow cancelled' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Workflow API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
