// Import as a package and access createClient dynamically to avoid TS complaints
import pkg from '@supabase/supabase-js';
const createClient: any = (pkg as any).createClient || (pkg as any).default?.createClient || (pkg as any);

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);
