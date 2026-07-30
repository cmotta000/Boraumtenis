import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltam as variáveis EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Confira o arquivo .env.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // No web usa localStorage (padrão); no nativo usa AsyncStorage.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No web o supabase-js troca o ?code= por sessão sozinho ao carregar a
    // página de callback; no nativo fazemos a troca manual (ver lib/oauth).
    detectSessionInUrl: Platform.OS === 'web',
    // PKCE: o retorno traz ?code= (e não #access_token=), que é o que a rota
    // /auth/callback e o exchangeCodeForSession esperam.
    flowType: 'pkce',
  },
});
