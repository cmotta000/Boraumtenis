'use client';

import type { LucideIcon } from 'lucide-react';

import estilos from './botao.module.css';

type Variante = 'primary' | 'ink' | 'ball' | 'ghost' | 'outline';

type BtnProps = {
  label: string;
  onClick?: () => void;
  /** `primary` saibro (padrão) · `ink` escuro · `ball` e `ghost` para fundos escuros · `outline` no claro. */
  variant?: Variante;
  icone?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  type?: 'button' | 'submit';
  className?: string;
};

export function Btn({
  label,
  onClick,
  variant = 'primary',
  icone: Icone,
  disabled,
  loading,
  full,
  type = 'button',
  className,
}: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[estilos.btn, estilos[variant], full ? estilos.full : '', className ?? '']
        .filter(Boolean)
        .join(' ')}>
      {loading ? (
        <span className={estilos.girando} role="status" aria-label="Carregando" />
      ) : (
        <>
          {Icone && <Icone size={16} aria-hidden />}
          {label}
        </>
      )}
    </button>
  );
}
