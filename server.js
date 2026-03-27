/* ═══════════════════════════════════════════════════
   KDP BOOK MAKER — Node.js Backend Server
   Professional Book Publishing Platform
   ═══════════════════════════════════════════════════ */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Config ───
const JWT_SECRET = process.env.JWT_SECRET || 'kdp-book-maker-dev-secret-change-in-production';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// ─── Middleware ───
// Stripe webhook needs raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Simple User Store (JSON file) ───
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    // Create admin user automatically
    const adminUser = {
      email: ADMIN_EMAIL,
      password: hashPassword(ADMIN_PASSWORD),
      name: 'Admin',
      role: 'admin',
      subscription: 'pro',
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2));
    console.log('Admin user created:', ADMIN_EMAIL);
  }
}

function getUsers() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findUser(email) {
  return getUsers().find(u => u.email === email.toLowerCase().trim());
}

function updateUser(email, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.email === email.toLowerCase().trim());
  if (idx >= 0) {
    Object.assign(users[idx], updates);
    saveUsers(users);
    return users[idx];
  }
  return null;
}

// ─── Password Hashing (Node.js crypto, no external deps) ───
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const parts = stored.split(':');
  const salt = parts[0];
  const hash = parts[1];
  const test = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === test;
}

// ─── JWT ───
function createToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role, subscription: user.subscription },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Refresh subscription status from DB
    const freshUser = findUser(decoded.email);
    if (freshUser) {
      decoded.subscription = freshUser.subscription;
      decoded.role = freshUser.role;
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function subscribedMiddleware(req, res, next) {
  if (req.user.subscription === 'free' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Active subscription required. Please choose a plan.' });
  }
  next();
}

// ════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = findUser(normalizedEmail);
  if (existing) {
    return res.status(400).json({ error: 'This email is already registered. Try logging in.' });
  }

  const user = {
    email: normalizedEmail,
    password: hashPassword(password),
    name: (name || '').trim(),
    role: normalizedEmail === ADMIN_EMAIL ? 'admin' : 'user',
    subscription: normalizedEmail === ADMIN_EMAIL ? 'pro' : 'free',
    createdAt: new Date().toISOString()
  };

  const users = getUsers();
  users.push(user);
  saveUsers(users);

  const token = createToken(user);
  res.json({
    token,
    user: { email: user.email, name: user.name, role: user.role, subscription: user.subscription }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = findUser(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createToken(user);
  res.json({
    token,
    user: { email: user.email, name: user.name, role: user.role, subscription: user.subscription }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = findUser(req.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: { email: user.email, name: user.name, role: user.role, subscription: user.subscription }
  });
});

// ════════════════════════════════════════
// AI GENERATION ROUTES
// ════════════════════════════════════════

// ── Text generation (non-streaming) ──
app.post('/api/generate/text', authMiddleware, subscribedMiddleware, async (req, res) => {
  const { prompt, maxTokens } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Text generation is not configured. Admin must add ANTHROPIC_API_KEY.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens || 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'API call failed with status ' + response.status);
    }

    const data = await response.json();
    const text = data.content && data.content[0] ? data.content[0].text : '';
    res.json({ content: text });
  } catch (error) {
    console.error('Text generation error:', error.message);
    res.status(500).json({ error: 'Text generation failed: ' + error.message });
  }
});

// ── Text generation (streaming via SSE) ──
app.post('/api/generate/text-stream', authMiddleware, subscribedMiddleware, async (req, res) => {
  const { prompt, maxTokens } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Text generation is not configured.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens || 4096,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.write('data: ' + JSON.stringify({ error: err.error?.message || 'API error' }) + '\n\n');
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
              fullText += event.delta.text;
              res.write('data: ' + JSON.stringify({ text: event.delta.text, partial: fullText }) + '\n\n');
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }

    res.write('data: ' + JSON.stringify({ done: true, text: fullText }) + '\n\n');
    res.end();
  } catch (error) {
    console.error('Stream error:', error.message);
    res.write('data: ' + JSON.stringify({ error: error.message }) + '\n\n');
    res.end();
  }
});

