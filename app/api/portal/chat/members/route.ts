import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { groupMeService } from '@/lib/groupme-service';

// GET - List group members with status info
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 }
      );
    }

    const result = await groupMeService.getGroup(groupId);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch group members' },
        { status: 500 }
      );
    }

    const members = (result.data.members || []).map((member) => ({
      userId: member.user_id,
      nickname: member.nickname,
      imageUrl: member.image_url,
      roles: member.roles || [],
      muted: member.muted,
    }));

    // Also get the current user to identify self
    const userResult = await groupMeService.getUserInfo();
    const currentUserId = userResult.data?.user_id || userResult.data?.id || null;

    return NextResponse.json({
      success: true,
      members,
      currentUserId,
      groupName: result.data.name,
      groupImageUrl: result.data.image_url,
    });
  } catch (error) {
    console.error('Error fetching group members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group members' },
      { status: 500 }
    );
  }
}
