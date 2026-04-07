# Deployment Guide

This guide covers various deployment options for the BAF system.

## Deployment Options

### 1. Vercel (Recommended)

Vercel provides the easiest deployment experience for Next.js applications.

#### Prerequisites

- Vercel account
- Connected GitHub repository
- Environment variables configured

#### Steps

1. **Import Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Environment Variables**
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   OPENAI_API_KEY
   YOUTUBE_API_KEY
   TWITCH_CLIENT_ID
   TWITCH_CLIENT_SECRET
   ```

3. **Deploy**
   - Vercel automatically deploys on push to master
   - Preview deployments for pull requests

#### Environment Variables

```bash
# Production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_key
YOUTUBE_API_KEY=your_youtube_key
TWITCH_CLIENT_ID=your_twitch_id
TWITCH_CLIENT_SECRET=your_twitch_secret
```

### 2. Docker Deployment

Deploy using Docker containers for maximum portability.

#### Dockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

#### Deployment Commands

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale up
docker-compose up -d --scale app=3
```

### 3. AWS Deployment

Deploy to AWS using ECS or Elastic Beanstalk.

#### ECS Deployment

1. **Create ECR Repository**
   ```bash
   aws ecr create-repository --repository-name boredaf
   ```

2. **Build and Push Image**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
   
   docker build -t boredaf .
   docker tag boredaf:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/boredaf:latest
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/boredaf:latest
   ```

3. **Create ECS Task Definition**
   ```json
   {
     "family": "boredaf",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512",
     "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
     "containerDefinitions": [
       {
         "name": "boredaf",
         "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/boredaf:latest",
         "portMappings": [
           {
             "containerPort": 3000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "NODE_ENV",
             "value": "production"
           }
         ],
         "secrets": [
           {
             "name": "OPENAI_API_KEY",
             "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:boredaf/openai-key"
           }
         ]
       }
     ]
   }
   ```

4. **Create Service**
   ```bash
   aws ecs create-service \
     --cluster boredaf-cluster \
     --service-name boredaf-service \
     --task-definition boredaf \
     --desired-count 2 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
   ```

### 4. DigitalOcean App Platform

Deploy to DigitalOcean's managed platform.

#### App Spec

```yaml
name: boredaf
services:
- name: web
  source_dir: /
  github:
    repo: andreeeiii/BoredAF
    branch: master
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: NODE_ENV
    value: production
  - key: NEXT_PUBLIC_SUPABASE_URL
    value: ${SUPABASE_URL}
  - key: OPENAI_API_KEY
    value: ${OPENAI_API_KEY}
  http_port: 3000
  routes:
  - path: /
```

## Environment Configuration

### Production Environment Variables

```bash
# Required
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key

# Optional but recommended
REDIS_URL=redis://user:pass@host:port
YOUTUBE_API_KEY=your_youtube_api_key
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn
ANALYTICS_API_KEY=your_analytics_key

# Performance
ENABLE_CACHE=true
CACHE_TTL=300
MAX_CONCURRENT_REQUESTS=100
```

### Database Configuration

#### Supabase Production

1. **Enable Row Level Security**
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
   ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
   ```

2. **Create Production Policies**
   ```sql
   -- Users can only access their own data
   CREATE POLICY "Users can view own profile" ON users
     FOR SELECT USING (auth.uid() = id);
   
   CREATE POLICY "Users can update own profile" ON users
     FOR UPDATE USING (auth.uid() = id);
   ```

3. **Set Up Backups**
   - Enable daily backups in Supabase dashboard
   - Configure point-in-time recovery
   - Set up backup retention policies

#### PostgreSQL Self-Hosted

```sql
-- Production optimizations
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Reload configuration
SELECT pg_reload_conf();
```

## Performance Optimization

### Caching Strategy

#### Redis Configuration

