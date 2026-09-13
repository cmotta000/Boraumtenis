'use client';

import {
  Bell,
  ChevronRight,
  House,
  ImageIcon,
  MapPin,
  Plus,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { Avatar, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useNaoLidas } from '@/lib/notificacoes';
import { useMeuPerfil } from '@/lib/perfil';

import estilos from './casco.module.css';

type Item = { rota: Route; label: string; icone: LucideIcon };

const NAV: Item[] = [
  { rota: '/inicio', label: 'Início', icone: House },
  { rota: '/partidas', label: 'Partidas', icone: MapPin },
  { rota: '/feed', label: 'Feed', icone: ImageIcon },
  { rota: '/liga', label: 'Liga', icone: Trophy },
];

/** Título que a barra de topo mostra para cada rota. */
const TITULOS: { prefixo: string; titulo: string }[] = [
  { prefixo: '/inicio', titulo: 'Início' },
  { prefixo: '/partidas', titulo: 'Partidas' },
  { prefixo: '/feed', titulo: 'Feed' },
  { prefixo: '/liga', titulo: 'Liga' },
  { prefixo: '/ranking', titulo: 'Ranking' },
  { prefixo: '/perfil', titulo: 'Perfil' },
  { prefixo: '/editar-perfil', titulo: 'Editar perfil' },
  { prefixo: '/criar-partida', titulo: 'Criar partida' },
  { prefixo: '/atividades', titulo: 'Atividades' },
  { prefixo: '/notificacoes', titulo: 'Notificações' },
  { prefixo: '/partida/', titulo: 'Partida' },
  { prefixo: '/resultado/', titulo: 'Registrar placar' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { perfil } = useMeuPerfil();
  const naoLidas = useNaoLidas();

  useEffect(() => {
    if (!loading && !session) router.replace('/entrar');
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className={estilos.boot}>
        <Spinner size={24} />
      </div>
    );
  }

  const titulo = TITULOS.find((t) => pathname.startsWith(t.prefixo))?.titulo ?? 'Bora um Tênis';
  const ativo = (rota: string) => pathname === rota || pathname.startsWith(rota + '/');

  return (
    <div className={estilos.app}>
      <aside className={estilos.sidebar}>
        {/* Marca: a bola é o ponto da assinatura. */}
        <div className={estilos.marca}>
          <span className={estilos.bola} aria-hidden />
          <span className={estilos.marcaTexto}>
            BORA UM
            <br />
            TÊNIS
          </span>
        </div>

        <nav className={estilos.nav}>
          {NAV.map(({ rota, label, icone: Icone }) => (
            <Link
              key={rota}
              href={rota}
              title={label}
              aria-current={ativo(rota) ? 'page' : undefined}
              className={estilos.item}>
              {ativo(rota) && <span className={estilos.marcador} aria-hidden />}
              <Icone size={18} aria-hidden />
              <span className={estilos.itemTexto}>{label}</span>
            </Link>
          ))}
        </nav>

        <div className={estilos.temporada}>
          <p className={estilos.temporadaLabel}>TEMPORADA</p>
          <p className={estilos.temporadaLinha}>
            <span className={estilos.temporadaPontos}>{perfil?.pontos ?? 0}</span>
            <span className={estilos.temporadaUnidade}>pts</span>
          </p>
          <p className={estilos.temporadaSaldo}>
            {perfil?.vitorias ?? 0}V · {perfil?.derrotas ?? 0}D
          </p>
        </div>

        <div className={estilos.espaco} />

        <Link href="/perfil" aria-label="Abrir meu perfil" className={estilos.usuario}>
          <Avatar nome={perfil?.nome} foto={perfil?.avatar_url} size={32} />
          <span className={estilos.usuarioDados}>
            <span className={estilos.usuarioNome}>{perfil?.nome ?? '—'}</span>
            <span className={estilos.usuarioLink}>Ver perfil</span>
          </span>
          <ChevronRight size={15} aria-hidden style={{ color: 'var(--court-mute)' }} />
        </Link>
      </aside>

      <div className={estilos.principal}>
        <header className={estilos.topbar}>
          <h1 className={estilos.topbarTitulo}>{titulo}</h1>

          <div className={estilos.espaco} />

          <Link
            href="/notificacoes"
            aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
            className={estilos.iconeBtn}>
            <Bell size={18} aria-hidden />
            {naoLidas > 0 && <span className={estilos.badge}>{naoLidas > 9 ? '9+' : naoLidas}</span>}
          </Link>

          {/* Na própria tela de criar partida o atalho seria redundante. */}
          {!pathname.startsWith('/criar-partida') && (
            <Link href="/criar-partida" className={estilos.cta}>
              <Plus size={16} aria-hidden />
              <span className={estilos.ctaTexto}>Criar partida</span>
            </Link>
          )}
        </header>

        <main className={estilos.conteudo}>{children}</main>

        <nav className={estilos.barraInferior}>
          {NAV.map(({ rota, label, icone: Icone }) => (
            <Link
              key={rota}
              href={rota}
              aria-current={ativo(rota) ? 'page' : undefined}
              className={estilos.itemInferior}>
              <Icone size={19} aria-hidden />
              {label}
            </Link>
          ))}
          <Link
            href="/perfil"
            aria-current={ativo('/perfil') ? 'page' : undefined}
            className={estilos.itemInferior}>
            <Avatar nome={perfil?.nome} foto={perfil?.avatar_url} size={19} />
            Perfil
          </Link>
        </nav>
      </div>
    </div>
  );
}
