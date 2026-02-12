import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { groupMeService } from '@/lib/groupme-service';

// GET - List user's GroupMe groups
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const result = await groupMeService.listGroups();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch groups' },
        { status: 500 }
      );
    }

    // Return simplified group data
    const groups = (result.data || []).map((group) => ({
      id: group.group_id || group.id,
      name: group.name,
      description: group.description,
      imageUrl: group.image_url,
      memberCount: group.members?.length || 0,
      lastMessage: group.messages?.preview ? {
        text: group.messages.preview.text,
        sender: group.messages.preview.nickname,
        timestamp: group.messages.last_message_created_at,
      } : null,
      messageCount: group.messages?.count || 0,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    }));

    return NextResponse.json({ success: true, groups });
  } catch (error) {
    console.error('Error fetching GroupMe groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}