```bash
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

#### Application Caching

```typescript
// Cache configuration
const cacheConfig = {
  userPersona: { ttl: 300 },      // 5 minutes
  contentSearch: { ttl: 1800 },   // 30 minutes
  apiResponses: { ttl: 600 },     // 10 minutes
  embeddings: { ttl: 3600 }       // 1 hour
};
```

### CDN Configuration

#### Vercel Edge Network

```javascript
// next.config.js
module.exports = {
  experimental: {
    serverComponentsExternalPackages: ['pgvector']
  },
  images: {
    domains: ['your-cdn-domain.com'],
    loader: 'custom'
  },
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300'
          }
        ]
      }
    ];
  }
};
```

### Load Balancing

#### Nginx Configuration

```nginx
upstream boredaf {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name boredaf.com;

    location / {
        proxy_pass http://boredaf;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_cache api_cache;
        proxy_pass http://boredaf;
        proxy_cache_valid 200 5m;
    }
}
```

## Monitoring & Logging

### Application Monitoring

#### Sentry Integration

```typescript
// sentry.client.config.js
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
});
```

#### Custom Metrics

```typescript
// lib/monitoring.ts
export class Metrics {
  static trackBAFRequest(userId: string, responseTime: number) {
    // Track custom metrics
    fetch('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({
        event: 'baf_requested',
        userId,
        responseTime,
        timestamp: new Date().toISOString()
      })
    });
  }

  static trackError(error: Error, context: any) {
    // Track errors
    console.error('Application Error:', error, context);
  }
}
```

### Log Management

#### Structured Logging

```typescript
// lib/logger.ts
export class Logger {
  static info(message: string, meta?: any) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      meta,
      timestamp: new Date().toISOString()
    }));
  }

  static error(message: string, error?: Error, meta?: any) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.stack,
      meta,
      timestamp: new Date().toISOString()
    }));
  }
}
```

## Security

### HTTPS Configuration

#### SSL Certificate

```bash
# Let's Encrypt
certbot --nginx -d boredaf.com -d www.boredaf.com

# Auto-renewal
crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

#### Security Headers

```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ];
  }
};
```

### API Security

#### Rate Limiting

```typescript
// middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
```

#### Input Validation

```typescript
// lib/validation.ts
import { z } from 'zod';

export const bafRequestSchema = z.object({
  action: z.enum(['baf']),
  context: z.object({
    mood: z.string().optional(),
    location: z.string().optional(),
    timeOfDay: z.string().optional(),
    preferences: z.array(z.string()).optional()
  }).optional()
});
```

## Backup & Disaster Recovery

### Database Backups

#### Automated Backups

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/boredaf"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compress
gzip $BACKUP_DIR/backup_$DATE.sql

# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://boredaf-backups/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

#### Restore Procedure

```bash
# Restore from backup
gunzip -c backup_20240325_120000.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Verify restore
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM users;"
```

### Application Rollback

#### Git Rollback

```bash
# Rollback to previous commit
git log --oneline -10
git revert <commit-hash>
git push origin master
```

#### Database Migration Rollback

```bash
# Rollback migration
npm run db:rollback
```

## Troubleshooting

### Common Issues

#### "Out of Memory" Errors

```bash
# Check memory usage
free -h
docker stats

# Increase memory allocation
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### "Database Connection Failed"

```bash
# Check connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Check connection pool
SELECT * FROM pg_stat_activity WHERE datname = 'boredaf';
```

#### "API Rate Limit Exceeded"

```bash
# Check current usage
curl -H "Authorization: Bearer $TOKEN" \
  https://api.openai.com/v1/usage

# Implement exponential backoff
const retryWithBackoff = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};
```

### Health Checks

#### Application Health

```typescript
// pages/api/health.ts
export default async function handler(req, res) {
  try {
    // Check database
    const { data, error } = await supabase.from('users').select('count').single();
    
    // Check external APIs
    const openaiHealth = await fetch('https://api.openai.com/v1/models');
    
    res.status(200).json({
      status: 'healthy',
      database: error ? 'error' : 'healthy',
      openai: openaiHealth.ok ? 'healthy' : 'error',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
}
```

---

For more deployment options, check the [Vercel Documentation](https://vercel.com/docs) or [AWS Deployment Guide](https://docs.aws.amazon.com/).
