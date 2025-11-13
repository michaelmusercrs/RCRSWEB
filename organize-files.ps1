# PowerShell Script to Organize River City Roofing Files
# Run this in PowerShell from your project root

Write-Host "==========================================" -ForegroundColor Green
Write-Host "River City Roofing - File Organization" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Get current directory
$projectRoot = Get-Location
Write-Host "Working in: $projectRoot" -ForegroundColor Yellow
Write-Host ""

# Create folders if they don't exist
Write-Host "Creating folder structure..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path "app" -Force | Out-Null
New-Item -ItemType Directory -Path "components" -Force | Out-Null
New-Item -ItemType Directory -Path "components\ui" -Force | Out-Null
New-Item -ItemType Directory -Path "lib" -Force | Out-Null
New-Item -ItemType Directory -Path "public" -Force | Out-Null

# Move files to app folder
Write-Host "Moving app files..." -ForegroundColor Cyan
if (Test-Path "layout.tsx") { Move-Item "layout.tsx" "app\" -Force }
if (Test-Path "page.tsx") { Move-Item "page.tsx" "app\" -Force }
if (Test-Path "globals.css") { Move-Item "globals.css" "app\" -Force }

# Move files to components folder
Write-Host "Moving component files..." -ForegroundColor Cyan
if (Test-Path "Header.tsx") { Move-Item "Header.tsx" "components\" -Force }
if (Test-Path "button.tsx") { Move-Item "button.tsx" "components\ui\" -Force }

# Move files to lib folder
Write-Host "Moving library files..." -ForegroundColor Cyan
if (Test-Path "utils.ts") { Move-Item "utils.ts" "lib\" -Force }

# Move files to public folder
Write-Host "Moving public assets..." -ForegroundColor Cyan
if (Test-Path "logo") { Move-Item "logo" "public\logo.png" -Force }
if (Test-Path "logo.png") { Move-Item "logo.png" "public\" -Force }

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✓ Files organized successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your folder structure is now:" -ForegroundColor Yellow
Write-Host "  app\" -ForegroundColor White
Write-Host "    ├── layout.tsx" -ForegroundColor Gray
Write-Host "    ├── page.tsx" -ForegroundColor Gray
Write-Host "    └── globals.css" -ForegroundColor Gray
Write-Host "  components\" -ForegroundColor White
Write-Host "    ├── Header.tsx" -ForegroundColor Gray
Write-Host "    └── ui\" -ForegroundColor White
Write-Host "        └── button.tsx" -ForegroundColor Gray
Write-Host "  lib\" -ForegroundColor White
Write-Host "    └── utils.ts" -ForegroundColor Gray
Write-Host "  public\" -ForegroundColor White
Write-Host "    └── logo.png" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm install" -ForegroundColor White
Write-Host "2. Run: npm run dev" -ForegroundColor White
Write-Host "3. Open: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
