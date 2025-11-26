# Deployment Guide

## Architecture Overview

School Attendance is deployed as a **monolith** container that includes:

- **FastAPI Backend** - REST API (`/api/v1/*`)
- **Kiosk App** - SPA for attendance kiosks (`/kiosk/`)
- **Teacher PWA** - Progressive Web App for teachers (`/teacher/`)
- **Web App** - Director/Parent dashboard (`/app/`)

Supporting services:
- **PostgreSQL** - Primary database
- **Redis** - Cache + job queue (RQ)
- **MinIO/S3** - Photo storage
- **RQ Worker** - Background job processing
- **Scheduler** - Periodic tasks (no-show alerts, cleanups)

## Quick Start (Development)

```bash
# Create Docker network
docker network create net-dev

# Start all services
docker compose up -d

# Access points:
# - API: http://localhost:8080/api/docs
# - Kiosk: http://localhost:8080/kiosk/
# - Teacher PWA: http://localhost:8080/teacher/
# - Web App: http://localhost:8080/app/
# - MinIO Console: http://localhost:9001
```

## Production Deployment

### 1. Environment Variables

Create a `.env.production` file:

```bash
# Application
APP_ENV=production
APP_NAME=school-attendance

# Security (REQUIRED - Generate secure values!)
SECRET_KEY=<generate-with: openssl rand -hex 32>
DEVICE_API_KEY=<generate-with: openssl rand -hex 32>

# Database
DB_USER=school_attendance
DB_PASSWORD=<strong-password>
DB_NAME=school_attendance

# Redis
REDIS_URL=redis://redis:6379/0

# S3/MinIO Storage
S3_ENDPOINT=https://s3.amazonaws.com  # or MinIO URL
S3_BUCKET=your-attendance-photos-bucket
S3_ACCESS_KEY=<aws-access-key>
S3_SECRET_KEY=<aws-secret-key>
S3_REGION=us-east-1
S3_SECURE=true

# Notifications (optional)
SES_SOURCE_EMAIL=attendance@yourdomain.com
WHATSAPP_ACCESS_TOKEN=<meta-whatsapp-token>
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>
ENABLE_REAL_NOTIFICATIONS=true

# CORS (comma-separated origins)
CORS_ORIGINS=https://yourdomain.com,https://kiosk.yourdomain.com

# Rate Limiting
RATE_LIMIT_DEFAULT=100/minute

# Registry
REGISTRY_USER=your-dockerhub-username
IMAGE_TAG=2025.01.01.0000
```

### 2. Build & Push Image

```bash
# Set environment
export REGISTRY_USER=your-dockerhub-username
export IMAGE_TAG=$(date +%Y.%m.%d.%H%M)

# Build and push
./scripts/build_and_push.sh
```

### 3. Deploy with Docker Compose

```bash
# Load production environment
export $(cat .env.production | xargs)

# Create production network
docker network create net-production

# Deploy (without RQ dashboard)
docker compose up -d postgres redis minio school-attendance worker scheduler

# Verify health
curl http://localhost:8080/healthz
```

### 4. Database Migrations

```bash
# Run migrations inside container
docker exec -it school-attendance-production \
  alembic upgrade head
```

## Service URLs

| Service | Development | Production |
|---------|-------------|------------|
| API Docs | http://localhost:8080/api/docs | https://api.yourdomain.com/api/docs |
| Kiosk App | http://localhost:8080/kiosk/ | https://kiosk.yourdomain.com/ |
| Teacher PWA | http://localhost:8080/teacher/ | https://teacher.yourdomain.com/ |
| Web App | http://localhost:8080/app/ | https://app.yourdomain.com/ |
| Health Check | http://localhost:8080/healthz | https://api.yourdomain.com/healthz |

## Security Configuration

### Rate Limiting

Authentication endpoints are rate-limited:
- Login: 5 requests/minute
- Refresh: 10 requests/minute
- Logout: 10 requests/minute

Global default: 100 requests/minute (configurable via `RATE_LIMIT_DEFAULT`)

### CORS

In production, CORS is restricted to explicitly allowed origins via `CORS_ORIGINS`.
In development, all origins are allowed when `CORS_ORIGINS` is empty.

### Token Management

- Access tokens expire in 15 minutes (configurable)
- Refresh tokens expire in 7 days (configurable)
- Logout endpoint adds refresh token to blacklist
- Blacklist is stored in Redis (falls back to memory)

### Device Authentication

Kiosk devices authenticate via `X-Device-Key` header.
**Important**: Change `DEVICE_API_KEY` from default in production!

## Monitoring

### Health Endpoints

```bash
# Liveness probe
curl http://localhost:8080/healthz

# Readiness (with DB check)
curl http://localhost:8080/health
```

### Logs

```bash
# API logs
docker logs -f school-attendance-production

# Worker logs
docker logs -f school-attendance-worker-production

# Scheduler logs
docker logs -f school-attendance-scheduler-production
```

### RQ Dashboard (Development Only)

```bash
# Enable RQ dashboard
docker compose --profile dev up -d rq-dashboard

# Access at http://localhost:9181
```

## Backup & Recovery

### Database Backup

```bash
# Backup
docker exec school-attendance-postgres-production \
  pg_dump -U school_attendance school_attendance > backup.sql

# Restore
docker exec -i school-attendance-postgres-production \
  psql -U school_attendance school_attendance < backup.sql
```

### S3/MinIO Backup

Photos are stored in the configured S3 bucket. Use AWS CLI or MinIO client for backups:

```bash
# MinIO backup
mc mirror minio/attendance-photos ./backup/photos/
```

## Scaling

### Horizontal Scaling

Workers can be scaled independently:

```bash
docker compose up -d --scale worker=3
```

### Load Balancing

For multiple API instances, use a reverse proxy (nginx, traefik) with:
- Session affinity (sticky sessions) for WebSocket connections
- Health check on `/healthz`

## Troubleshooting

### Common Issues

1. **"Token revocado" error**
   - User was logged out or token was blacklisted
   - Solution: Re-authenticate

2. **Rate limit exceeded (429)**
   - Too many requests from same IP
   - Wait 1 minute and retry

3. **CORS errors**
   - Check `CORS_ORIGINS` includes your frontend domain
   - Ensure protocol (http/https) matches

4. **Database connection errors**
   - Verify PostgreSQL is healthy: `docker exec postgres pg_isready`
   - Check `DATABASE_URL` format

5. **Photos not uploading**
   - Verify S3/MinIO credentials
   - Check bucket exists and has write permissions
   - Verify `S3_SECURE` matches endpoint protocol
