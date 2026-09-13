'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CourtLine, Pagina, ScreenHeader, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { faz } from '@/lib/datas';
import { apresentar, destino, grupoDoDia, marcarLidas, type Notificacao } from '@/lib/notificacoes';
import { supabase } from '@/lib/supabase';

import estilos from './notificacoes.module.css';

export default function Notificacoes() {
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id;
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, tipo, payload_json, lida, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    setItens((data ?? []) as Notificacao[]);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Chegou notificação nova enquanto a tela está aberta: entra na lista.
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`notif-lista-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => setItens((prev) => [payload.new as Notificacao, ...prev]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid]);

  const naoLidas = itens.filter((n) => !n.lida).length;

  // Agrupa por "Hoje / Ontem / Esta semana / data", preservando a ordem.
  const grupos = useMemo(() => {
    const out: { titulo: string; itens: Notificacao[] }[] = [];
    for (const n of itens) {
      const titulo = grupoDoDia(n.created_at);
      const ultimo = out[out.length - 1];
      if (ultimo?.titulo === titulo) ultimo.itens.push(n);
      else out.push({ titulo, itens: [n] });
    }
    return out;
  }, [itens]);

  function abrir(n: Notificacao) {
    if (!n.lida) {
      setItens((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      marcarLidas([n.id]);
    }
    const rota = destino(n);
    if (rota) router.push(rota);
  }

  async function lerTudo() {
    setItens((prev) => prev.map((n) => ({ ...n, lida: true })));
    await marcarLidas();
  }

  return (
    <Pagina>
      <ScreenHeader title="Notificações" fallback="/inicio" />

      {naoLidas > 0 && (
        <button type="button" onClick={lerTudo} className={estilos.lerTudo}>
          Marcar todas como lidas ({naoLidas})
        </button>
      )}

      <CourtLine className={estilos.divisor} />

      {loading ? (
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      ) : itens.length === 0 ? (
        <div className={estilos.empty}>
          <Bell size={22} aria-hidden />
          <p className={estilos.emptyTitle}>Tudo em dia</p>
          <p className={estilos.emptyText}>
            Solicitações, confirmações, mensagens do chat e lembretes das suas partidas aparecem aqui.
          </p>
        </div>
      ) : (
        <div className={estilos.grupos}>
          {grupos.map((g) => (
            <section key={g.titulo} className={estilos.grupo}>
              <h3 className={estilos.grupoTitulo}>{g.titulo.toUpperCase()}</h3>
              {g.itens.map((n) => {
                const { icone: Icone, texto } = apresentar(n);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => abrir(n)}
                    className={`${estilos.row} ${n.lida ? '' : estilos.rowUnread}`}>
                    <span className={estilos.rowIcon}>
                      <Icone size={16} aria-hidden />
                    </span>
                    <span className={estilos.rowCorpo}>
                      <span className={estilos.rowText} style={{ display: 'block' }}>
                        {texto}
                      </span>
                      <span className={estilos.rowTime} style={{ display: 'block' }}>
                        {faz(n.created_at)}
                      </span>
                    </span>
                    {!n.lida && <span className={estilos.dot} aria-label="Não lida" />}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </Pagina>
  );
}
