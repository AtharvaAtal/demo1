# MaheshwariSales — Luxury Hardware E-Commerce

A full-stack luxury hardware storefront built with vanilla HTML/CSS/JS and Supabase as the backend. No build tools, no frameworks — just clean, fast, production-ready code.

---

## Project Structure

```
maheshwarisales/
├── index.html              # Homepage with hero, categories, featured products
├── products.html           # Product listing with filters, search, cart drawer
├── gallery.html            # Masonry photo gallery with lightbox
├── admin.html              # Protected admin dashboard (CRUD)
├── login.html              # Admin login (Supabase Auth)
├── styles.css              # Global dark luxury theme
├── cart.js                 # Shared cart utility
├── sync.js                 # Inventory sync from external API
├── sync-edge-function.ts   # Supabase Edge Function (scheduled sync)
├── schema.sql              # Supabase table schema
├── seed.sql                # 50 product seed data
└── README.md               # This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS (ES Modules) |
| Styling | Tailwind CSS (CDN) + custom CSS |
| Backend | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Fonts | Google Fonts (Cormorant Garamond + Jost) |
| Deployment | Vercel or Netlify (static) |

---

## Supabase Setup

### Step 1 — Create Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `MaheshwariSales`
3. Region: `Southeast Asia (Singapore)`
4. Save your database password

### Step 2 — Run Schema
In **SQL Editor → New Query**, paste and run `schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS products (
  id          INT8        PRIMARY KEY,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  price       NUMERIC     NOT NULL,
  description TEXT,
  image_url   TEXT,
  stock       INT4        DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON products FOR SELECT USING (true);
CREATE POLICY "Admin full access" ON products FOR ALL USING (auth.role() = 'authenticated');
```

### Step 3 — Seed Products
Run `seed.sql` in SQL Editor to insert all 50 products.

### Step 4 — Get API Keys
Go to **Settings → API** and copy:
- `Project URL` → `https://xxxx.supabase.co`
- `anon/public key` → `eyJ...`

These are already embedded in the HTML files. For production, use environment variables (see below).

### Step 5 — Create Admin User
Go to **Authentication → Users → Add User**:
- Email: `admin@maheshwarisales.com`
- Password: (your secure password)

### Step 6 — Create Storage Bucket (for image uploads)
Go to **Storage → New Bucket**:
- Name: `products`
- Public: ✅ Yes

### Step 7 — Create sync_logs Table (optional)
```sql
CREATE TABLE IF NOT EXISTS sync_logs (
  id              BIGSERIAL PRIMARY KEY,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  total_products  INT,
  added           INT DEFAULT 0,
  updated         INT DEFAULT 0,
  deleted         INT DEFAULT 0,
  failed          INT DEFAULT 0,
  source_url      TEXT
);
```

---

## Environment Variables

For production deployments, replace hardcoded keys with environment variables.

Create a `.env` file (never commit this):
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...  # for sync.js only
MAIN_API_URL=https://your-main-website.com/api/products
MAIN_API_KEY=your_main_api_key_here
```

---

## Running the Sync Script

### One-time sync
```bash
npm install @supabase/supabase-js
node sync.js
```

### Dry run (preview only, no changes saved)
```bash
node sync.js --dry-run
```

### Sync a single category
```bash
node sync.js --category=Taps
```

### Scheduled (every 30 min)
```js
import { startScheduledSync } from './sync.js';
startScheduledSync(1000 * 60 * 30);
```

---

## Deploying the Edge Function (Scheduled Sync)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref pwlappfcyqechcoiqcjk

# Set secrets
supabase secrets set MAIN_API_URL=https://your-main-site.com/api/products
supabase secrets set MAIN_API_KEY=your_api_key

# Deploy
supabase functions deploy sync-products

# Set CRON schedule in Supabase Dashboard:
# Edge Functions → sync-products → Schedule → 0 */6 * * *  (every 6 hours)
```

---

## Deploy to Vercel

### Option A — Vercel CLI
```bash
npm install -g vercel
cd maheshwarisales
vercel
```
Follow the prompts. Your site will be live at `https://maheshwarisales.vercel.app`

### Option B — Vercel Dashboard
1. Push your folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Framework Preset: **Other**
5. Build Command: *(leave empty)*
6. Output Directory: `.` (root)
7. Click **Deploy**

### Environment Variables on Vercel
Go to Project → Settings → Environment Variables and add:
```
SUPABASE_URL         = https://xxxx.supabase.co
SUPABASE_ANON_KEY    = eyJ...
```

---

## Deploy to Netlify

### Option A — Drag & Drop
1. Go to [netlify.com](https://netlify.com) → Sites
2. Drag your `maheshwarisales` folder into the deploy zone
3. Done — live in seconds!

### Option B — Netlify CLI
```bash
npm install -g netlify-cli
cd maheshwarisales
netlify deploy --prod --dir .
```

### Option C — GitHub CI/CD
1. Push to GitHub
2. New Site from Git → select your repo
3. Build command: *(empty)*
4. Publish directory: `.`
5. Deploy!

### Environment Variables on Netlify
Site Settings → Environment Variables → Add:
```
SUPABASE_URL      = https://xxxx.supabase.co
SUPABASE_ANON_KEY = eyJ...
```

---

## Performance Checklist

All images use lazy loading:
```html
<img src="..." loading="lazy" alt="..."/>
```

Additional optimisations applied:
- [x] Unsplash images served with `?w=600&auto=format` (compressed + WebP)
- [x] Google Fonts loaded with `display=swap`
- [x] Tailwind via CDN (no unused CSS in production — consider PurgeCSS for v2)
- [x] CSS animations use `transform` and `opacity` only (GPU-accelerated)
- [x] `backdrop-filter` uses `will-change` where needed
- [x] Supabase queries use `.select('specific,columns')` not `select('*')` in production
- [x] Cart stored in `localStorage` (zero server calls for cart state)
- [x] IntersectionObserver for scroll animations (no scroll event listeners)

For production, also consider:
- [ ] Move Supabase keys to a serverless function / edge middleware
- [ ] Enable Supabase connection pooling
- [ ] Add a CDN (Cloudflare) in front of Netlify/Vercel
- [ ] Compress images with `squoosh.app` before uploading to Storage

---

## Pages Reference

| Page | URL | Description |
|---|---|---|
| Homepage | `/index.html` | Hero, categories, featured products |
| Products | `/products.html` | Full catalog with filters & cart |
| Gallery | `/gallery.html` | Masonry grid + lightbox |
| Admin Login | `/login.html` | Supabase Auth sign-in |
| Admin Dashboard | `/admin.html` | Protected CRUD panel |

---

## Features Summary

### Storefront
- Dark luxury theme (`#0a0a0a` base, gold/silver accents)
- Glassmorphism cards and navigation
- Reveal-on-scroll animations (IntersectionObserver)
- Custom animated cursor
- Fully responsive (mobile, tablet, desktop)

### Products Page
- Live fetch from Supabase
- Category sidebar filter (real-time)
- Search with 300ms debounce
- Price range slider
- Sort: Featured / Price / Name / Stock
- Grid & List view toggle
- Slide-out cart drawer with quantity management

### Gallery
- Masonry layout (4 columns → responsive)
- 50+ images (products + lifestyle)
- Vanilla JS lightbox with keyboard + swipe navigation
- Category filter tabs

### Admin
- Protected route (session check on load)
- Inline price & stock editing
- Add product modal with image upload to Supabase Storage
- Delete with confirmation modal
- Real-time stats (total, low stock, inventory value)

---

## License

© 2025 MaheshwariSales. All rights reserved.
Built with ❤️ for luxury hardware retail.