import { requireAuth } from '@/lib/auth-service';
import { apiSuccess, apiError } from '@/lib/api-response';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import commissionsData from '@/data/commissions.json';

interface RawCommission {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
  customer?: string;
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const currentUser = TEAM_MEMBERS.find(
      m => m.id === auth.user.userId || m.email === auth.user.email
    );
    const repName = currentUser?.name || auth.user.name;

    // Get customers from commissions data
    const rawData = commissionsData as RawCommission[];
    const repCommissions = rawData.filter(r =>
      r.salesRep.replace(/\s+/g, ' ').trim().toLowerCase() === repName.toLowerCase() ||
      r.salesRep.replace(/\s+/g, ' ').trim().toLowerCase().split(' ')[0] === repName.toLowerCase().split(' ')[0]
    );

    // Deduplicate customers by name
    const customerMap = new Map<string, { name: string; totalAmount: number; transactions: number; lastDate: string }>();
    for (const r of repCommissions) {
      const custName = r.customer || 'Unknown';
      const existing = customerMap.get(custName);
      if (existing) {
        existing.totalAmount += r.amount;
        existing.transactions++;
        if (r.date > existing.lastDate) existing.lastDate = r.date;
      } else {
        customerMap.set(custName, { name: custName, totalAmount: r.amount, transactions: 1, lastDate: r.date });
      }
    }

    const customers = Array.from(customerMap.values())
      .map(c => ({ ...c, totalAmount: Math.round(c.totalAmount * 100) / 100 }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Also fetch from JN if available
    let jnCustomers: Array<{ name: string; status: string; phone: string }> = [];
    if (isJobNimbusConfigured()) {
      try {
        const contacts = await jnSyncEngine.getContactsForRep(repName, 500).catch(() => []);
        jnCustomers = contacts
          .filter(c => c.status?.toLowerCase().includes('customer'))
          .map(c => ({ name: c.name, status: c.status, phone: c.phone }));
      } catch {}
    }

    return apiSuccess({
      rep: repName,
      customers,
      totalCustomers: customers.length,
      jnCustomers,
      totalJnCustomers: jnCustomers.length,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return apiError('Failed to load customers', 500);
  }
}
