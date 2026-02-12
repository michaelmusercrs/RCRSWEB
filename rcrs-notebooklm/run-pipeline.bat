@echo off
echo ============================================================
echo RCRS NotebookLM Content Generation Pipeline
echo ============================================================
echo.

set NOTEBOOKLM_CLI=C:\Users\Michael\AppData\Local\Programs\Python\Python314\Scripts\notebooklm.exe
set PY=py

echo [Step 1] Checking authentication...
"%NOTEBOOKLM_CLI%" auth check
if errorlevel 1 (
    echo.
    echo Not authenticated. Running login...
    "%NOTEBOOKLM_CLI%" login
    if errorlevel 1 (
        echo Login failed. Please try again.
        pause
        exit /b 1
    )
)

echo.
echo [Step 2] Generating NotebookLM content...
echo This will take 30-60 minutes. Progress is saved automatically.
echo.
%PY% "%~dp0generate_notebooks.py" %*
if errorlevel 1 (
    echo.
    echo Content generation had errors. Check output above.
    echo You can re-run with: run-pipeline.bat --notebook [name]
    pause
    exit /b 1
)

echo.
echo [Step 3] Syncing to web portal...
%PY% "%~dp0sync_to_portal.py"

echo.
echo ============================================================
echo PIPELINE COMPLETE
echo ============================================================
echo.
echo Next steps:
echo   1. Check generated content in: rcrs-notebooklm\output\
echo   2. View in portal: http://localhost:3000/portal/training/library
echo   3. Deploy: npx vercel --prod
echo.
pause
