import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { groupMeService } from '@/lib/groupme-service';
import { isQuietHours, QUIET_HOURS_ERROR } from '@/lib/chat-quiet-hours';

// GET - Fetch messages from a group
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const beforeId = searchParams.get('before_id') || undefined;
    const sinceId = searchParams.get('since_id') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 }
      );
    }

    const result = await groupMeService.getGroupMessages(groupId, {
      before_id: beforeId,
      since_id: sinceId,
      limit: Math.min(limit, 100),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    const messages = (result.data?.messages || []).map((msg) => ({
      id: msg.id,
      text: msg.text,
      senderId: msg.sender_id || msg.user_id,
      senderName: msg.name,
      avatarUrl: msg.avatar_url,
      createdAt: msg.created_at,
      attachments: msg.attachments || [],
      favoritedBy: msg.favorited_by || [],
      system: msg.system,
      senderType: msg.sender_type,
    }));

    return NextResponse.json({
      success: true,
      messages,
      count: result.data?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching GroupMe messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST - Send a message to a group
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { groupId, text, attachments } = body;

    if (!groupId || !text) {
      return NextResponse.json(
        { error: 'groupId and text are required' },
        { status: 400 }
      );
    }

    // HARD RULE: No messages between 8 PM and 7 AM CST
    if (isQuietHours()) {
      return NextResponse.json(QUIET_HOURS_ERROR, { status: 403 });
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'Message text must be under 1000 characters' },
        { status: 400 }
      );
    }

    const result = await groupMeService.sendMessage(groupId, text, attachments);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.data?.message ? {
        id: result.data.message.id,
        text: result.data.message.text,
        senderId: result.data.message.sender_id || result.data.message.user_id,
        senderName: result.data.message.name,
        avatarUrl: result.data.message.avatar_url,
        createdAt: result.data.message.created_at,
      } : null,
    });
  } catch (error) {
    console.error('Error sending GroupMe message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
