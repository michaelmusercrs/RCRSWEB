@echo off
echo ==========================================
echo   Building River from Modelfile...
echo ==========================================
echo.
cd /d "%~dp0"
ollama create river -f Modelfile
echo.
echo Done! Run start-river.bat to begin.
pause
