// Supabase client for the public reservation form.
// Anon key is safe to expose client-side — RLS policies allow anon INSERT on enquiries only.
// Replace the placeholder values with your actual Supabase project values.
const SUPABASE_URL = 'YOUR_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const { createClient } = supabase;
const reservationDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
