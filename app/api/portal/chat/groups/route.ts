import { NextRequest, NextResponse } from 'next/server';
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

// POST - Create a new group chat
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { name, description, members } = body as {
      name: string;
      description?: string;
      members?: Array<{ user_id: string; nickname: string }>;
    };

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Group name must be under 100 characters' },
        { status: 400 }
      );
    }

    const result = await groupMeService.createGroup(name.trim(), {
      description: description || `RCRS team group: ${name.trim()}`,
      share: false,
      members,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create group' },
        { status: 500 }
      );
    }

    const group = result.data;
    return NextResponse.json({
      success: true,
      group: group ? {
        id: group.group_id || group.id,
        name: group.name,
        description: group.description,
        memberCount: group.members?.length || 0,
      } : null,
    });
  } catch (error) {
    console.error('Error creating GroupMe group:', error);
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}
