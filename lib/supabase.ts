import { createClient } from '@supabase/supabase-js';

// Publishable key only; access is enforced by row-level security per company.
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
