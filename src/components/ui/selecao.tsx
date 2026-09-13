'use client';

import estilos from './selecao.module.css';

type Opt<T extends string> = { label: string; value: T };

type SelecaoProps<T extends string> = {
  options: Opt<T>[];
  value: T | null;
  onChange: (v: T) => void;
  /** Descreve o grupo para quem navega por leitor de tela. */
  label?: string;
};

/** Seletor segmentado (uma escolha), bom para 2–3 opções lado a lado. */
export function Segmented<T extends string>({ options, value, onChange, label }: SelecaoProps<T>) {
  return (
    <div className={estilos.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={estilos.segment}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Grupo de chips (uma escolha) que quebram linha — bom para muitas opções. */
export function Chips<T extends string>({ options, value, onChange, label }: SelecaoProps<T>) {
  return (
    <div className={estilos.chips} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={estilos.chip}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
