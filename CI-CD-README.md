# CI/CD & Deployment Guide

This document provides instructions for setting up and managing the CI/CD pipeline for the Naviz project.

## Overview

The project uses:
- **GitHub Actions** for continuous integration and deployment
- **Vercel** for frontend hosting
- **Railway** for backend hosting (with Heroku as fallback)
- **Docker** for containerized deployments
- **Environment-specific configurations** for staging and production

## Prerequisites

1. **GitHub Repository**: Ensure your code is in a GitHub repository
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Railway Account**: Sign up at [railway.app](https://railway.app)
4. **Supabase Project**: Set up your database at [supabase.com](https://supabase.com)

## Environment Setup

### 1. Environment Variables

Copy the appropriate environment file:

```bash
# For local development
cp .env.example .env.local

# For staging
cp .env.staging .env.staging.local

# For production
cp .env.production .env.production.local
```

### 2. GitHub Secrets

Add the following secrets to your GitHub repository:

#### Required Secrets:
- `VERCEL_TOKEN`: Vercel authentication token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID
- `RAILWAY_TOKEN`: Railway authentication token
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `CODECOV_TOKEN`: Codecov token for coverage reports

#### Optional Secrets:
- `SLACK_WEBHOOK`: Slack webhook for deployment notifications
- `HEROKU_API_KEY`: Heroku API key (fallback deployment)
- `HEROKU_EMAIL`: Heroku account email

### 3. Vercel Configuration

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy to Vercel:
```bash
vercel --prod
```

### 4. Railway Configuration

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Create a new project:
```bash
railway init
```

4. Add environment variables:
```bash
railway variables set NODE_ENV=production
railway variables set PORT=3001
```

## CI/CD Pipeline

### Workflows

#### 1. CI Pipeline (`.github/workflows/ci.yml`)
- **Triggers**: Push to `main`/`develop`, Pull requests
- **Node.js Versions**: 18.x, 20.x
- **Steps**:
  - Install dependencies
  - Run linting
  - Execute unit tests with coverage
  - Run integration tests
  - Build frontend
  - Test backend server startup
  - Upload coverage reports
  - Run E2E tests (on Node 20.x)

#### 2. Deployment Pipeline (`.github/workflows/deploy.yml`)
- **Triggers**: Push to `main`/`develop`, tags, manual trigger
- **Environments**: Staging, Production
- **Steps**:
  - Deploy frontend to Vercel
  - Deploy backend to Railway
  - Send deployment notifications

### Manual Deployment

You can manually trigger deployments using GitHub Actions:

1. Go to your repository's Actions tab
2. Select "Deploy to Staging and Production" workflow
3. Click "Run workflow"
4. Choose the environment (staging/production)

## Environment Configurations

### Development
- **Branch**: `develop`
- **URL**: `https://naviz-dev.vercel.app`
- **Backend**: `https://naviz-backend-staging.up.railway.app`
- **Database**: Staging Supabase instance

### Production
- **Branch**: `main`
- **URL**: `https://naviz.vercel.app`
- **Backend**: `https://naviz-backend-prod.up.railway.app`
- **Database**: Production Supabase instance

## Docker Deployment

### Local Development
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down
```

### Production Deployment
```bash
# Build and push images
docker build -f Dockerfile -t naviz-backend ./server
docker build -f Dockerfile.frontend -t naviz-frontend .

# Run containers
docker run -p 3001:3001 naviz-backend
docker run -p 80:80 naviz-frontend
```

## Monitoring and Troubleshooting

### CI/CD Status
- Check GitHub Actions tab for pipeline status
- View deployment logs in Vercel and Railway dashboards
- Monitor application logs in production

### Common Issues

1. **Build Failures**:
   - Check Node.js version compatibility
   - Verify environment variables are set
   - Review build logs in GitHub Actions

2. **Deployment Failures**:
   - Verify Vercel and Railway tokens are valid
   - Check project IDs and organization IDs
   - Ensure environment variables are properly configured

3. **Runtime Errors**:
   - Check application logs in Vercel/Railway
   - Verify database connections
   - Test API endpoints

### Performance Monitoring
- Use Vercel Analytics for frontend performance
- Monitor Railway metrics for backend performance
- Set up error tracking with Sentry or similar service

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to version control
2. **Secrets Management**: Use GitHub Secrets for all sensitive configuration
3. **Access Control**: Configure proper permissions for production environments
4. **HTTPS**: Ensure all communications use HTTPS in production

## Support

For issues with:
- **CI/CD Pipeline**: Check GitHub Actions logs
- **Vercel Deployment**: Visit Vercel dashboard
- **Railway Deployment**: Check Railway project settings
- **Application Issues**: Review application logs

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Docker Documentation](https://docs.docker.com)
