'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/**
 * O recorte da temporada corrente que a barra lateral mostra.
 *
 * Existe porque `profiles.pontos/vitorias/derrotas` é acumulado de CARREIRA,
 * de antes da liga: a barra dizia "TEMPORADA" e mostrava o número da vida
 * inteira, brigando com o cartão da /liga na mesma janela. Quem sabe o que é
 * a temporada é a mesma RPC que a /liga usa.
 */
export type ResumoTemporada = {
  pontos: number;
  vitorias: number;
  derrotas: number;
  jogos: number;
};

/** Ainda sem linha na temporada é zero de verdade, não é "não sei". */
const ZERADA: ResumoTemporada = { pontos: 0, vitorias: 0, derrotas: 0, jogos: 0 };

/**
 * Números da temporada corrente do usuário logado.
 *
 * `null` quer dizer "ainda não sei" — carregando, sem sessão, ou a RPC falhou
 * (o que acontece enquanto a migration da liga não estiver aplicada). Quem
 * desenha deve mostrar vazio nesse caso, nunca zero: zero é uma afirmação, e
 * afirmar errado na barra que aparece em toda tela é pior do que não dizer.
 */
export function useMinhaTemporada(): { temporada: ResumoTemporada | null } {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [temporada, setTemporada] = useState<ResumoTemporada | null>(null);

  useEffect(() => {
    if (!uid) {
      setTemporada(null);
      return;
    }

    let vivo = true;

    (async () => {
      const { data, error } = await supabase.rpc('minha_liga');
      if (!vivo) return;

      if (error) {
        setTemporada(null); // a barra fica vazia; a navegação segue inteira
        return;
      }

      const linha = data?.[0];
      setTemporada(
        linha
          ? {
              pontos: linha.pontos,
              vitorias: linha.vitorias,
              derrotas: linha.derrotas,
              jogos: linha.jogos,
            }
          : ZERADA,
      );
    })();

    return () => {
      vivo = false;
    };
  }, [uid]);

  return { temporada };
}
