/**
 * As cores e os raios vivem em `tokens.css` como variáveis CSS — é lá que a
 * identidade é definida. Aqui ficam só as medidas que o JavaScript ainda
 * precisa ler (pontos de quebra usados em `matchMedia`, por exemplo) e os
 * nomes das variáveis para quem monta estilo em linha.
 */

/** Medidas do casco do app. Espelham as variáveis de mesmo nome no CSS. */
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
 * Cores por referência à variável CSS, para os poucos casos em que a cor
 * precisa ir num atributo (o `color` de um ícone do lucide, por exemplo).
 */
export const cor = {
  court: 'var(--court)',
  courtRaise: 'var(--court-raise)',
  courtLine: 'var(--court-line)',
  courtText: 'var(--court-text)',
  courtMute: 'var(--court-mute)',
  clay: 'var(--clay)',
  clayDeep: 'var(--clay-deep)',
  clayWash: 'var(--clay-wash)',
  ball: 'var(--ball)',
  ballDeep: 'var(--ball-deep)',
  chalk: 'var(--chalk)',
  card: 'var(--card)',
  line: 'var(--line)',
  net: 'var(--net)',
  ink: 'var(--ink)',
  inkSoft: 'var(--ink-soft)',
  ok: 'var(--ok)',
  danger: 'var(--danger)',
  warn: 'var(--warn)',
} as const;
