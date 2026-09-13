'use client';

import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import estilos from './tema.module.css';

/** "sistema" é a ausência de escolha: quem manda é o `prefers-color-scheme`. */
export type Tema = 'claro' | 'escuro' | 'sistema';

/**
 * A mesma chave que o script inline do `app/layout.tsx` lê antes do primeiro
 * paint. Se mudar aqui, mude lá — são as duas únicas pontas que a conhecem.
 */
export const CHAVE_TEMA = 'bora-tema';

const OPCOES: { valor: Tema; rotulo: string; Icone: LucideIcon }[] = [
  { valor: 'claro', rotulo: 'Claro', Icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', Icone: Moon },
  { valor: 'sistema', rotulo: 'Sistema', Icone: Monitor },
];

/** Em janela privada o `localStorage` lança em vez de devolver null. */
function lerEscolha(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch {
    /* sem storage: seguimos no sistema */
  }
  return 'sistema';
}

function guardarEscolha(tema: Tema) {
  try {
    if (tema === 'sistema') localStorage.removeItem(CHAVE_TEMA);
    else localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    /* a escolha vale para esta sessão e pronto */
  }
}

/**
 * No "sistema" o atributo SAI do html — é a ausência dele que devolve a decisão
 * ao `@media (prefers-color-scheme)` do tokens.css.
 */
export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === 'sistema') delete raiz.dataset.theme;
  else raiz.dataset.theme = tema === 'escuro' ? 'dark' : 'light';
}

/**
 * Claro / Escuro / Sistema. O desenho é o do `Segmented` de `selecao.tsx`, mas
 * aqui cada opção carrega ícone junto do rótulo, e o componente de lá só aceita
 * texto — então repetimos o desenho, não o componente.
 */
export function SeletorTema() {
  // O servidor não conhece o localStorage: começamos no "sistema" e corrigimos
  // depois de montar. O script do layout já pintou a tela certa antes disso.
  const [tema, setTema] = useState<Tema>('sistema');

  useEffect(() => {
    setTema(lerEscolha());
  }, []);

  function escolher(novo: Tema) {
    setTema(novo);
    aplicarTema(novo);
    guardarEscolha(novo);
  }

  return (
    <div className={estilos.grupo} role="radiogroup" aria-label="Tema do aplicativo">
      {OPCOES.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={valor === tema}
          onClick={() => escolher(valor)}
          className={estilos.opcao}>
          <Icone size={15} aria-hidden />
          {rotulo}
        </button>
      ))}
    </div>
  );
}
