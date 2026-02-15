import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { cmsSheetsService } from '@/lib/cms-sheets-service';
import { cache } from '@/lib/cache';

const CMS_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (slug) {
      const cacheKey = `cms:team:${slug}`;
      const cached = cache.get(cacheKey);
      if (cached) return NextResponse.json(cached);

      const member = await cmsSheetsService.getTeamMemberBySlug(slug);
      if (!member) {
        return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
      }
      cache.set(cacheKey, member, CMS_TTL);
      return NextResponse.json(member);
    }

    const cacheKey = 'cms:team:all';
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const members = await cmsSheetsService.getTeamMembers();
    cache.set(cacheKey, members, CMS_TTL);
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();

    // Generate slug from name if not provided
    if (!data.slug) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const member = await cmsSheetsService.createTeamMember({
      slug: data.slug,
      name: data.name,
      company: data.company || 'River City Roofing Solutions',
      category: data.category || 'Production',
      position: data.position || '',
      phone: data.phone || '',
      email: data.email || '',
      altEmail: data.altEmail || '',
      displayOrder: data.displayOrder || 99,
      tagline: data.tagline || '',
      bio: data.bio || '',
      region: data.region || '',
      launchDate: data.launchDate || '',
      profileImage: data.profileImage || '',
      truckImage: data.truckImage || '',
      facebook: data.facebook || '',
      instagram: data.instagram || '',
      x: data.x || '',
      tiktok: data.tiktok || '',
      linkedin: data.linkedin || '',
    });

    cache.invalidatePattern('^cms:team:');
    return NextResponse.json(member);
  } catch (error) {
    console.error('Error creating team member:', error);
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { slug, ...updates } = data;

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const member = await cmsSheetsService.updateTeamMember(slug, updates);

    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    cache.invalidatePattern('^cms:team:');
    return NextResponse.json(member);
  } catch (error) {
    console.error('Error updating team member:', error);
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const success = await cmsSheetsService.deleteTeamMember(slug);

    if (!success) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    cache.invalidatePattern('^cms:team:');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team member:', error);
    return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 });
  }
}
