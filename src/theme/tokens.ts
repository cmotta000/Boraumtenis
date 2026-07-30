import { Platform } from 'react-native';

/**
 * Identidade "quadra à noite": a estrutura do app é escura como uma quadra sob
 * refletor (verde-preto de piso rápido), o conteúdo é claro como giz — cinza
 * frio, nunca creme. O saibro entra só como acento e a bola de tênis aparece
 * uma vez por tela, no marcador da navegação.
 */
export const colors = {
  // — Estrutura (barra lateral, topo, superfícies escuras)
  court: '#0D1714', // verde-preto de quadra sob refletor
  courtRaise: '#16241F', // item elevado dentro da estrutura
  courtLine: '#22332C', // divisórias dentro da estrutura
  courtText: '#EAEFEC', // texto sobre a estrutura
  courtMute: '#84968E', // texto secundário sobre a estrutura

  // — Acento
  clay: '#B4472A', // saibro
  clayDeep: '#8E3520', // saibro na sombra
  clayWash: '#F6EAE5', // saibro diluído, para fundos de destaque no claro
  ball: '#D7F04A', // bola de tênis — só marcadores pequenos
  ballDeep: '#B9D42C',

  // — Conteúdo (superfícies claras)
  chalk: '#F1F3F1', // giz: fundo de trabalho
  card: '#FFFFFF',
  line: '#E7EAE7', // linha clara sobre superfície escura/acento
  net: '#DFE3E0', // bordas e divisórias no claro
  ink: '#0F1512', // texto principal
  inkSoft: '#69736E', // texto secundário

  // — Estado
  ok: '#1F7A4C',
  danger: '#C0392B',
  warn: '#B4772A',
} as const;

/**
 * Três papéis, três vozes: Archivo dá o peso de placar de transmissão nos
 * títulos, Plex Sans conduz a leitura e Plex Mono numera — dígitos tabulares
 * para placares e pontos não dançarem entre linhas.
 */
export const font = {
  display: Platform.select({
    web: 'Archivo, system-ui, sans-serif',
    default: 'System',
  }) as string,
  body: Platform.select({
    web: '"IBM Plex Sans", system-ui, sans-serif',
    default: 'System',
  }) as string,
  mono: Platform.select({
    web: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
    default: 'monospace',
  }) as string,
};

/** Cantos contidos: nada de cápsula, exceto onde a forma é o significado. */
export const radius = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const sp = (n: number) => n * 4;

/** Medidas do casco do app. */
export const shell = {
  sidebar: 252,
  rail: 76, // barra lateral recolhida (telas médias)
  topbar: 60,
  bottomBar: 60,
  /** A partir daqui a barra lateral aparece; abaixo, navegação inferior. */
  breakLateral: 900,
  /** A partir daqui a barra lateral abre com rótulos. */
  breakCompleta: 1180,
} as const;

/** Largura máxima da coluna de conteúdo. */
export const maxW = 1000;

/**
 * Sombras: na web usamos `boxShadow` (as props `shadow*` estão depreciadas);
 * no nativo, `elevation`.
 */
export const elev = {
  card: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(15,21,18,0.05)' },
    default: { elevation: 1 },
  }) as object,
  raised: Platform.select({
    web: { boxShadow: '0 6px 20px rgba(15,21,18,0.10)' },
    default: { elevation: 4 },
  }) as object,
};

/** Fonte com dígitos de largura fixa — placares, pontos, contadores. */
export const tabular = Platform.select({
  web: { fontVariantNumeric: 'tabular-nums' },
  default: {},
}) as object;
