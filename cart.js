// ============================================================
// cart.js — Shared Cart + Supabase Init
// MaheshwariSales
// ============================================================

export const SUPABASE_URL     = 'https://pwlappfcyqechcoiqcjk.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bGFwcGZjeXFlY2hjb2lxY2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzA0NjUsImV4cCI6MjA4ODU0NjQ2NX0.364XmLPVCFGDVlrdNrW_JAOUQXmAKDYyp_mfKDmMUGI';

// ── Cart Helpers ─────────────────────────────────────────────
const CART_KEY = 'ms_cart_v2';

export function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
}

export function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  saveCart(cart);
}

export function removeFromCart(productId) {
  saveCart(getCart().filter(i => i.id !== productId));
}

export function updateQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.qty = Math.max(1, qty);
    saveCart(cart);
  }
}

export function getCartTotal() {
  return getCart().reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}