@echo off
REM Back up both the master Google Sheet and Monday Meeting Numbers sheet
cd /d "%~dp0.."
node scripts/backup-sheets.js all
