# KDP Book Maker — Deployment Guide

## What You Need Before Starting

1. **GitHub account** (free): https://github.com
2. **Render account** (free): https://render.com
3. **Anthropic API key** (for text generation): https://console.anthropic.com
4. **OpenAI API key** (for image generation): https://platform.openai.com/api-keys

## Step-by-Step Deployment

### Step 1: Upload to GitHub

1. Go to https://github.com/new
2. Repository name: `kdpbookmaker`
3. Keep it **Public** or **Private**
4. Click **"Create repository"**
5. Click **"uploading an existing file"**
6. Drag ALL files from this folder (server.js, package.json, render.yaml, and the public folder)
7. Click **"Commit changes"**

### Step 2: Deploy on Render

1. Go to https://render.com and login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already done
4. Select the `kdpbookmaker` repository
5. Settings:
   - **Name:** kdpbookmaker
   - **Region:** Choose closest to you
   - **Branch:** main
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
6. Click **"Create Web Service"**

### Step 3: Add Environment Variables

In your Render dashboard, go to your service → **Environment**:

| Key | Value |
|-----|-------|
| `ADMIN_EMAIL` | ilie1980@myyahoo.com |
| `ADMIN_PASSWORD` | (your password) |
| `ANTHROPIC_API_KEY` | sk-ant-... (get from console.anthropic.com) |
| `OPENAI_API_KEY` | sk-... (get from platform.openai.com) |
| `JWT_SECRET` | (click "Generate" or type a random long string) |
| `STRIPE_WEBHOOK_SECRET` | whsec-... (optional, from Stripe dashboard) |

### Step 4: Connect Your Domain

1. In Render → your service → **Settings** → **Custom Domains**
2. Click **"Add Custom Domain"**
3. Enter: `kdpbookmaker.net`
4. Render will show you DNS records to add
5. Go to your domain registrar (where you bought kdpbookmaker.net)
6. Add the DNS records Render tells you
7. Wait 5-30 minutes for DNS propagation
8. Render auto-generates SSL certificate (HTTPS)

## API Cost Estimates

- **Anthropic (Claude)**: ~$0.01-0.05 per book chapter, ~$0.003 per keyword search
- **OpenAI (DALL-E 3)**: ~$0.04-0.08 per image
- **Mandalas & Journals**: FREE (generated programmatically, no API calls)

## Admin Login

After deployment, go to your site and login with:
- Email: ilie1980@myyahoo.com
- Password: (the password you set in ADMIN_PASSWORD)

You will see an **Admin** button in the navigation to manage users and subscriptions.
