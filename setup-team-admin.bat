@echo off
REM Team Admin Dashboard - Quick Setup Script (Windows)
REM Run this to ensure all directories and files are in place

echo.
echo ========================================
echo Team Admin Dashboard - Quick Setup
echo ========================================
echo.

REM Create necessary directories
echo Creating directories...
if not exist "data" mkdir data
if not exist "public\uploads" mkdir "public\uploads"
if not exist "app\api\admin\team-members\[slug]" mkdir "app\api\admin\team-members\[slug]"
if not exist "app\admin\team" mkdir "app\admin\team"

echo [OK] Directories created
echo.

REM Check for required files
echo Checking required files...
set ALL_GOOD=1

if exist "app\api\admin\team-members\route.ts" (
    echo [OK] app\api\admin\team-members\route.ts
) else (
    echo [MISSING] app\api\admin\team-members\route.ts
    set ALL_GOOD=0
)

if exist "app\api\admin\team-members\[slug]\route.ts" (
    echo [OK] app\api\admin\team-members\[slug]\route.ts
) else (
    echo [MISSING] app\api\admin\team-members\[slug]\route.ts
    set ALL_GOOD=0
)

if exist "app\admin\team\page.tsx" (
    echo [OK] app\admin\team\page.tsx
) else (
    echo [MISSING] app\admin\team\page.tsx
    set ALL_GOOD=0
)

if exist "app\admin\team\TeamManageClient.tsx" (
    echo [OK] app\admin\team\TeamManageClient.tsx
) else (
    echo [MISSING] app\admin\team\TeamManageClient.tsx
    set ALL_GOOD=0
)

if exist "lib\teamData.ts" (
    echo [OK] lib\teamData.ts
) else (
    echo [MISSING] lib\teamData.ts
    set ALL_GOOD=0
)

echo.

if %ALL_GOOD%==1 (
    echo ========================================
    echo All files present! You're ready to go!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Run: npm run dev
    echo 2. Open: http://localhost:3000/admin/team
    echo 3. Login: admin123 (or your custom password)
    echo 4. Start managing your team!
    echo.
) else (
    echo ========================================
    echo ERROR: Some files are missing!
    echo ========================================
    echo Please check above and create missing files.
    pause
    exit /b 1
)

pause
