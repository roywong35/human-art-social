# Deployment Guide 🚀

This guide walks you through deploying the AI Drawing Social platform using Vercel (Frontend), Render (Backend), and AWS S3 (Image Storage).

## 📋 Prerequisites

- GitHub account
- Vercel account (free)
- Render account (free)
- AWS account (free tier)

## 🔧 Environment Setup

### 1. Backend Environment Variables (Render)

In your Render dashboard, set these environment variables:

```bash
# Django Settings
DJANGO_SETTINGS_MODULE=core.settings_prod
DEBUG=False
SECRET_KEY=<generate-secure-random-key>
ALLOWED_HOSTS=<your-render-app-name>.onrender.com

# Frontend URL (update after Vercel deployment)
FRONTEND_URL=https://<your-vercel-app>.vercel.app

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_STORAGE_BUCKET_NAME=<your-s3-bucket-name>
AWS_S3_REGION_NAME=us-east-1
AWS_S3_CUSTOM_DOMAIN=<your-bucket-name>.s3.amazonaws.com
```

### 2. Frontend Environment (Vercel)

Update `frontend/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://<your-render-app-name>.onrender.com'
};
```

## 🗄️ Database Setup

### Render PostgreSQL
1. Create a PostgreSQL database in Render
2. Database URL will be automatically set as `DATABASE_URL` environment variable
3. Initial migrations will run automatically during deployment

## 📁 AWS S3 Setup

### 1. Create S3 Bucket
```bash
# Bucket name: your-app-name-images
# Region: us-east-1 (recommended)
# Public access: Block all public access (we'll use signed URLs)
```

### 2. Create IAM User
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

### 3. Configure CORS
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["https://your-vercel-app.vercel.app"],
        "ExposeHeaders": []
    }
]
```

## 🚀 Deployment Steps

### Phase 1: Backend Deployment (Render)

1. **Connect Repository**
   - Go to Render dashboard
   - Connect your GitHub repository
   - Select the `backend` folder as root directory

2. **Configure Build Settings**
   ```bash
   Build Command: pip install -r requirements.txt
   Start Command: python manage.py migrate && python manage.py collectstatic --noinput && gunicorn core.wsgi:application
   ```

3. **Add Environment Variables**
   - Add all the environment variables listed above
   - Render will auto-generate `DATABASE_URL`

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Note your Render URL: `https://<app-name>.onrender.com`

### Phase 2: Frontend Deployment (Vercel)

1. **Update Environment Configuration**
   - Update `environment.prod.ts` with your Render backend URL

2. **Connect Repository**
   - Go to Vercel dashboard
   - Import your GitHub repository
   - Set root directory to `frontend`

3. **Configure Build Settings**
   ```bash
   Framework Preset: Angular
   Build Command: npm run build
   Output Directory: dist/frontend
   Install Command: npm install
   ```

4. **Deploy**
   - Click "Deploy"
   - Note your Vercel URL: `https://<app-name>.vercel.app`

### Phase 3: Update CORS Configuration

1. **Update Backend Environment**
   - In Render dashboard, update `FRONTEND_URL` with your Vercel URL
   - Redeploy backend

2. **Update S3 CORS**
   - Update S3 bucket CORS with your Vercel URL

## ✅ Post-Deployment Checklist

- [ ] Backend responds at `/api/` endpoints
- [ ] Frontend loads and connects to backend
- [ ] User registration/login works
- [ ] Image uploads work (S3 integration)
- [ ] WebSocket connections work (chat/notifications)
- [ ] All CORS issues resolved

## 🔍 Testing Your Deployment

1. **Backend Health Check**
   ```bash
   curl https://<your-render-app>.onrender.com/api/
   ```

2. **Frontend Access**
   - Visit your Vercel URL
   - Try creating an account
   - Test image upload functionality

3. **WebSocket Testing**
   - Test real-time chat
   - Test notifications

## 💰 Cost Breakdown

### Free Tier Limits
- **Vercel**: Unlimited personal projects
- **Render**: 750 hours/month, 1GB database (30-day expiry)
- **AWS S3**: 5GB storage, 20k GET requests (first 12 months)

### After Free Tier
- **Render**: $7/month for persistent database
- **S3**: ~$1-3/month for light usage
- **Vercel**: Free forever for personal projects

## 🔧 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify `FRONTEND_URL` environment variable
   - Check S3 bucket CORS configuration
   - Ensure all URLs match exactly (no trailing slashes)

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is set correctly
   - Check if migrations ran successfully
   - Review Render deployment logs

3. **S3 Upload Failures**
   - Verify AWS credentials
   - Check bucket permissions
   - Confirm bucket region matches settings

4. **WebSocket Issues**
   - Ensure Redis is configured (Render provides free Redis)
   - Check `CHANNEL_LAYERS` configuration
   - Verify WebSocket URL in frontend

### Useful Commands

```bash
# Check backend logs (Render dashboard)
# Check frontend build logs (Vercel dashboard)

# Test API endpoints
curl -H "Authorization: Bearer <token>" https://<backend-url>/api/posts/

# Check S3 access
aws s3 ls s3://<bucket-name> --profile <your-profile>
```

## 📈 Scaling Considerations

As your app grows:
- **Render**: Upgrade to paid plan for more resources
- **S3**: Consider CloudFront CDN for global image delivery
- **Database**: Monitor usage and upgrade as needed
- **Monitoring**: Add application monitoring (Sentry, etc.)

## 🎯 Success Metrics

Your deployment is successful when:
- ✅ All pages load without errors
- ✅ Users can register and authenticate
- ✅ Image uploads work to S3
- ✅ Real-time features work (chat, notifications)
- ✅ No CORS errors in browser console
- ✅ Mobile responsive design works

---

**Next Steps**: Consider adding monitoring, analytics, and automated testing to your production deployment.

