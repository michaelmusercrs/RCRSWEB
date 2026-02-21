'use server';

import { commitMultipleFilesToGitHub } from '@/lib/github-utils';
import { TeamMember } from '@/lib/teamData';

/**
 * Update a team member and commit to GitHub
 */
export async function updateTeamMemberWithGit(member: TeamMember) {
  try {
    const filePath = `src/data/members/${member.slug}.json`;
    const content = JSON.stringify(member, null, 2);

    const result = await commitMultipleFilesToGitHub(
      [
        {
          path: filePath,
          content: content,
          message: `Update team member: ${member.name}`,
        },
      ],
      `Update team member: ${member.name}`
    );

    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    console.error('Failed to update team member:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Failed to update team member',
    };
  }
}

/**
 * Create a new team member and commit to GitHub
 */
export async function createTeamMemberWithGit(member: TeamMember) {
  try {
    const filePath = `src/data/members/${member.slug}.json`;
    const content = JSON.stringify(member, null, 2);

    const result = await commitMultipleFilesToGitHub(
      [
        {
          path: filePath,
          content: content,
          message: `Add new team member: ${member.name}`,
        },
      ],
      `Add new team member: ${member.name}`
    );

    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    console.error('Failed to create team member:', error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create team member',
    };
  }
}

/**
 * Update location page content and commit to GitHub
 */
export async function updateLocationPageWithGit(
  locationName: string,
  pageContent: string
) {
  try {
    // Map location name to file
    const locationMap: Record<string, string> = {
      decatur: 'src/app/(routes)/locations/decatur/page.tsx',
      huntsville: 'src/app/(routes)/locations/huntsville/page.tsx',
      madison: 'src/app/(routes)/locations/madison/page.tsx',
      athens: 'src/app/(routes)/locations/athens/page.tsx',
      birmingham: 'src/app/(routes)/locations/birmingham/page.tsx',
      'owens-crossroads': 'src/app/(routes)/locations/owens-crossroads/page.tsx',
      nashville: 'src/app/(routes)/locations/nashville/page.tsx',
    };

    const filePath = locationMap[locationName.toLowerCase()];

    if (!filePath) {
      return {
        success: false,
        message: `Location "${locationName}" not found`,
      };
    }

    const result = await commitMultipleFilesToGitHub(
      [
        {
          path: filePath,
          content: pageContent,
          message: `Update ${locationName} location page`,
        },
      ],
      `Update ${locationName} location page`
    );

    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    console.error('Failed to update location page:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Failed to update location page',
    };
  }
}

/**
 * Test GitHub connection
 */
export async function testGitHubConnection() {
  try {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      return {
        success: false,
        message:
          'GITHUB_TOKEN not configured. Add it to Vercel environment variables.',
      };
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `GitHub API error: ${response.status}. Check your GITHUB_TOKEN.`,
      };
    }

    const data = (await response.json()) as { login: string };

    return {
      success: true,
      message: `Connected as ${data.login}`,
      user: data.login,
    };
  } catch (error) {
    console.error('Failed to test GitHub connection:', error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to test GitHub connection',
    };
  }
}
