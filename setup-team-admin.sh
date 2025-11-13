#!/bin/bash

# Team Admin Dashboard - Quick Setup Script
# Run this to ensure all directories and files are in place

echo "🚀 Setting up Team Admin Dashboard..."

# 1. Create necessary directories
echo "📁 Creating directories..."
mkdir -p data
mkdir -p public/uploads
mkdir -p app/api/admin/team-members/[slug]
mkdir -p app/admin/team

echo "✅ Directories created"

# 2. Verify files exist
echo ""
echo "📋 Checking required files..."

FILES=(
  "app/api/admin/team-members/route.ts"
  "app/api/admin/team-members/[slug]/route.ts"
  "app/admin/team/page.tsx"
  "app/admin/team/TeamManageClient.tsx"
  "lib/teamData.ts"
)

ALL_GOOD=true
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ MISSING: $file"
    ALL_GOOD=false
  fi
done

echo ""

if [ "$ALL_GOOD" = true ]; then
  echo "🎉 All files present!"
  echo ""
  echo "📝 Next steps:"
  echo "1. Run: npm run dev"
  echo "2. Go to: http://localhost:3000/admin/team"
  echo "3. Login with admin password (default: admin123)"
  echo "4. Start managing your team!"
else
  echo "❌ Some files are missing. Please check above."
  exit 1
fi
