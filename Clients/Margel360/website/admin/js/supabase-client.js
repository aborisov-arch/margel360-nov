// Supabase project credentials
// The anon key is safe to expose client-side — Row Level Security controls data access.
// Replace the placeholder values below with your actual Supabase project values from:
// Project Settings → API → Project URL and anon/public key
const SUPABASE_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
