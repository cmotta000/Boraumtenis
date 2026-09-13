'use client';

import {
  Trophy,
  ChevronRight,
  CircleAlert,
  CirclePlus,
  ImageIcon,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CourtLine, Pagina, Secao } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

import estilos from './inicio.module.css';

type Atalho = { rota: Route; icone: LucideIcon; titulo: string; desc: string; destaque?: boolean };

const ATALHOS: Atalho[] = [
  {
    rota: '/criar-partida',
    icone: CirclePlus,
    titulo: 'Criar partida',
    desc: 'Abra um jogo no seu horário e escolha quem entra.',
    destaque: true,
  },
  {
    rota: '/partidas',
    icone: MapPin,
    titulo: 'Encontrar partidas',
    desc: 'Jogos abertos num raio de até 70 km.',
  },
  { rota: '/feed', icone: ImageIcon, titulo: 'Feed', desc: 'Placares, fotos e histórias das quadras.' },
  {
    rota: '/liga',
    icone: Trophy,
    titulo: 'Liga',
    desc: 'Sua divisão, sua posição e o que falta pra subir.',
  },
];

export default function Inicio() {
  const { session } = useAuth();
  const [nome, setNome] = useState('');
  const [stats, setStats] = useState({ pontos: 0, vitorias: 0, derrotas: 0 });
  const [incompleto, setIncompleto] = useState(false);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    supabase
      .from('profiles')
      .select('nome, pontos, vitorias, derrotas, mao_dominante, idade, anos_jogando, golpe_preferido, cidade')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNome(data.nome);
        setStats({ pontos: data.pontos, vitorias: data.vitorias, derrotas: data.derrotas });
        // Perfil "completo" = tem as características principais preenchidas.
        setIncompleto(
          !data.mao_dominante ||
            data.idade == null ||
            data.anos_jogando == null ||
            !data.golpe_preferido ||
            !data.cidade,
        );
      });
  }, [session?.user.id]);

  const jogos = stats.vitorias + stats.derrotas;
  const aproveitamento = jogos > 0 ? `${Math.round((stats.vitorias / jogos) * 100)}%` : '—';
  const primeiroNome = (nome || 'tenista').split(' ')[0];

  return (
    <Pagina>
      <h2 className={estilos.hello}>Olá, {primeiroNome}</h2>
      <p className={estilos.sub}>Pronto pra marcar um jogo?</p>

      <div className={estilos.stats}>
        <Stat label="Pontos" valor={String(stats.pontos)} destaque />
        <Stat label="Vitórias" valor={String(stats.vitorias)} />
        <Stat label="Derrotas" valor={String(stats.derrotas)} />
        <Stat label="Aproveitamento" valor={aproveitamento} />
      </div>

      {incompleto && (
        <Link href="/editar-perfil" className={estilos.aviso}>
          <CircleAlert size={17} aria-hidden />
          <span style={{ flex: 1 }}>
            <span className={estilos.avisoTitulo}>Complete seu perfil de jogador</span>
            <span className={estilos.avisoDesc}>
              Mão dominante, nível e golpe preferido ajudam a te parear com gente do seu nível.
            </span>
          </span>
          <ChevronRight size={17} aria-hidden style={{ color: 'var(--ink-soft)' }} />
        </Link>
      )}

      <CourtLine className={estilos.divisor} />
      <Secao>Atalhos</Secao>

      <div className={estilos.grid}>
        {ATALHOS.map(({ rota, icone: Icone, titulo, desc, destaque }) => (
          <Link
            key={rota}
            href={rota}
            className={`${estilos.card} ${destaque ? estilos.cardDestaque : ''}`}>
            <Icone size={19} aria-hidden />
            <span className={estilos.cardTitulo}>{titulo}</span>
            <span className={estilos.cardDesc}>{desc}</span>
          </Link>
        ))}
      </div>
    </Pagina>
  );
}

function Stat({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`${estilos.stat} ${destaque ? estilos.statDestaque : ''}`}>
      <p className={estilos.statLabel}>{label}</p>
      <p className={estilos.statValor}>{valor}</p>
    </div>
  );
}
