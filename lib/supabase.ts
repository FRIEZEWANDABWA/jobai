import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Initialize the Supabase client.
// Note: We use the server role key for backend operations to bypass RLS,
// and the anon key for frontend operations.
export const supabase = createClient(supabaseUrl, supabaseKey);
