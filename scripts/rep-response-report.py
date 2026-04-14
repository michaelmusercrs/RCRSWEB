"""
Rep Response Time Report
========================
Tracks time between office creating a lead and the sales rep's first contact attempt.

Office staff: Sara Hill, Tia Muse Morris, Destin McCary, Bart Roberts
Lead sources: Only "legit" inbound leads (Google, TV, Website, BBB, Yard Sign, etc.)
Excludes: Personal referrals, Neighbor, Family, Door Knock (rep-generated), BNI referrals

Uses ES-style filter on JN activities API: {"must":[{"term":{"related.id":"JOB_JNID"}}]}
"""

import json
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

# Config
API_KEY = "mb3blj22awhl50rc"
API_URL = "https://app.jobnimbus.com/api1"
DAYS_BACK = 90

# Office staff who create/assign leads
OFFICE_STAFF = {
    'sara hill', 'destin mccary', 'tia muse morris', 'tia morris', 'tia muse',
    'bart roberts',
}

# System/automation authors to exclude from "first contact"
SYSTEM_AUTHORS = {
    'system', 'automation', 'jobnimbus', 'api', 'webhook',
    'rcrs portal', 'portal', '[portal', '[rcrs',
}

# LEGIT lead sources (office-generated, real inbound leads)
LEGIT_SOURCES = {
    'google', 'tv commercial', 'waff 48 news', 'website', 'bbb lead',
    'yard sign', 'drove by the office', 'stopped by the office',
    'company facebook', 'personal truck', 'business card',
    'athens now- newspaper', 'home builders association',
    'huntsville home inspection service', 'yelp',
    'huntsville spring home and garden show', 'decatur home show',
    'property manager',
}

SYSTEM_ACTIVITY_TYPES = {
    'Contact Created', 'Assigned Contact', 'Related to job',
    'Assigned Job', 'Job Created', 'Status Changed', 'Workflow',
    'Merge', 'Unmerge',
}


def is_office_staff(name):
    lower = (name or '').lower().strip()
    return any(s in lower for s in OFFICE_STAFF)

def is_system(name):
    lower = (name or '').lower().strip()
    return any(s in lower for s in SYSTEM_AUTHORS)

def is_legit_source(source_name):
    if not source_name:
        return False
    return source_name.lower().strip() in LEGIT_SOURCES

def safe_str(s):
    return (s or '').encode('ascii', 'replace').decode()


def fetch_json(endpoint):
    url = f"{API_URL}{endpoint}"
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))


def fetch_activities_for_id(entity_id, field="related.id", limit=50):
    """Fetch activities for an entity using ES-style filter.
    field: 'related.id' for jobs, 'primary.id' for contacts"""
    filter_json = json.dumps({"must": [{"term": {field: entity_id}}]})
    params = urllib.parse.urlencode({
        'filter': filter_json,
        'limit': limit,
        'sort': 'date_created',  # ascending
    })
    url = f"{API_URL}/activities?{params}"
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    return data.get('activity', [])


