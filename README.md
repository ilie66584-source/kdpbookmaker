# KDP Book Maker — Deployment Guide

## What You Need Before Starting

1. **GitHub account** (free): https://github.com
2. **Render account** (free): https://render.com
3. **Anthropic API key** (for text generation): https://console.anthropic.com
4. **OpenAI API key** (for image generation): https://platform.openai.com/api-keys
5. **Stripe account** (for payments): https://dashboard.stripe.com

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
| `JWT_SECRET` | (click "Generate" or type a random long string) |
| `ANTHROPIC_API_KEY` | (your Anthropic API key from console.anthropic.com) |
| `OPENAI_API_KEY` | (your OpenAI API key from platform.openai.com) |
| `STRIPE_SECRET_KEY` | (your Stripe secret key from dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | (optional - from Stripe webhook settings) |

### Step 4: Connect Your Domain

1. In Render → your service → **Settings** → **Custom Domains**
2. Click **"Add Custom Domain"**
3. Enter: `www.kdpbookmaker.net`
4. Add DNS records at your domain registrar:
   - **CNAME**: `www` → `kdpbookmaker.onrender.com`
   - **URL Redirect**: `@` → `https://www.kdpbookmaker.net`
   - **A Record**: `@` → `216.24.57.1`
5. Wait 5-30 minutes for DNS propagation
6. Render auto-generates SSL certificate (HTTPS)

## Subscription Plans

| Plan | Price | Limits |
|------|-------|--------|
| **KDP Bookmaker — Base** | $29/month | 10 text books (100pg max), 5 coloring books (50pg max), 10 covers, 20 keywords |
| **KDP Bookmaker — Pro** | $49/month | 30 text books (500pg max), 15 coloring books (150pg max), 30 covers, unlimited keywords |
| **KDP Bookmaker — Pro Annuale** | $349/year | Same as Pro, save $239/year |

All plans include unlimited mandalas & journals (no API costs).

## API Cost Estimates

- **Anthropic (Claude)**: ~$0.01-0.05 per book chapter, ~$0.003 per keyword search
- **OpenAI (DALL-E 3)**: ~$0.04-0.08 per image
- **Mandalas & Journals**: FREE (generated programmatically, no API calls)

## Admin Login

After deployment, go to your site and login with:
- Email: ilie1980@myyahoo.com
- Password: (the password you set in ADMIN_PASSWORD)

You will see an **Admin** button in the navigation to manage users and subscriptions.
