'use client';

import { MapPin, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Btn, CourtLine, Pagina, Pill, Spinner } from '@/components/ui';
import { quando } from '@/lib/datas';
import type { MatchTipo, PlayerStatus } from '@/lib/database.types';
import { origemDeBusca, type Origem } from '@/lib/location';
import { supabase } from '@/lib/supabase';

import estilos from './partidas.module.css';

type Partida = {
  id: string;
  criador_nome: string;
  local_texto: string | null;
  data_hora: string;
  tipo: MatchTipo;
  vagas_total: number;
  confirmados: number;
  distancia_m: number;
  meu_status: 'criador' | PlayerStatus | null;
};

const RAIOS = [10, 25, 50, 70];

/** Etiqueta do meu vínculo com a partida — só quando já existe algum. */
function meuVinculo(s: Partida['meu_status']): { label: string; tone: 'clay' | 'ok' | 'ball' } | null {
  switch (s) {
    case 'criador':
      return { label: 'sua partida', tone: 'clay' };
    case 'confirmado':
      return { label: 'você está dentro', tone: 'ok' };
    case 'convidado':
      return { label: 'aguardando', tone: 'ball' };
    default:
      return null;
  }
}

export default function Partidas() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [raio, setRaio] = useState(70);
  const [soComVaga, setSoComVaga] = useState(false);
  const [itens, setItens] = useState<Partida[]>([]);

  const carregar = useCallback(
    async (pedirGps = false) => {
      const o = await origemDeBusca(pedirGps);
      setOrigem(o);
      const { data } = await supabase.rpc('partidas_proximas', {
        lat: o.lat,
        lng: o.lng,
        raio_m: raio * 1000,
        apenas_com_vaga: soComVaga,
      });
      setItens((data as Partida[]) ?? []);
      setLoading(false);
    },
    [raio, soComVaga],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Pagina>
      <h2 className={estilos.title}>Partidas por perto</h2>
      <p className={estilos.localLinha}>
        <MapPin size={13} aria-hidden />
        <span className={estilos.subtitle}>{origem?.rotulo ?? 'localizando…'}</span>
      </p>

      {origem && origem.fonte !== 'gps' && (
        <button type="button" onClick={() => carregar(true)} className={estilos.gpsLink}>
          Usar minha localização exata →
        </button>
      )}

      <div className={estilos.criar}>
        <Btn label="Criar partida" icone={Plus} onClick={() => router.push('/criar-partida')} />
      </div>

      <CourtLine className={estilos.divisor} />

      {/* Filtros */}
      <div className={estilos.filtros}>
        <p className={estilos.filtroLabel}>RAIO</p>
        <div className={estilos.filtroChips}>
          {RAIOS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === raio}
              onClick={() => setRaio(r)}
              className={estilos.filtroChip}>
              {r} km
            </button>
          ))}
          <button
            type="button"
            aria-pressed={soComVaga}
            onClick={() => setSoComVaga((v) => !v)}
            className={estilos.filtroChip}>
            só com vaga
          </button>
        </div>
      </div>

      {loading ? (
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      ) : itens.length === 0 ? (
        <div className={estilos.empty}>
          <Search size={22} aria-hidden />
          <p className={estilos.emptyTitle}>Nenhuma partida aberta em {raio} km</p>
          <p className={estilos.emptyText}>
            {raio < 70
              ? 'Aumente o raio da busca ou crie a sua — a galera aparece.'
              : 'Seja o primeiro da sua região: crie uma partida e deixe a galera pedir pra entrar.'}
          </p>
          <div className={estilos.emptyBtn}>
            <Btn label="Criar a primeira partida" onClick={() => router.push('/criar-partida')} />
          </div>
        </div>
      ) : (
        <div className={estilos.lista}>
          {itens.map((p) => {
            const restantes = Math.max(0, p.vagas_total - p.confirmados);
            const vinculo = meuVinculo(p.meu_status);
            return (
              <Link key={p.id} href={`/partida/${p.id}`} className={estilos.card}>
                <span className={estilos.cardTop}>
                  <span className={estilos.cardPlace}>{p.local_texto ?? 'Partida de tênis'}</span>
                  <span className={estilos.cardDist}>{(p.distancia_m / 1000).toFixed(1)} km</span>
                </span>
                <span className={estilos.cardWhen}>
                  {quando(p.data_hora)} · {p.tipo === 'duplas' ? 'duplas' : 'simples'}
                </span>
                <span className={estilos.cardHost}>Anfitrião: {p.criador_nome}</span>
                <span className={estilos.cardFoot}>
                  <span className={estilos.cardPills}>
                    {restantes > 0 ? (
                      <Pill label={`${restantes} vaga${restantes > 1 ? 's' : ''}`} tone="ok" />
                    ) : (
                      <Pill label="completa" tone="muted" />
                    )}
                    {vinculo && <Pill label={vinculo.label} tone={vinculo.tone} />}
                  </span>
                  <span className={estilos.cardGo}>Ver partida →</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Pagina>
  );
}
