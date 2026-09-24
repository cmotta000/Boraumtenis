'use client';

import {
  Award,
  CalendarCheck,
  CalendarDays,
  Crown,
  Flame,
  House,
  Medal,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Conquista = Database['public']['Functions']['badges_do_perfil']['Returns'][number];

/**
 * Tradução de `badges.icone` para componente.
 *
 * É um mapa FIXO de propósito. `icone` é texto que vem do banco, e montar um
 * componente a partir de string vinda de dado é como uma linha editada no
 * painel vira erro em tempo de execução na tela do jogador. Nome que não está
 * aqui cai no genérico — a conquista aparece, só sem ícone próprio.
 */
const ICONES: Record<string, LucideIcon> = {
  flame: Flame,
  zap: Zap,
  medal: Medal,
  trophy: Trophy,
  'calendar-check': CalendarCheck,
  'calendar-days': CalendarDays,
  crown: Crown,
  house: House,
};

export function iconeDaConquista(nome: string | null): LucideIcon {
  return (nome && ICONES[nome]) || Award;
}

/**
 * As conquistas de um jogador.
 *
 * Quem decide o que sai é `badges_do_perfil()` no banco: do próprio dono vem
 * tudo, de terceiro só se o perfil estiver aberto. Esta função não filtra
 * nada — se filtrasse, seria a segunda opinião sobre uma regra que já tem
 * dono, e as duas divergiriam.
 *
 * Lista vazia é ambígua de propósito no banco (sem conquista e sem permissão
 * dão a mesma resposta), então a tela só pode dizer "nada para mostrar" — e é
 * o que ela diz.
 */
export function useConquistas(userId: string | undefined): {
  conquistas: Conquista[];
  carregando: boolean;
} {
  const { session } = useAuth();
  const logado = !!session?.user.id;
  const [conquistas, setConquistas] = useState<Conquista[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!logado || !userId) {
      setConquistas([]);
      setCarregando(false);
      return;
    }

    let vivo = true;
    setCarregando(true);

    (async () => {
      const { data, error } = await supabase.rpc('badges_do_perfil', { p_user_id: userId });
      if (!vivo) return;
      // Erro aqui é quase sempre "a migration ainda não foi aplicada". A tela
      // some com a seção em vez de acusar: conquista é enfeite, não pode
      // virar mensagem de erro no meio do perfil.
      setConquistas(error ? [] : (data ?? []));
      setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [logado, userId]);

  return { conquistas, carregando };
}

/** "conquistado em 23 set" — data curta, sem hora: ninguém liga para o minuto. */
export function dataDaConquista(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const ano = d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MESES[d.getMonth()]}${ano}`;
}
