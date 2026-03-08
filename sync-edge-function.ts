// ============================================================
// supabase/functions/sync-products/index.ts
// Supabase Edge Function — runs on a CRON schedule
// ============================================================
// DEPLOY:
//   supabase functions deploy sync-products
// SCHEDULE (in Supabase Dashboard → Edge Functions → CRON):
//   0 */6 * * *   → every 6 hours
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const MAIN_API_URL = Deno.env.get('MAIN_API_URL') || '';
const MAIN_API_KEY = Deno.env.get('MAIN_API_KEY') || '';

function mapProduct(p: any) {
  return {
    id:          p.id || p.product_id,
    name:        p.name || p.title,
    category:    p.category,
    price:       parseFloat(p.price || 0),
    description: p.description || '',
    image_url:   p.image_url || p.image || '',
    stock:       parseInt(p.stock || p.quantity || 0),
  };
}

Deno.serve(async (req: Request) => {
  // Allow manual trigger via POST, or automated CRON
  if (req.method !== 'POST' && req.headers.get('x-cron-source') !== 'supabase') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // Fetch from main site
    const res = await fetch(MAIN_API_URL, {
      headers: { 'Authorization': `Bearer ${MAIN_API_KEY}` }
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);

    const json = await res.json();
    const raw  = json.products || json.data || json.items || json;
    const products = raw.map(mapProduct);

    // Upsert into Supabase
    const { error } = await supabase
      .from('products')
      .upsert(products, { onConflict: 'id' });

    if (error) throw error;

    // Log it
    await supabase.from('sync_logs').insert([{
      synced_at: new Date().toISOString(),
      total_products: products.length,
      source_url: MAIN_API_URL,
    }]);

    return new Response(
      JSON.stringify({ success: true, synced: products.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Sync error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});