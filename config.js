// ============================================
// config.js — Supabase Client Initialization
// MaheshwariSales
// ============================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pwlappfcyqechcoiqcjk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bGFwcGZjeXFlY2hjb2lxY2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzA0NjUsImV4cCI6MjA4ODU0NjQ2NX0.364XmLPVCFGDVlrdNrW_JAOUQXmAKDYyp_mfKDmMUGI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);