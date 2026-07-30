import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Fecha automaticamente a aba/popup do fluxo de auth quando o app volta ao foco.
WebBrowser.maybeCompleteAuthSession();

/**
 * URL de retorno do login social.
 *  - web  →  http://localhost:8081/auth/callback  (usa a origem atual)
 *  - nativo →  boraumtenis://auth/callback         (usa o scheme do app.json)
 *
 * Esta é a URL que precisa estar na allowlist de "Redirect URLs" do Supabase.
 */
export function authRedirectUrl() {
  return Linking.createURL('/auth/callback');
}

/**
 * Inicia o login com o Google via Supabase.
 *  - No web, o supabase-js redireciona a própria aba para o Google e, no
 *    retorno, a rota /auth/callback resolve a sessão automaticamente.
 *  - No nativo, abrimos o navegador do sistema e, ao voltar pelo deep link,
 *    trocamos o `code` por uma sessão manualmente.
 */
export async function signInWithGoogle() {
  const redirectTo = authRedirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // No nativo não deixamos o supabase abrir o navegador — quem abre é o
      // WebBrowser abaixo, para capturarmos o retorno.
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });
  if (error) throw error;

  // Web: a navegação para o Google já aconteceu.
  if (Platform.OS === 'web') return;

  // Nativo: abre o navegador e espera o retorno pelo deep link.
  if (!data?.url) throw new Error('Não foi possível iniciar o login com o Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // usuário cancelou

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }
}
