import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://unnmjrrpqftpcknabqwq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubm1qcnJwcWZ0cGNrbmFicXdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMDgzNzMsImV4cCI6MjA4Njc4NDM3M30.plrrQbgswaSTmnHwHQvUophs2CZDPAxylf0zNcrCeFo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);