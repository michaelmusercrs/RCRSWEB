import { requireAuth } from '@/lib/auth-service';
import { apiSuccess, apiError } from '@/lib/api-response';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    if (!isJobNimbusConfigured()) {
      return apiSuccess({ leads: [], total: 0, message: 'JobNimbus not configured' });
    }

    const currentUser = TEAM_MEMBERS.find(
      m => m.id === auth.user.userId || m.email === auth.user.email
    );
    const repName = currentUser?.name || auth.user.name;

    const contacts = await jnSyncEngine.getContactsForRep(repName, 500).catch(() => []);

    const leads = contacts
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map(c => ({
        name: c.name,
        status: c.status,
        source: c.source,
        date: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : (c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ''),
        phone: c.phone,
        email: c.email || '',
        address: c.address || '',
      }));

    return apiSuccess({ leads, total: leads.length, rep: repName });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return apiError('Failed to load leads', 500);
  }
}
