'use client';

import type { Route } from 'next';
import {
  Award,
  Bell,
  CircleCheck,
  CircleX,
  Clock,
  Flag,
  Heart,
  MessageCircle,
  MessageSquare,
  Slash,
  SquarePen,
  TriangleAlert,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type NotificacaoPayload = {
  match_id?: string;
  result_id?: string;
  from_id?: string;
  from_nome?: string;
  match_local?: string | null;
  match_data_hora?: string;
};

export type Notificacao = {
  id: string;
  tipo: string;
  payload_json: NotificacaoPayload | null;
  lida: boolean;
  created_at: string;
};

/**
 * Conta notificações não lidas do usuário atual e mantém o número vivo por
 * Realtime. Usado no sino do início.
 */
export function useNaoLidas(): number {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [n, setN] = useState(0);

  const recarregar = useCallback(async () => {
    if (!uid) return;
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('lida', false);
    setN(count ?? 0);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    recarregar();
    const ch = supabase
      .channel(`notif-count-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => recarregar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, recarregar]);

  return n;
}

/** Marca notificações como lidas. Sem `ids`, marca todas as pendentes. */
export async function marcarLidas(ids?: string[]): Promise<void> {
  await supabase.rpc('marcar_notificacoes_lidas', { p_ids: ids ?? null });
}

/** Ícone e texto de uma notificação, já com nome de quem originou e o local. */
export function apresentar(n: Notificacao): { icone: LucideIcon; texto: string } {
  const p = n.payload_json ?? {};
  const nome = p.from_nome ?? 'Alguém';
  const onde = p.match_local ? ` em ${p.match_local}` : '';

  switch (n.tipo) {
    case 'solicitacao':
      return { icone: UserPlus, texto: `${nome} pediu pra entrar na sua partida${onde}.` };
    case 'confirmacao':
      return { icone: CircleCheck, texto: `Você foi confirmado na partida${onde}. Bora jogar!` };
    case 'recusa':
      return { icone: CircleX, texto: 'Sua solicitação não foi aceita desta vez.' };
    case 'cancelamento':
      return { icone: Slash, texto: `A partida${onde} foi cancelada.` };
    case 'saida':
      return { icone: UserMinus, texto: `${nome} saiu da sua partida${onde} — abriu vaga.` };
    case 'mensagem':
      return { icone: MessageCircle, texto: `${nome} mandou mensagem no chat da partida${onde}.` };
    case 'lembrete':
      return { icone: Clock, texto: `Sua partida${onde} é nas próximas 24 horas.` };
    case 'placar_pendente':
      return { icone: SquarePen, texto: `E aí, como foi o jogo${onde}? Registre o placar.` };
    case 'resultado':
      return { icone: Flag, texto: `${nome} registrou o placar${onde}. Confirme se está certo.` };
    case 'resultado_confirmado':
      return { icone: Award, texto: `Placar confirmado${onde}. Os pontos já entraram no ranking.` };
    case 'resultado_contestado':
      return { icone: TriangleAlert, texto: `${nome} contestou o placar${onde}. Registre de novo.` };
    case 'curtida':
      return { icone: Heart, texto: `${nome} curtiu sua publicação${onde}.` };
    case 'comentario':
      return { icone: MessageSquare, texto: `${nome} comentou na sua publicação${onde}.` };
    default:
      return { icone: Bell, texto: 'Você tem uma novidade.' };
  }
}

/** Para onde a notificação leva ao ser tocada. */
export function destino(n: Notificacao): Route | null {
  const p = n.payload_json ?? {};
  // O id vem do banco (uuid), então não quebra o segmento da rota.
  if (p.match_id) return `/partida/${p.match_id}` as Route;
  return null;
}

/** Rótulo do grupo temporal ("Hoje", "Ontem", "12 de março"). */
export function grupoDoDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dia(hoje) - dia(d)) / 86_400_000);
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return 'Esta semana';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}
