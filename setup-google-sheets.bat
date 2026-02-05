@echo off
REM Google Sheets API Setup Script for Windows
REM Run this in Command Prompt or PowerShell

echo Setting up Google Sheets API...

SET PROJECT_ID=river-city-roofing
SET SERVICE_ACCOUNT_NAME=sheets-access

echo Creating Google Cloud project...
gcloud projects create %PROJECT_ID% --name="River City Roofing"

echo Setting project as active...
gcloud config set project %PROJECT_ID%

echo.
echo IMPORTANT: Enable billing at console.cloud.google.com
echo Press any key after enabling billing...
pause

echo Enabling Google Sheets API...
gcloud services enable sheets.googleapis.com

echo Creating service account...
gcloud iam service-accounts create %SERVICE_ACCOUNT_NAME% --display-name="Sheets Access Account"

SET SERVICE_ACCOUNT_EMAIL=%SERVICE_ACCOUNT_NAME%@%PROJECT_ID%.iam.gserviceaccount.com

echo Creating service account key...
gcloud iam service-accounts keys create credentials.json --iam-account=%SERVICE_ACCOUNT_EMAIL%

echo.
echo Setup complete!
echo.
echo NEXT STEP: Share your Google Sheet with this email:
echo %SERVICE_ACCOUNT_EMAIL%
echo.
echo 1. Open your Google Sheet
echo 2. Click Share button
echo 3. Paste the email above
echo 4. Give it Editor access
echo.
echo Then run: node extract-credentials.js
pause
