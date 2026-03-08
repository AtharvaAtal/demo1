// ============================================================
// sync.js — Inventory Sync Utility
// MaheshwariSales
// ============================================================
// PURPOSE:
//   Fetches product data from an external "Main Website" API
//   and upserts it into your Supabase `products` table.
//
// USAGE:
//   node sync.js                  → full sync
//   node sync.js --dry-run        → preview changes only
//   node sync.js --category=Taps  → sync one category
// ============================================================

import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.SUPABASE_URL      || 'https://pwlappfcyqechcoiqcjk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY'; // Use service key for admin writes
const MAIN_API_URL      = process.env.MAIN_API_URL      || 'https://your-main-website.com/api/products';
const MAIN_API_KEY      = process.env.MAIN_API_KEY      || 'YOUR_MAIN_API_KEY';
const SYNC_INTERVAL_MS  = 1000 * 60 * 30; // 30 minutes

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── CLI Flags ─────────────────────────────────────────────────
const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const CAT_FILTER = args.find(a => a.startsWith('--category='))?.split('=')[1];

// ── Logging ───────────────────────────────────────────────────
const log = {
  info:    (msg) => console.log(`\x1b[36m[INFO]\x1b[0m  ${msg}`),
  success: (msg) => console.log(`\x1b[32m[OK]\x1b[0m    ${msg}`),
  warn:    (msg) => console.log(`\x1b[33m[WARN]\x1b[0m  ${msg}`),
  error:   (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  divider: ()    => console.log('\x1b[90m' + '─'.repeat(50) + '\x1b[0m'),
};

// ── Field Mapper ──────────────────────────────────────────────
// Maps your external API's field names → Supabase schema
// Edit this to match your external API's response shape
function mapExternalProduct(externalProduct) {
  return {
    id:          externalProduct.id          || externalProduct.product_id,
    name:        externalProduct.name        || externalProduct.title || externalProduct.product_name,
    category:    normalizeCategory(externalProduct.category || externalProduct.type),
    price:       parseFloat(externalProduct.price || externalProduct.selling_price || 0),
    description: externalProduct.description || externalProduct.desc || '',
    image_url:   externalProduct.image_url   || externalProduct.image || externalProduct.thumbnail || '',
    stock:       parseInt(externalProduct.stock || externalProduct.quantity || externalProduct.inventory || 0),
  };
}

function normalizeCategory(raw = '') {
  const map = {
    'tap': 'Taps', 'faucet': 'Taps', 'mixer': 'Taps',
    'basin': 'Washbasins', 'sink': 'Washbasins', 'washbasin': 'Washbasins',
    'pipe': 'Pipes', 'fitting': 'Pipes', 'valve': 'Pipes', 'connector': 'Pipes',
    'switch': 'Switches', 'socket': 'Switches', 'electrical': 'Switches',
  };
  const key = raw.toLowerCase();
  for (const [keyword, cat] of Object.entries(map)) {
    if (key.includes(keyword)) return cat;
  }
  return raw; // keep original if no match
}

// ── Fetch from External API ────────────────────────────────────
async function fetchExternalProducts() {
  log.info(`Fetching from: ${MAIN_API_URL}`);

  // ── OPTION A: REST API (default) ──────────────────────────
  const url = CAT_FILTER
    ? `${MAIN_API_URL}?category=${encodeURIComponent(CAT_FILTER)}`
    : MAIN_API_URL;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${MAIN_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();

  // Handle common API response shapes:
  // { products: [...] } | { data: [...] } | { items: [...] } | [...]
  const raw = json.products || json.data || json.items || json.results || json;
  if (!Array.isArray(raw)) throw new Error('API response is not an array. Check field mapper.');

  log.success(`Fetched ${raw.length} products from external API`);
  return raw.map(mapExternalProduct);

  // ── OPTION B: CSV / Google Sheets ─────────────────────────
  // Uncomment if your main site exports CSV instead of JSON:
  //
  // const text = await response.text();
  // const rows = text.split('\n').slice(1); // skip header
  // return rows.filter(r => r.trim()).map(row => {
  //   const [id, name, category, price, description, image_url, stock] = row.split(',');
  //   return { id:+id, name, category, price:+price, description, image_url, stock:+stock };
  // });
}

// ── Validate Products ─────────────────────────────────────────
function validateProducts(products) {
  const valid = [];
  const invalid = [];

  for (const p of products) {
    const errors = [];
    if (!p.id || isNaN(p.id))         errors.push('missing id');
    if (!p.name || !p.name.trim())    errors.push('missing name');
    if (!p.category)                  errors.push('missing category');
    if (isNaN(p.price) || p.price < 0) errors.push('invalid price');
    if (isNaN(p.stock) || p.stock < 0) errors.push('invalid stock');

    if (errors.length) {
      invalid.push({ product: p, errors });
    } else {
      valid.push(p);
    }
  }

  if (invalid.length) {
    log.warn(`${invalid.length} products failed validation:`);
    invalid.forEach(({ product, errors }) =>
      log.warn(`  ID ${product.id} "${product.name}": ${errors.join(', ')}`)
    );
  }

  return valid;
}

// ── Diff: What changed? ───────────────────────────────────────
async function diffProducts(incoming) {
  const { data: existing, error } = await supabase.from('products').select('id,name,price,stock');
  if (error) throw new Error('Could not fetch existing products: ' + error.message);

  const existingMap = new Map(existing.map(p => [p.id, p]));
  const incomingMap = new Map(incoming.map(p => [p.id, p]));

  const toAdd    = incoming.filter(p => !existingMap.has(p.id));
  const toUpdate = incoming.filter(p => {
    const ex = existingMap.get(p.id);
    return ex && (ex.price !== p.price || ex.stock !== p.stock || ex.name !== p.name);
  });
  const toDelete = existing.filter(p => !incomingMap.has(p.id));

  return { toAdd, toUpdate, toDelete, unchanged: incoming.length - toAdd.length - toUpdate.length };
}

// ── Main Sync Function ────────────────────────────────────────
async function sync() {
  log.divider();
  console.log(`\x1b[33m  MaheshwariSales — Inventory Sync\x1b[0m`);
  console.log(`  ${new Date().toLocaleString('en-IN')}`);
  if (DRY_RUN)    console.log(`  \x1b[35m[DRY RUN — no changes will be saved]\x1b[0m`);
  if (CAT_FILTER) console.log(`  Category filter: ${CAT_FILTER}`);
  log.divider();

  const stats = { added: 0, updated: 0, deleted: 0, failed: 0 };

  try {
    // 1. Fetch
    const raw = await fetchExternalProducts();

    // 2. Validate
    const products = validateProducts(raw);
    log.info(`${products.length} valid products ready for sync`);

    // 3. Diff
    const { toAdd, toUpdate, toDelete, unchanged } = await diffProducts(products);
    log.info(`Changes: +${toAdd.length} new, ~${toUpdate.length} updated, -${toDelete.length} removed, ${unchanged} unchanged`);

    if (DRY_RUN) {
      log.warn('DRY RUN — printing planned changes:');
      if (toAdd.length)    { log.info('Would ADD:');    toAdd.forEach(p => console.log(`  + [${p.id}] ${p.name} — ₹${p.price}`)); }
      if (toUpdate.length) { log.info('Would UPDATE:'); toUpdate.forEach(p => console.log(`  ~ [${p.id}] ${p.name} — ₹${p.price} | stock: ${p.stock}`)); }
      if (toDelete.length) { log.info('Would DELETE:'); toDelete.forEach(p => console.log(`  - [${p.id}] ${p.name}`)); }
      log.divider();
      log.success('Dry run complete. Re-run without --dry-run to apply.');
      return;
    }

    // 4. Upsert new + updated
    const toUpsert = [...toAdd, ...toUpdate];
    if (toUpsert.length) {
      const BATCH = 20;
      for (let i = 0; i < toUpsert.length; i += BATCH) {
        const batch = toUpsert.slice(i, i + BATCH);
        const { error } = await supabase
          .from('products')
          .upsert(batch, { onConflict: 'id' });
        if (error) {
          log.error(`Upsert batch ${i}-${i+BATCH} failed: ${error.message}`);
          stats.failed += batch.length;
        } else {
          stats.added   += toAdd.filter(p => batch.includes(p)).length;
          stats.updated += toUpdate.filter(p => batch.includes(p)).length;
        }
      }
    }

    // 5. Remove products that no longer exist on main site
    // NOTE: Comment this block out if you don't want auto-deletion
    if (toDelete.length) {
      const idsToDelete = toDelete.map(p => p.id);
      const { error } = await supabase.from('products').delete().in('id', idsToDelete);
      if (error) { log.error('Delete failed: ' + error.message); stats.failed += toDelete.length; }
      else { stats.deleted = toDelete.length; }
    }

    // 6. Log sync result to a 'sync_logs' table (optional)
    await logSyncResult(stats, products.length);

  } catch (err) {
    log.error('Sync failed: ' + err.message);
    process.exit(1);
  }

  log.divider();
  log.success(`Sync complete!`);
  log.success(`  Added:   ${stats.added}`);
  log.success(`  Updated: ${stats.updated}`);
  log.success(`  Deleted: ${stats.deleted}`);
  if (stats.failed) log.warn(`  Failed:  ${stats.failed}`);
  log.divider();
}

// ── Optional: Write to sync_logs table in Supabase ────────────
async function logSyncResult(stats, total) {
  try {
    await supabase.from('sync_logs').insert([{
      synced_at:    new Date().toISOString(),
      total_products: total,
      added:        stats.added,
      updated:      stats.updated,
      deleted:      stats.deleted,
      failed:       stats.failed,
      source_url:   MAIN_API_URL,
    }]);
  } catch (_) {
    // sync_logs table is optional — silently skip if it doesn't exist
  }
}

// ── Scheduler: Run on interval ────────────────────────────────
export async function startScheduledSync(intervalMs = SYNC_INTERVAL_MS) {
  log.info(`Starting scheduled sync every ${intervalMs / 60000} minutes`);
  await sync(); // run immediately
  setInterval(sync, intervalMs);
}

// ── Run directly ──────────────────────────────────────────────
sync();