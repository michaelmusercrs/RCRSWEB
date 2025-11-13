/**
 * Individual Team Member API Route
 * Handles get, update, and delete operations for a specific team member
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { TeamMember } from '@/lib/teamData';

const DATA_FILE = path.join(process.cwd(), 'data', 'team-members.json');

/**
 * Read team members from JSON file
 */
async function readTeamMembers(): Promise<TeamMember[]> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Write team members to JSON file
 */
async function writeTeamMembers(members: TeamMember[]): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(members, null, 2));
}

/**
 * GET /api/admin/team-members/[slug]
 * Returns a specific team member
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const members = await readTeamMembers();
    const member = members.find(m => m.slug === params.slug);

    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: 'Team member not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      member,
    });
  } catch (error) {
    console.error('Error fetching team member:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch team member',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/team-members/[slug]
 * Updates a specific team member
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await req.json();
    const members = await readTeamMembers();

    const memberIndex = members.findIndex(m => m.slug === params.slug);

    if (memberIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Team member not found',
        },
        { status: 404 }
      );
    }

    // Update member (keep slug unchanged)
    const updatedMember: TeamMember = {
      ...members[memberIndex],
      ...body,
      slug: params.slug, // Never change the slug
    };

    members[memberIndex] = updatedMember;

    await writeTeamMembers(members);

    return NextResponse.json({
      success: true,
      member: updatedMember,
      message: 'Team member updated successfully',
    });
  } catch (error) {
    console.error('Error updating team member:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update team member',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/team-members/[slug]
 * Deletes a specific team member
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const members = await readTeamMembers();

    const memberIndex = members.findIndex(m => m.slug === params.slug);

    if (memberIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Team member not found',
        },
        { status: 404 }
      );
    }

    // Remove member
    const deletedMember = members.splice(memberIndex, 1)[0];

    await writeTeamMembers(members);

    return NextResponse.json({
      success: true,
      member: deletedMember,
      message: 'Team member deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting team member:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete team member',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
