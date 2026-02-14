// Lead Contact Made API
// POST: Rep marks that they've made first contact with a lead
// Updates status, records response time, posts confirmation to GroupMe,
// and pushes status change to JobNimbus

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadResponseTimerService } from '@/lib/lead-response-timer';
import { leadPortalService } from '@/lib/lead-portal-service';
import { riverBot } from '@/lib/river-bot-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { leadId, repSlug, notes } = await request.json();

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'leadId is required' },
        { status: 400 }
      );
    }

    // Record contact in timer service
    const result = await leadResponseTimerService.recordContact(leadId);

    // Update lead status to contacted
    let leadName = '';
    let jnContactId = '';
    try {
      await leadPortalService.updateLeadStatus(leadId, 'contacted', repSlug || 'system');

      // Try to get the customer name and JN contact ID for the notification/sync
      const lead = await leadPortalService.getLeadById(leadId);
      if (lead) {
        leadName = lead.customerName;
        jnContactId = lead.jobnimbusContactId || '';
      }
    } catch {
      // Lead may not exist yet in portal service - that's ok
    }

    // Push status change to JobNimbus (fire-and-forget)
    if (jnContactId && isJobNimbusConfigured()) {
      const repMember = repSlug ? TEAM_MEMBERS.find(m => m.slug === repSlug) : null;
      const repName = repMember?.name || repSlug || 'system';

      jnSyncEngine.pushContactStatusUpdate(
        jnContactId,
        'contacted',
        repName
      ).then(syncResult => {
        if (syncResult.success) {
        } else {
          console.warn(`[Lead ${leadId}] JN status sync failed: ${syncResult.message}`);
        }
      }).catch(err => {
        console.warn(`[Lead ${leadId}] JN status sync error:`, err);
      });
    }

    // Send GroupMe confirmation (non-blocking)
    if (result.responseMinutes !== undefined) {
      const repMember = repSlug ? TEAM_MEMBERS.find(m => m.slug === repSlug) : null;
      const repName = repMember?.name || repSlug || 'Unknown rep';

      riverBot.announceToGroup(
        `[CONTACT MADE] ${repName} contacted ${leadName || leadId} in ${result.responseMinutes} minutes${notes ? ` - "${notes}"` : ''}`
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: {
        leadId,
        responseMinutes: result.responseMinutes,
        message: result.responseMinutes !== undefined
          ? `Contact recorded. Response time: ${result.responseMinutes} minutes.`
          : 'Contact recorded.',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