// ── Image generation ──
app.post('/api/generate/image', authMiddleware, subscribedMiddleware, async (req, res) => {
  const { prompt, size, quality } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Image generation is not configured. Admin must add OPENAI_API_KEY.' });
  }

  // Map aspect-like requests to DALL-E 3 sizes
  // DALL-E 3 supports: 1024x1024, 1024x1792, 1792x1024
  let dalleSize = '1024x1024';
  if (size === 'portrait' || size === '3:4' || size === '9:16') dalleSize = '1024x1792';
  else if (size === 'landscape' || size === '4:3' || size === '16:9') dalleSize = '1792x1024';
  else if (size === 'square' || size === '1:1') dalleSize = '1024x1024';

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: dalleSize,
        quality: quality || 'standard',
        response_format: 'url'
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Image API error');
    }

    const data = await response.json();
    const urls = data.data ? data.data.map(d => d.url) : [];
    res.json({ urls });
  } catch (error) {
    console.error('Image generation error:', error.message);
    res.status(500).json({ error: 'Image generation failed: ' + error.message });
  }
});

// ── Proxy image (for CORS - DALL-E URLs expire) ──
app.get('/api/proxy-image', authMiddleware, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Fetch failed');
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// ════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = getUsers().map(u => ({
    email: u.email,
    name: u.name,
    role: u.role,
    subscription: u.subscription,
    createdAt: u.createdAt
  }));
  res.json({ users });
});

app.post('/api/admin/users/:email/subscription', authMiddleware, adminMiddleware, (req, res) => {
  const { subscription } = req.body;
  const email = decodeURIComponent(req.params.email);
  if (!['free', 'basic', 'pro'].includes(subscription)) {
    return res.status(400).json({ error: 'Invalid subscription type' });
  }
  const user = updateUser(email, { subscription });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user: { email: user.email, subscription: user.subscription } });
});

app.delete('/api/admin/users/:email', authMiddleware, adminMiddleware, (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase().trim();
  if (email === ADMIN_EMAIL) {
    return res.status(400).json({ error: 'Cannot delete admin account' });
  }
  const users = getUsers().filter(u => u.email !== email);
  saveUsers(users);
  res.json({ success: true });
});

// ════════════════════════════════════════
// STRIPE WEBHOOK
// ════════════════════════════════════════

async function handleStripeWebhook(req, res) {
  let event;

  if (STRIPE_WEBHOOK_SECRET) {
    const stripe = require('stripe')(STRIPE_WEBHOOK_SECRET);
    const sig = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }
  } else {
    // No webhook secret configured, parse manually
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  // Handle subscription events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = (session.customer_email || session.client_reference_id || '').toLowerCase().trim();
    if (customerEmail) {
      // Determine plan from amount
      const amount = session.amount_total;
      let plan = 'basic';
      if (amount >= 24900) plan = 'pro'; // $249 annual
      else if (amount >= 4900) plan = 'pro'; // $49 monthly

      const user = updateUser(customerEmail, { subscription: plan });
      if (user) {
        console.log('Subscription activated for', customerEmail, ':', plan);
      } else {
        console.log('Webhook: user not found for email', customerEmail);
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerEmail = (subscription.metadata?.email || '').toLowerCase().trim();
    if (customerEmail) {
      updateUser(customerEmail, { subscription: 'free' });
      console.log('Subscription cancelled for', customerEmail);
    }
  }

  res.json({ received: true });
}

// ─── Catch-all: serve frontend ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ───
ensureDataDir();
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  KDP Book Maker running on port ' + PORT);
  console.log('═══════════════════════════════════════');
  console.log('  Admin email: ' + ADMIN_EMAIL);
  console.log('  Anthropic API: ' + (ANTHROPIC_API_KEY ? 'Configured' : 'NOT SET'));
  console.log('  OpenAI API:    ' + (OPENAI_API_KEY ? 'Configured' : 'NOT SET'));
  console.log('  Stripe:        ' + (STRIPE_WEBHOOK_SECRET ? 'Configured' : 'NOT SET'));
  console.log('═══════════════════════════════════════');
});
