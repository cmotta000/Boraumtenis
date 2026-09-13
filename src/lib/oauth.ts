import { supabase } from './supabase';

/**
 * URL de retorno do login social — a origem atual mais `/auth/callback`.
 *
 * Esta é a URL que precisa estar na allowlist de "Redirect URLs" do Supabase
 * (uma entrada para o localhost do desenvolvimento e outra para o domínio de
 * produção).
 */
export function authRedirectUrl() {
  return `${window.location.origin}/auth/callback`;
}

/**
 * Inicia o login com o Google via Supabase: o supabase-js redireciona a própria
 * aba para o Google e, no retorno, a rota /auth/callback resolve a sessão.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUrl() },
  });
  if (error) throw error;
}
