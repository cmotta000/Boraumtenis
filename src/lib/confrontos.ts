'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { dataCurta } from '@/lib/datas';
import type { ConfrontoItem, SetPlacar } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/**
 * O retrospecto do usuário logado contra um adversário — o "head-to-head".
 *
 * Quem faz a conta é `historico_confrontos()`, no banco. Este arquivo não soma
 * nada: se a tela somasse os jogos da lista curta para achar o total, o número
 * grande passaria a discordar da lista assim que alguém passasse de dez jogos.
 * Aqui só se traduz o formato do banco para o formato dos componentes.
 */
export type Retrospecto = {
  adversarioId: string;
  nome: string | null;
  avatar: string | null;
  /** `false` = o adversário não abre o perfil para mim; o local dos jogos some. */
  perfilAberto: boolean;
  jogos: number;
  vitoriasMinhas: number;
  vitoriasDele: number;
  setsAFavor: number;
  setsContra: number;
  saldoSets: number;
  confrontos: ConfrontoItem[];
};

/**
 * `null` é "ainda não sei" — carregando, sem sessão, ou a RPC falhou (o que
 * acontece enquanto a migration `20260923_confrontos.sql` não estiver
 * aplicada). Quem desenha mostra o vazio honesto nesse caso, nunca uma tabela
 * de zeros: zero é uma afirmação, e "vocês nunca se enfrentaram" é uma
 * afirmação diferente de "não consegui olhar".
 */
export type EstadoRetrospecto = {
  retrospecto: Retrospecto | null;
  carregando: boolean;
  erro: boolean;
};

export function useRetrospecto(adversarioId: string | undefined): EstadoRetrospecto {
  const { session } = useAuth();
  const me = session?.user.id;
  const [retrospecto, setRetrospecto] = useState<Retrospecto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    // Contra si mesmo não existe retrospecto, e o banco devolve vazio para
    // esse caso — a tela trata como "não encontrado".
    if (!me || !adversarioId || adversarioId === me) {
      setRetrospecto(null);
      setCarregando(false);
      return;
    }

    let vivo = true;
    setCarregando(true);
    setErro(false);

    (async () => {
      const { data, error } = await supabase.rpc('historico_confrontos', {
        p_adversario: adversarioId,
      });
      if (!vivo) return;

      if (error) {
        setRetrospecto(null);
        setErro(true);
        setCarregando(false);
        return;
      }

      const linha = data?.[0];
      setRetrospecto(
        linha
          ? {
              adversarioId: linha.adversario_id,
              nome: linha.adversario_nome,
              avatar: linha.adversario_avatar,
              perfilAberto: linha.perfil_aberto,
              jogos: linha.jogos,
              vitoriasMinhas: linha.vitorias_minhas,
              vitoriasDele: linha.vitorias_dele,
              setsAFavor: linha.sets_a_favor,
              setsContra: linha.sets_contra,
              saldoSets: linha.saldo_sets,
              confrontos: linha.confrontos ?? [],
            }
          : null,
      );
      setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [me, adversarioId]);

  return { retrospecto, carregando, erro };
}

/**
 * Converte um confronto para o formato do `<Placar>`, que fala em vencedor e
 * perdedor (`v`/`p`), enquanto o banco devolve tudo em "eu" e "ele".
 *
 * Devolve junto os dois rótulos de linha, já na ordem certa — é o que mantém
 * o placar do retrospecto idêntico ao do feed e ao da partida.
 */
export function placarDoConfronto(
  c: ConfrontoItem,
  nomeDele: string,
): { vencedores: string[]; perdedores: string[]; sets: SetPlacar[] } {
  const sets: SetPlacar[] = c.sets.map((s) => (c.eu_venci ? { v: s.eu, p: s.ele } : { v: s.ele, p: s.eu }));
  return c.eu_venci
    ? { vencedores: ['Você'], perdedores: [nomeDele], sets }
    : { vencedores: [nomeDele], perdedores: ['Você'], sets };
}

/**
 * Data de um jogo passado: "30 jul", e com o ano quando não foi neste ano.
 *
 * `quando()` não serve aqui — ele fala de compromisso futuro ("hoje, 19:00") e
 * o retrospecto olha para trás, onde a hora não importa e o ano sim.
 */
export function dataDoConfronto(iso: string | null): string {
  if (!iso) return 'data desconhecida';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data desconhecida';
  const curta = dataCurta(d);
  return d.getFullYear() === new Date().getFullYear() ? curta : `${curta} ${d.getFullYear()}`;
}

/**
 * A frase que resume o retrospecto em uma linha.
 *
 * Usa o NOME do adversário, nunca "ele": o app não pergunta gênero a ninguém,
 * então não tem como acertar um pronome — e errar o de um jogador de verdade,
 * na tela que fala dele, é pior do que repetir o nome.
 */
export function resumoDoRetrospecto(r: Retrospecto, nomeDele: string): string {
  if (r.vitoriasMinhas > r.vitoriasDele) return 'Você lidera o confronto';
  if (r.vitoriasDele > r.vitoriasMinhas) return `${nomeDele} lidera o confronto`;
  return 'Confronto empatado';
}
