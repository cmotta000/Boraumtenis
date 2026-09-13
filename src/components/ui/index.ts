/**
 * Vocabulário visual do app. As telas importam sempre daqui (`@/components/ui`),
 * nunca dos arquivos individuais — assim um componente pode mudar de vizinho
 * sem arrastar as telas junto.
 */
export { Btn } from './botao';
export { CardPartida } from './card-partida';
export type { CardPartidaProps, MeuStatus } from './card-partida';
export { Spinner, TelaCarregando } from './carregando';
export { Chips, Segmented } from './selecao';
export { Card, CourtLine, Pagina, ScreenHeader, Secao } from './superficie';
export { Avatar, Pill, Wordmark } from './identidade';
export { Placar } from './placar';
export { SeletorTema } from './tema';
