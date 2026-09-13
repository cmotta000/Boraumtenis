'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';

/**
 * A landing é uma página de servidor (é o conteúdo que precisa ser indexado),
 * mas quem já tem sessão não deveria vê-la. Este pedacinho de cliente cuida
 * disso sem tirar a página do servidor.
 */
export function RedirecionaSeLogado() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace('/inicio');
  }, [loading, session, router]);

  return null;
}
