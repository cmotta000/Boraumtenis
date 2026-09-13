import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Confira o arquivo .env.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // A sessão vive no localStorage do navegador — o app é todo cliente.
    autoRefreshToken: true,
    persistSession: true,
    // O supabase-js troca o ?code= por sessão sozinho ao carregar a página de
    // callback.
    detectSessionInUrl: true,
    // PKCE: o retorno traz ?code= (e não #access_token=), que é o que a rota
    // /auth/callback espera.
    flowType: 'pkce',
  },
});
