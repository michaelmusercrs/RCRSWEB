#!/bin/bash

# Google Sheets API Setup Script
# Run this to set up your Google Cloud credentials automatically

echo "🚀 Setting up Google Sheets API..."

# Set your project ID (change this to your project name)
PROJECT_ID="river-city-roofing"

# Create new project
echo "📦 Creating Google Cloud project..."
gcloud projects create $PROJECT_ID --name="River City Roofing"

# Set the project as active
gcloud config set project $PROJECT_ID

# Enable billing (you need to do this manually in console first time)
echo "⚠️  IMPORTANT: You need to enable billing at console.cloud.google.com"
echo "Press enter after you've enabled billing..."
read

# Enable Google Sheets API
echo "🔧 Enabling Google Sheets API..."
gcloud services enable sheets.googleapis.com

# Create service account
echo "👤 Creating service account..."
SERVICE_ACCOUNT_NAME="sheets-access"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Sheets Access Account"

# Create and download key
echo "🔑 Creating service account key..."
gcloud iam service-accounts keys create credentials.json \
    --iam-account=$SERVICE_ACCOUNT_EMAIL

# Extract the private key and email
echo "📋 Extracting credentials..."
PRIVATE_KEY=$(cat credentials.json | grep private_key | cut -d '"' -f 4)
SERVICE_EMAIL=$(cat credentials.json | grep client_email | cut -d '"' -f 4)

# Create .env.local file
echo "📝 Creating .env.local file..."
cat > .env.local << EOF
GOOGLE_SHEETS_ID=1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s
GOOGLE_SERVICE_ACCOUNT_EMAIL=$SERVICE_EMAIL
GOOGLE_PRIVATE_KEY="$PRIVATE_KEY"
EOF

echo "✅ Setup complete!"
echo ""
echo "🎯 NEXT STEP: Share your Google Sheet with this email:"
echo "   $SERVICE_EMAIL"
echo ""
echo "   1. Open your Google Sheet"
echo "   2. Click 'Share' button"
echo "   3. Paste this email: $SERVICE_EMAIL"
echo "   4. Give it 'Editor' access"
echo ""
echo "📄 Your .env.local file has been created with your credentials"
