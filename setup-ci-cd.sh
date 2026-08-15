#!/bin/bash

# Naviz CI/CD Setup Script
echo "🚀 Setting up CI/CD for Naviz project..."

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI is not installed. Please install it first:"
    echo "https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated with GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Please authenticate with GitHub CLI first:"
    echo "gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is authenticated"

# Get repository information
REPO_NAME=$(gh repo view --json name --jq .name 2>/dev/null)
if [ -z "$REPO_NAME" ]; then
    echo "❌ Not in a GitHub repository. Please run this from your GitHub repo."
    exit 1
fi

echo "📁 Repository: $REPO_NAME"

# Create GitHub secrets
echo "🔐 Setting up GitHub secrets..."

# Function to set secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    echo "Enter value for $secret_name ($secret_description):"
    read -s secret_value

    if [ -z "$secret_value" ]; then
        echo "⚠️  Skipping $secret_name (empty value)"
        return
    fi

    if gh secret set "$secret_name" --body "$secret_value"; then
        echo "✅ Set $secret_name"
    else
        echo "❌ Failed to set $secret_name"
    fi
}

# Required secrets
echo "📝 Please provide the following required secrets:"
set_secret "VERCEL_TOKEN" "Vercel authentication token"
set_secret "VERCEL_ORG_ID" "Vercel organization ID"
set_secret "VERCEL_PROJECT_ID" "Vercel project ID"
set_secret "RAILWAY_TOKEN" "Railway authentication token"
set_secret "SUPABASE_URL" "Supabase project URL"
set_secret "SUPABASE_ANON_KEY" "Supabase anonymous key"
set_secret "CODECOV_TOKEN" "Codecov token for coverage reports"

# Optional secrets
echo "📝 Optional secrets (press Enter to skip):"
set_secret "SLACK_WEBHOOK" "Slack webhook for deployment notifications"
set_secret "HEROKU_API_KEY" "Heroku API key (fallback deployment)"
set_secret "HEROKU_EMAIL" "Heroku account email"

echo "✅ GitHub secrets setup complete!"

# Commit and push changes
echo "💾 Committing CI/CD configuration..."
git add .
git commit -m "feat: Add comprehensive CI/CD pipeline with GitHub Actions

- Add GitHub Actions workflows for CI and deployment
- Configure Vercel deployment for frontend
- Configure Railway deployment for backend
- Add environment-specific configurations
- Add Docker support for containerized deployment
- Update .gitignore for CI/CD artifacts
- Add comprehensive CI/CD documentation"

git push origin main

echo "🎉 CI/CD setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Create a new project on Vercel and import your repository"
echo "2. Create a new project on Railway for backend deployment"
echo "3. Set up your Supabase database and update environment variables"
echo "4. Push to the develop branch to trigger staging deployment"
echo "5. Push to the main branch to trigger production deployment"
echo ""
echo "📖 For detailed instructions, see CI-CD-README.md"
