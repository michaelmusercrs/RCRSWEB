import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { groupMeService } from '@/lib/groupme-service';

// GET - Fetch direct messages with a user
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const beforeId = searchParams.get('before_id') || undefined;
    const sinceId = searchParams.get('since_id') || undefined;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const result = await groupMeService.getDirectMessages(userId, {
      before_id: beforeId,
      since_id: sinceId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch direct messages' },
        { status: 500 }
      );
    }

    const messages = (result.data?.direct_messages || []).map((msg) => ({
      id: msg.id,
      text: msg.text,
      senderId: msg.sender_id || msg.user_id,
      senderName: msg.name,
      avatarUrl: msg.avatar_url,
      recipientId: msg.recipient_id,
      createdAt: msg.created_at,
      attachments: msg.attachments || [],
      favoritedBy: msg.favorited_by || [],
      conversationId: msg.conversation_id,
    }));

    return NextResponse.json({
      success: true,
      messages,
      count: result.data?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch direct messages' },
      { status: 500 }
    );
  }
}

// POST - Send a direct message
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { userId, text, attachments } = body;

    if (!userId || !text) {
      return NextResponse.json(
        { error: 'userId and text are required' },
        { status: 400 }
      );
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'Message text must be under 1000 characters' },
        { status: 400 }
      );
    }

    const result = await groupMeService.sendDirectMessage(userId, text, attachments);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send direct message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.data?.direct_message ? {
        id: result.data.direct_message.id,
        text: result.data.direct_message.text,
        senderId: result.data.direct_message.sender_id,
        senderName: result.data.direct_message.name,
        recipientId: result.data.direct_message.recipient_id,
        createdAt: result.data.direct_message.created_at,
      } : null,
    });
  } catch (error) {
    console.error('Error sending direct message:', error);
    return NextResponse.json(
      { error: 'Failed to send direct message' },
      { status: 500 }
    );
  }
}
