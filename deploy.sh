#!/bin/bash
# Run this on your DigitalOcean droplet as root
# Commands to deploy the HeyGen-parity dashboard update

cd /var/www/chitraai

# 1. Pull latest code from GitHub
git pull origin main

# 2. Build and restart backend
cd backend
npm install
npm run build
pm2 restart chitra-backend

# 3. Build frontend
cd ../frontend
npm install
npm run build

# 4. Restart frontend
pm2 restart chitra-frontend

echo "=== DEPLOYMENT COMPLETE ==="
pm2 status
