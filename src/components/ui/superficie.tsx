'use client';

import { ArrowLeft } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import estilos from './superficie.module.css';

/** Linha de quadra (giz). Divisor estrutural da identidade. */
export function CourtLine({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <hr className={[estilos.courtLine, className ?? ''].join(' ')} style={style} />;
}

/**
 * Moldura padrão das telas de dentro do app. Toda tela do grupo `(app)` começa
 * por aqui, para o respiro e a largura da coluna serem os mesmos em todas.
 */
export function Pagina({
  children,
  estreita,
  className,
}: {
  children: React.ReactNode;
  /** Coluna mais estreita, para leitura corrida — é o caso do feed. */
  estreita?: boolean;
  className?: string;
}) {
  const classes = [estilos.paginaConteudo, estreita ? estilos.paginaEstreita : '', className ?? ''];
  return (
    <div className={estilos.pagina}>
      <div className={classes.filter(Boolean).join(' ')}>{children}</div>
    </div>
  );
}

/** Rótulo de seção: mono, versalete, discreto. */
export function Secao({ children, className }: { children: string; className?: string }) {
  return <h2 className={[estilos.secao, className ?? ''].join(' ')}>{children}</h2>;
}

/** Cartão branco padrão do conteúdo. */
export function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={[estilos.card, className ?? ''].join(' ')} style={style}>
      {children}
    </div>
  );
}

/**
 * Volta para a rota anterior. O título da tela vive na barra de topo.
 *
 * O `next/navigation` não tem o `canGoBack()` que o expo-router tinha, então
 * olhamos o `history.length`: 1 significa que esta é a primeira página da aba
 * (link colado, aba nova) e voltar levaria para fora do app.
 */
export function ScreenHeader({ title, fallback = '/inicio' }: { title: string; fallback?: Route }) {
  const router = useRouter();

  const voltar = () => {
    if (window.history.length > 1) router.back();
    else router.replace(fallback);
  };

  return (
    <button type="button" onClick={voltar} aria-label={`Voltar de ${title}`} className={estilos.voltar}>
      <ArrowLeft size={15} aria-hidden />
      Voltar
    </button>
  );
}
