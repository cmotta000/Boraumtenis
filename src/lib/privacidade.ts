import { supabase } from '@/lib/supabase';

/**
 * Quem enxerga o quê. A mesma escala vale para os dados do perfil e para as
 * fotos, mas as duas escolhas são independentes — dá pra ter um perfil aberto
 * e as fotos só para quem já jogou com você.
 *
 * Quem aplica a regra é o banco: a view `perfis`, as RPCs e as policies do
 * Storage. O que está aqui é só o vocabulário da tela.
 */
export type Visibilidade = 'publico' | 'parceiros' | 'privado';

export type Privacidade = {
  visibilidade_perfil: Visibilidade;
  visibilidade_fotos: Visibilidade;
};

export const PADRAO: Privacidade = {
  visibilidade_perfil: 'publico',
  visibilidade_fotos: 'publico',
};

type Opcao = { value: Visibilidade; label: string; explicacao: string };

export const OPCOES_PERFIL: Opcao[] = [
  {
    value: 'publico',
    label: 'Todo mundo',
    explicacao: 'Qualquer pessoa logada vê sua cidade, seu nível e seu estilo de jogo.',
  },
  {
    value: 'parceiros',
    label: 'Só quem já jogou comigo',
    explicacao: 'Só quem dividiu uma partida com você vê esses dados. Os outros veem só nome e ranking.',
  },
  {
    value: 'privado',
    label: 'Ninguém',
    explicacao: 'Ninguém vê seus dados de perfil. Nome e posição no ranking continuam à vista.',
  },
];

export const OPCOES_FOTOS: Opcao[] = [
  {
    value: 'publico',
    label: 'Todo mundo',
    explicacao: 'Sua foto de perfil e suas publicações aparecem para qualquer pessoa logada.',
  },
  {
    value: 'parceiros',
    label: 'Só quem já jogou comigo',
    explicacao: 'Suas fotos só abrem para quem dividiu uma partida com você.',
  },
  {
    value: 'privado',
    label: 'Ninguém',
    explicacao: 'Suas fotos ficam só para você. No lugar do avatar, os outros veem suas iniciais.',
  },
];

/**
 * Idade, altura e o ponto exato da sua localização nunca saem para estranhos,
 * em nenhum dos níveis — vale dizer isso na tela.
 */
export const SEMPRE_PROTEGIDO =
  'Sua idade, sua altura e sua localização exata nunca aparecem para quem nunca jogou com você, em qualquer uma das opções.';

export async function carregarPrivacidade(userId: string): Promise<Privacidade> {
  const { data } = await supabase
    .from('profiles')
    .select('visibilidade_perfil, visibilidade_fotos')
    .eq('id', userId)
    .maybeSingle();
  return (data as Privacidade | null) ?? PADRAO;
}

export async function salvarPrivacidade(userId: string, p: Privacidade): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ visibilidade_perfil: p.visibilidade_perfil, visibilidade_fotos: p.visibilidade_fotos })
    .eq('id', userId);
  if (error) throw new Error('Não foi possível salvar suas preferências de privacidade.');
}
