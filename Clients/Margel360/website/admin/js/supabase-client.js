// Supabase project credentials
// The anon key is safe to expose client-side — Row Level Security controls data access.
// Replace the placeholder values below with your actual Supabase project values from:
// Project Settings → API → Project URL and anon/public key
const SUPABASE_URL = 'YOUR_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
