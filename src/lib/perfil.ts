import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** O básico do perfil: identidade para avatares e números para a barra lateral. */
export type MiniPerfil = {
  id: string;
  nome: string;
  avatar_url: string | null;
  pontos: number;
  vitorias: number;
  derrotas: number;
};

/**
 * Perfil do usuário logado (nome + foto), para o compositor e cabeçalhos.
 * `recarregar` serve depois de trocar a foto de perfil.
 */
export function useMeuPerfil() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [perfil, setPerfil] = useState<MiniPerfil | null>(null);

  const recarregar = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, avatar_url, pontos, vitorias, derrotas')
      .eq('id', uid)
      .maybeSingle();
    if (data) setPerfil(data as MiniPerfil);
  }, [uid]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { perfil, recarregar, userId: uid };
}
