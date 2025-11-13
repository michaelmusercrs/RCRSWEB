/**
 * Team Members API Route
 * Handles listing and creating team members
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { teamMembers, TeamMember } from '@/lib/teamData';

// Path to store team data (JSON file for now)
const DATA_FILE = path.join(process.cwd(), 'data', 'team-members.json');

/**
 * Ensure data directory exists and initialize if needed
 */
async function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data');

  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  try {
    await fs.access(DATA_FILE);
  } catch {
    // Initialize with existing team data from teamData.ts
    await fs.writeFile(DATA_FILE, JSON.stringify(teamMembers, null, 2));
  }
}

/**
 * Read team members from JSON file
 */
async function readTeamMembers(): Promise<TeamMember[]> {
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Write team members to JSON file
 */
async function writeTeamMembers(members: TeamMember[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(members, null, 2));
}

/**
 * GET /api/admin/team-members
 * Returns all team members
 */
export async function GET(req: NextRequest) {
  try {
    const members = await readTeamMembers();

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

    // Save to file
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
