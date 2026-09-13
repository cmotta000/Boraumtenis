'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CourtLine, Spinner, Wordmark } from '@/components/ui';
import { useAuth } from '@/lib/auth';

import estilos from './callback.module.css';

/**
 * Página de retorno do login social (Google).
 *
 * Ao chegar aqui com `?code=...`, o supabase-js troca o código por uma sessão
 * sozinho (`detectSessionInUrl`) e o AuthProvider dispara o SIGNED_IN. Só
 * precisamos aguardar a sessão aparecer e então mandar o usuário pra dentro.
 */
export default function AuthCallback() {
  const { session } = useAuth();
  const router = useRouter();
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    // Se em ~10s nada acontecer, o login provavelmente falhou.
    const timer = setTimeout(() => setFalhou(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (session) router.replace('/inicio');
  }, [session, router]);

  return (
    <div className={estilos.fill}>
      <Wordmark tone="light" />
      <CourtLine className={estilos.risco} />
      {falhou && !session ? (
        <>
          <p className={estilos.msg}>Não deu pra concluir o login.</p>
          <Link href="/entrar" className={estilos.link}>
            Tentar novamente
          </Link>
        </>
      ) : (
        <>
          <Spinner />
          <p className={estilos.msg}>Entrando…</p>
        </>
      )}
    </div>
  );
}
