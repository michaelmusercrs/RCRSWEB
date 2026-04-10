/**
 * Team Members API Route
 * Handles listing and creating team members
 */

import { NextRequest, NextResponse } from 'next/server';
import { teamMembers, TeamMember } from '@/lib/teamData';
import { requireAdmin } from '@/lib/auth-service';

const BLOB_KEY = 'data/team-members.json';
const LOCAL_PATH = 'data/team-members.json';

/**
 * Read team members - tries Vercel Blob first, then local file
 */
async function readTeamMembers(): Promise<TeamMember[]> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: BLOB_KEY });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch (e) { /* blob not available */ }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Return in-memory default data
    return [...teamMembers];
  }
}

/**
 * Write team members - tries Vercel Blob first, then local file (dev only).
 *
 * Canonical source of truth for team members is the `team-members-import` tab
 * on the master Google Sheet. This Blob/fs cache layer is legacy and should
 * be migrated to use googleSheetsService.updateTeamMember directly. For now
 * the fs fallback is wrapped in try/catch so a read-only filesystem on Vercel
 * doesn't crash the route.
 */
async function writeTeamMembers(members: TeamMember[]): Promise<void> {
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_KEY, JSON.stringify(members, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false,
    });
    return;
  } catch (e) {
    console.warn('[team-members] Blob write failed, attempting local fs fallback:', e);
  }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(members, null, 2));
  } catch (fsErr) {
    console.warn('[team-members] Local fs write skipped (read-only fs?):', fsErr);
  }
}

/**
 * GET /api/admin/team-members
 * Returns all team members
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    // Use in-memory team data directly (Vercel has read-only filesystem)
    const members = [...teamMembers];

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let filtered = members;

    // Filter by category
    if (category && category !== 'all') {
      filtered = filtered.filter(m => m.category === category);
    }

    // Filter by search term (name, position, email)
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        m.position.toLowerCase().includes(searchLower) ||
        m.email.toLowerCase().includes(searchLower)
      );
    }

    // Sort by displayOrder
    filtered.sort((a, b) => a.displayOrder - b.displayOrder);

    return NextResponse.json({
      success: true,
      members: filtered,
      total: members.length,
      filtered: filtered.length,
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch team members',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/team-members
 * Creates a new team member
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();

    // Validate required fields
    const required = ['name', 'position', 'category', 'email'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    const members = await readTeamMembers();

    // Generate slug from name
    const slug = body.slug || body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if slug already exists
    if (members.some(m => m.slug === slug)) {
      return NextResponse.json(
        {
          success: false,
          error: 'A team member with this name already exists',
        },
        { status: 400 }
      );
    }

    // Get the highest displayOrder and add 1
    const maxOrder = Math.max(...members.map(m => m.displayOrder), 0);

    // Create new team member
    const newMember: TeamMember = {
      slug,
      name: body.name,
      company: body.company || 'River City Roofing Solutions',
      category: body.category,
      position: body.position,
      phone: body.phone || '',
      email: body.email,
      altEmail: body.altEmail || body.email,
      displayOrder: body.displayOrder || maxOrder + 1,
      bio: body.bio || '',
      tagline: body.tagline,
      region: body.region,
      launchDate: body.launchDate,
      profileImage: body.profileImage,
      truckImage: body.truckImage,
      facebook: body.facebook,
      instagram: body.instagram,
      x: body.x,
      keyStrengths: body.keyStrengths || [],
      responsibilities: body.responsibilities || [],
    };

    // Add to members array
    members.push(newMember);

    // Save
    await writeTeamMembers(members);

    return NextResponse.json({
      success: true,
      member: newMember,
      message: 'Team member created successfully',
    });
  } catch (error) {
    console.error('Error creating team member:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create team member',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/team-members (bulk reorder)
 * Updates displayOrder for multiple team members
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();

    if (!Array.isArray(body.members)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: members array required',
        },
        { status: 400 }
      );
    }

    const members = await readTeamMembers();

    // Update displayOrder for each member
    body.members.forEach((update: { slug: string; displayOrder: number }) => {
      const member = members.find(m => m.slug === update.slug);
      if (member) {
        member.displayOrder = update.displayOrder;
      }
    });

    await writeTeamMembers(members);

    return NextResponse.json({
      success: true,
      message: 'Team members reordered successfully',
    });
  } catch (error) {
    console.error('Error reordering team members:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reorder team members',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
