import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/** Sem as variáveis de ambiente o app roda igual, só sem sincronia. */
export const syncConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = syncConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Sem isto, abrir o app duas vezes no mesmo navegador embaralha a sessão.
        storageKey: 'mercado-auth',
      },
    })
  : null;
