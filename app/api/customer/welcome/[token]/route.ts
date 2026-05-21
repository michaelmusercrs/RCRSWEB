// Customer Welcome Portal API
//
// GET /api/customer/welcome/[token]
// Returns the data needed to render the welcome page: the assigned rep's
// profile (bio + photos), the customer's address, and the static company
// info. NO sensitive lead-quality / score data — customers never see those.

import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService } from '@/lib/lead-portal-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ success: false, error: 'token required' }, { status: 400 });
  }

  try {
    const lead = await leadPortalService.getLeadByToken(token);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Invalid or expired link' }, { status: 404 });
    }

    const repSlug = lead.salesRepSlug || '';
    const member = TEAM_MEMBERS.find(m =>
      m.slug === repSlug ||
      repSlug.startsWith(m.slug + '-') ||
      repSlug === m.slug.split('-')[0]
    );
    const profile = repSlug ? await googleSheetsService.getTeamProfile(repSlug) : null;

    return NextResponse.json({
      success: true,
      customer: {
        name: lead.customerName,
        address: lead.customerAddress,
        city: '',
      },
      rep: member ? {
        name: member.name,
        email: member.email,
        phone: member.phone || '',
        bio: profile?.bio || '',
        headshotUrl: profile?.headshotUrl || '',
        truckPicUrl: profile?.truckPicUrl || '',
        certifications: profile?.certifications || '',
        yearsExperience: profile?.yearsExperience || '',
        favoriteQuote: profile?.favoriteQuote || '',
      } : null,
      company: {
        name: 'River City Roofing Solutions',
        phone: '(256) 656-7856',
        website: 'https://rivercityroofingsolutions.com',
        certifications: ['IKO ROOFPRO Craftsman Premier', 'OC Preferred', 'BBB A+'],
        about: 'Family-owned roofing company serving the Tennessee Valley. Insurance restoration, retail replacement, and 24/7 emergency tarping.',
      },
      links: {
        ikoVisualizer: 'https://www.iko.com/roof-visualizer',
        ourGallery: 'https://rivercityroofingsolutions.com/gallery',
        ourCertifications: 'https://rivercityroofingsolutions.com/about',
      },
      welcome: {
        thankYou: `Thanks for reaching out to River City Roofing Solutions. We're glad you got in touch.`,
        nextSteps: 'Your assigned roofing specialist will be in touch shortly to schedule a free inspection. In the meantime, feel free to explore the IKO roof visualizer below to see what your home could look like with a new roof.',
      },
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, { status: 500 });
  }
}