def main():
    print("=" * 80)
    print("REP RESPONSE TIME REPORT - OFFICE LEADS ONLY")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Looking back: {DAYS_BACK} days")
    print("=" * 80)

    # =========================================================================
    # STEP 1: Fetch contacts
    # =========================================================================
    print("\n[1/4] Fetching contacts from JobNimbus...")
    now_ts = int(datetime.now().timestamp())
    since_ts = now_ts - (DAYS_BACK * 86400)

    all_contacts = []
    offset = 0
    while True:
        data = fetch_json(f"/contacts?limit=100&offset={offset}&sort=-date_created")
        contacts = data.get('results', [])
        if not contacts:
            break
        past_range = False
        for c in contacts:
            if (c.get('date_created') or 0) < since_ts:
                past_range = True
                break
            all_contacts.append(c)
        if past_range or len(contacts) < 100:
            break
        offset += 100
        if offset >= 20000:
            break

    print(f"  Total contacts in last {DAYS_BACK} days: {len(all_contacts)}")

    # Filter to office-created with rep assigned
    office_contacts = [
        c for c in all_contacts
        if is_office_staff(c.get('created_by_name', ''))
        and c.get('sales_rep_name')
    ]
    print(f"  Office-created with rep assigned: {len(office_contacts)}")

    # Filter to legit sources + show what we exclude
    legit_contacts = [c for c in office_contacts if is_legit_source(c.get('source_name', ''))]
    excluded = [c for c in office_contacts if not is_legit_source(c.get('source_name', ''))]
    excluded_sources = defaultdict(int)
    for c in excluded:
        excluded_sources[c.get('source_name') or '(empty)'] += 1

    print(f"  Legit inbound leads: {len(legit_contacts)}")
    print(f"  Excluded ({len(excluded)}):")
    for src, cnt in sorted(excluded_sources.items(), key=lambda x: -x[1]):
        print(f"    {cnt:3d} {src}")

    if not legit_contacts:
        print("\nNo legit office leads found.")
        return

    # =========================================================================
    # STEP 2: Find jobs for each contact
    # =========================================================================
    print(f"\n[2/4] Finding jobs for {len(legit_contacts)} contacts...")

    all_jobs = []
    offset = 0
    while True:
        data = fetch_json(f"/jobs?limit=100&offset={offset}&sort=-date_created")
        jobs = data.get('results', [])
        if not jobs:
            break
        past_range = False
        for j in jobs:
            if (j.get('date_created') or 0) < since_ts - 86400:
                past_range = True
                break
            all_jobs.append(j)
        if past_range or len(jobs) < 100:
            break
        offset += 100
        if offset >= 20000:
            break

    # Build contact->job mapping
    contact_jobs = {}
    for c in legit_contacts:
        cjnid = c['jnid']
        for j in all_jobs:
            p = j.get('primary') or {}
            if p.get('id') == cjnid:
                if cjnid not in contact_jobs:
                    contact_jobs[cjnid] = []
                contact_jobs[cjnid].append(j['jnid'])

    matched = sum(1 for c in legit_contacts if c['jnid'] in contact_jobs)
    print(f"  Contacts with jobs: {matched}/{len(legit_contacts)}")

    # =========================================================================
    # STEP 3: Fetch activities per contact and analyze
    # =========================================================================
    print(f"\n[3/4] Fetching activities per contact (ES filter)...")

    results = []

    for i, c in enumerate(legit_contacts):
        cjnid = c['jnid']
        contact_created = c.get('date_created', 0)
        rep_name = c.get('sales_rep_name', 'Unknown')
        contact_name = c.get('display_name') or f"{c.get('first_name','')} {c.get('last_name','')}".strip()

        # Fetch activities for this contact's job(s) and the contact itself
        all_activities = []

        # Activities on the job (related.id = job JNID)
        job_jnids = contact_jobs.get(cjnid, [])
        for jjnid in job_jnids:
            try:
                acts = fetch_activities_for_id(jjnid, "related.id", 50)
                all_activities.extend(acts)
            except Exception as e:
                pass

        # Activities on the contact (primary.id = contact JNID)
        try:
            acts = fetch_activities_for_id(cjnid, "primary.id", 50)
            all_activities.extend(acts)
        except Exception as e:
            pass

        # Also check related.id = contact JNID
        try:
            acts = fetch_activities_for_id(cjnid, "related.id", 50)
            all_activities.extend(acts)
        except Exception as e:
            pass

        # Deduplicate by jnid
        seen = set()
        unique_activities = []
        for a in all_activities:
            aid = a.get('jnid', '')
            if aid not in seen:
                seen.add(aid)
                unique_activities.append(a)

        unique_activities.sort(key=lambda x: x.get('date_created', 0))

        if not unique_activities:
            results.append({
                'contact': contact_name,
                'jnid': cjnid,
                'created_by': c.get('created_by_name', '?'),
                'source': c.get('source_name', '?'),
                'rep': rep_name,
                'created_at': contact_created,
                'first_action_at': None,
                'first_action_type': None,
                'first_action_by': None,
                'first_action_note': None,
                'response_minutes': None,
                'status': 'NO ACTIVITIES FOUND',
                'total_activities': 0,
            })
            sys.stdout.write(f"  [{i+1}/{len(legit_contacts)}] {contact_name}: NO ACTIVITIES\n")
            sys.stdout.flush()
            time.sleep(0.3)  # Rate limit
            continue

        # Find first REAL contact attempt by a non-office, non-system person
        first_contact = None
        for a in unique_activities:
            act_time = a.get('date_created', 0)
            if act_time <= contact_created:
                continue

            author = a.get('created_by_name', '')
            if is_office_staff(author) or is_system(author):
                continue
            if 'automation' in (author or '').lower():
                continue

            act_type = a.get('record_type_name', '')
            if act_type in SYSTEM_ACTIVITY_TYPES:
                continue
            if a.get('is_status_change'):
                continue

            first_contact = a
            break

        if not first_contact:
            results.append({
                'contact': contact_name,
                'jnid': cjnid,
                'created_by': c.get('created_by_name', '?'),
                'source': c.get('source_name', '?'),
                'rep': rep_name,
                'created_at': contact_created,
                'first_action_at': None,
                'first_action_type': None,
                'first_action_by': None,
                'first_action_note': None,
                'response_minutes': None,
                'status': f'NO REP ACTION ({len(unique_activities)} office/system activities)',
                'total_activities': len(unique_activities),
            })
            sys.stdout.write(f"  [{i+1}/{len(legit_contacts)}] {contact_name}: {len(unique_activities)} activities, no rep action\n")
            sys.stdout.flush()
            time.sleep(0.3)
            continue

        response_time = first_contact.get('date_created', 0) - contact_created
        response_minutes = round(response_time / 60, 1)

        if response_minutes < 0 or response_minutes > 43200:
            time.sleep(0.3)
            continue

        note_preview = safe_str((first_contact.get('note', '') or '')[:120].replace('\n', ' '))

        results.append({
            'contact': contact_name,
            'jnid': cjnid,
            'created_by': c.get('created_by_name', '?'),
            'source': c.get('source_name', '?'),
            'rep': rep_name,
            'created_at': contact_created,
            'first_action_at': first_contact.get('date_created'),
            'first_action_type': first_contact.get('record_type_name', '?'),
            'first_action_by': first_contact.get('created_by_name', '?'),
            'first_action_note': note_preview,
            'response_minutes': response_minutes,
            'status': 'RESPONDED',
            'total_activities': len(unique_activities),
        })

        if response_minutes < 60:
            time_str = f"{response_minutes:.0f}min"
        elif response_minutes < 1440:
            time_str = f"{response_minutes/60:.1f}hr"
        else:
            time_str = f"{response_minutes/1440:.1f}days"

        sys.stdout.write(f"  [{i+1}/{len(legit_contacts)}] {contact_name}: {time_str} via {first_contact.get('record_type_name','?')} by {first_contact.get('created_by_name','?')}\n")
        sys.stdout.flush()
        time.sleep(0.3)  # Rate limit

    # =========================================================================
    # STEP 4: Output Report
    # =========================================================================
    responded = [r for r in results if r['status'] == 'RESPONDED']
    not_responded = [r for r in results if r['status'] != 'RESPONDED']
    results.sort(key=lambda x: (x['response_minutes'] is None, x['response_minutes'] or 99999))

    print(f"\n\n{'=' * 80}")
    print(f"LEAD-BY-LEAD RESULTS ({len(responded)} responded, {len(not_responded)} no response)")
    print("=" * 80)

    for r in results:
        created = datetime.fromtimestamp(r['created_at']).strftime('%m/%d %H:%M') if r['created_at'] else '?'

        if r['response_minutes'] is not None:
            action_time = datetime.fromtimestamp(r['first_action_at']).strftime('%m/%d %H:%M') if r['first_action_at'] else '?'
            mins = r['response_minutes']

            if mins <= 5: grade = "A"
            elif mins <= 15: grade = "B"
            elif mins <= 30: grade = "C"
            elif mins <= 60: grade = "D"
            else: grade = "F"

            if mins < 60:
                time_str = f"{mins:.0f}min"
            elif mins < 1440:
                time_str = f"{mins/60:.1f}hr"
            else:
                time_str = f"{mins/1440:.1f}days"

            print(f"\n  [{grade}] {safe_str(r['contact'])} ({r['source']})")
            print(f"      Created: {created} by {r['created_by']} -> Rep: {r['rep']}")
            print(f"      FIRST CONTACT: {action_time} ({time_str}) via {r['first_action_type']} by {r['first_action_by']}")
            if r['first_action_note']:
                print(f"      Note: {r['first_action_note'][:100]}")
        else:
            print(f"\n  [X] {safe_str(r['contact'])} ({r['source']}) - {r['status']}")
            print(f"      Created: {created} by {r['created_by']} -> Rep: {r['rep']}")

    # =========================================================================
    # PER-REP SUMMARY
    # =========================================================================
    print(f"\n\n{'=' * 80}")
    print("PER-REP SUMMARY")
    print("=" * 80)

    rep_data = defaultdict(lambda: {
        'times': [], 'total': 0, 'responded': 0, 'no_response': 0,
        'by_type': defaultdict(int),
    })

    for r in results:
        rep = r['rep']
        rep_data[rep]['total'] += 1
        if r['response_minutes'] is not None:
            rep_data[rep]['responded'] += 1
            rep_data[rep]['times'].append(r['response_minutes'])
            rep_data[rep]['by_type'][r['first_action_type']] += 1
        else:
            rep_data[rep]['no_response'] += 1

    rep_summaries = []
    for rep, data in rep_data.items():
        if data['times']:
            sorted_times = sorted(data['times'])
            avg = sum(sorted_times) / len(sorted_times)
            mid = len(sorted_times) // 2
            med = sorted_times[mid] if len(sorted_times) % 2 else (sorted_times[mid-1] + sorted_times[mid]) / 2
        else:
            avg = med = 0
        rep_summaries.append({'rep': rep, 'avg': avg, 'median': med, **data})

    rep_summaries.sort(key=lambda x: (x['avg'] == 0, x['avg']))

    for s in rep_summaries:
        if s['avg'] <= 5: grade = 'A'
        elif s['avg'] <= 15: grade = 'B'
        elif s['avg'] <= 30: grade = 'C'
        elif s['avg'] <= 60: grade = 'D'
        elif s['avg'] > 0: grade = 'F'
        else: grade = '?'

        response_pct = f"{s['responded']/s['total']*100:.0f}%" if s['total'] > 0 else "N/A"

        print(f"\n  {s['rep']} [{grade}] - Response rate: {response_pct}")
        print(f"    Leads: {s['total']} | Responded: {s['responded']} | No response: {s['no_response']}")
        if s['times']:
            sorted_times = sorted(s['times'])
            avg_str = f"{s['avg']:.0f}min" if s['avg'] < 60 else f"{s['avg']/60:.1f}hr"
            med_str = f"{s['median']:.0f}min" if s['median'] < 60 else f"{s['median']/60:.1f}hr"
            fast = f"{min(sorted_times):.0f}min" if min(sorted_times) < 60 else f"{min(sorted_times)/60:.1f}hr"
            slow = f"{max(sorted_times):.0f}min" if max(sorted_times) < 60 else f"{max(sorted_times)/60:.1f}hr"
            print(f"    Avg: {avg_str} | Median: {med_str} | Fastest: {fast} | Slowest: {slow}")

            u5 = len([t for t in sorted_times if t <= 5])
            u15 = len([t for t in sorted_times if 5 < t <= 15])
            u30 = len([t for t in sorted_times if 15 < t <= 30])
            u60 = len([t for t in sorted_times if 30 < t <= 60])
            o60 = len([t for t in sorted_times if t > 60])
            print(f"    <5min: {u5} | 5-15min: {u15} | 15-30min: {u30} | 30-60min: {u60} | >60min: {o60}")

            types = [f"{t}: {c}" for t, c in sorted(s['by_type'].items(), key=lambda x: -x[1])]
            print(f"    Contact types: {' | '.join(types)}")

    # =========================================================================
    # OVERALL SUMMARY
    # =========================================================================
    all_times = [r['response_minutes'] for r in results if r['response_minutes'] is not None]

    print(f"\n\n{'=' * 80}")
    print("OVERALL SUMMARY")
    print("=" * 80)
    print(f"  Total legit office leads:  {len(results)}")
    print(f"  With response tracked:     {len(all_times)}")
    print(f"  No response found:         {len(results) - len(all_times)}")

    if all_times:
        all_times.sort()
        avg = sum(all_times) / len(all_times)
        mid = len(all_times) // 2
        med = all_times[mid] if len(all_times) % 2 else (all_times[mid-1] + all_times[mid]) / 2

        print(f"\n  Average response:  {avg:.0f} min ({avg/60:.1f} hr)")
        print(f"  Median response:   {med:.0f} min ({med/60:.1f} hr)")
        print(f"  Fastest:           {min(all_times):.0f} min")
        print(f"  Slowest:           {max(all_times):.0f} min ({max(all_times)/60:.1f} hr)")

        total = len(all_times)
        u5 = len([t for t in all_times if t <= 5])
        u15 = len([t for t in all_times if t <= 15])
        u30 = len([t for t in all_times if t <= 30])
        u60 = len([t for t in all_times if t <= 60])
        print(f"\n  Under 5 min:   {u5}/{total} ({u5/total*100:.0f}%)")
        print(f"  Under 15 min:  {u15}/{total} ({u15/total*100:.0f}%)")
        print(f"  Under 30 min:  {u30}/{total} ({u30/total*100:.0f}%)")
        print(f"  Under 60 min:  {u60}/{total} ({u60/total*100:.0f}%)")

    print(f"\n  Lead sources:")
    source_counts = defaultdict(int)
    for r in results:
        source_counts[r['source']] += 1
    for src, cnt in sorted(source_counts.items(), key=lambda x: -x[1]):
        print(f"    {cnt:3d}  {src}")

    print(f"\n  Grading: A=<5min  B=5-15min  C=15-30min  D=30-60min  F=>60min")
    print(f"\n  NOTE: 'No response' means no non-office activity found in JN for this contact.")
    print(f"  The rep may have contacted via phone/text outside of JN.")


if __name__ == '__main__':
    main()
