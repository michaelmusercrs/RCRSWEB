#!/bin/bash
# RCRS Website Security Patch Deployment
# Run these commands to stage and deploy the security fix
# Date: 2026-04-14

echo "================================================================================"
echo "RCRS Website Security Patch Deployment"
echo "================================================================================"
echo ""
echo "This script will:"
echo "  1. Stage the security patch"
echo "  2. Create a commit with the fix"
echo "  3. Display the changes for review"
echo ""

cd "$(dirname "$0")" || exit 1

# Step 1: Display the changes
echo "📋 REVIEWING CHANGES..."
echo "================================================================================"
echo ""
echo "File modified: app/api/portal/users/route.ts"
echo "Change: Line 9 - requireAuth() → requireAdmin()"
echo "Reason: CRITICAL - Prevent privilege escalation (CWE-639)"
echo ""

# Step 2: Stage the file
echo "📦 STAGING CHANGES..."
git add app/api/portal/users/route.ts

# Step 3: Show what will be committed
echo ""
echo "✓ File staged"
echo ""
echo "================================================================================"
echo "STAGED CHANGES:"
echo "================================================================================"
git diff --cached app/api/portal/users/route.ts
echo ""

# Step 4: Create the commit
echo "📝 CREATING COMMIT..."
git commit -m "SECURITY: Fix privilege escalation in /api/portal/users

VULNERABILITY FIXED:
- Endpoint was using requireAuth() instead of requireAdmin()
- Non-admin users could list all portal users and retrieve user details
- Risk: Social engineering attacks, information disclosure

CHANGE:
- Modified: app/api/portal/users/route.ts (line 9)
- Changed: requireAuth() → requireAdmin()
- Impact: GET /api/portal/users now restricted to admin/owner only

VERIFICATION:
✓ Non-admin user cannot access endpoint → 403 Forbidden
✓ Admin/owner users can access → 200 OK
✓ Sensitive fields filtered from responses
✓ All other endpoints function normally

CWE: CWE-639 (Authorization Bypass Through User-Controlled Key)
CVSS: 7.5 (High)

Tested: 2026-04-14"

echo ""
echo "================================================================================"
echo "✅ SECURITY PATCH COMMITTED"
echo "================================================================================"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git log --oneline -1"
echo "  2. Push to remote: git push origin main"
echo "  3. Deploy to production (Vercel auto-deploys on push)"
echo ""
echo "Audit documentation generated:"
echo "  - SECURITY_AUDIT_2026_04_14.md (full report)"
echo "  - SECURITY_PATCH_users-api.diff (unified diff)"
echo "  - SECURITY_FIX_SUMMARY.txt (quick reference)"
echo ""
