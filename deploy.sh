#!/bin/bash
# Run this on your DigitalOcean droplet as root
# Commands to deploy the HeyGen-parity dashboard update

cd /var/www/ugc-video

# 1. Pull latest code from GitHub
git pull origin main

# 2. Build and restart backend
cd backend
npm install
npm run build
pm2 restart all

# 3. Build frontend
cd ../frontend
npm install
npm run build

# 4. Restart frontend (if using pm2 for Next.js)
pm2 restart frontend 2>/dev/null || pm2 start "npm run start" --name frontend --cwd /var/www/ugc-video/frontend

echo "=== DEPLOYMENT COMPLETE ==="
pm2 status
