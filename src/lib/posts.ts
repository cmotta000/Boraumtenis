import type { Database, PostTipo } from '@/lib/database.types';
import { enviarFotos, MAX_FOTOS, type FotoLocal } from '@/lib/fotos';
import { supabase } from '@/lib/supabase';

/** Um item do feed — resultado de partida ou publicação de fotos. */
export type PostFeed = Database['public']['Functions']['feed']['Returns'][number];
export type ComentarioPost = Database['public']['Functions']['comentarios_post']['Returns'][number];

export type PostDaPartida = {
  id: string;
  tipo: PostTipo;
  user_id: string;
  fotos: string[];
  legenda: string | null;
  created_at: string;
};

export const PAGINA_FEED = 10;

/** Página do feed. `userId` filtra por um jogador (jogos dele + fotos dele). */
export async function carregarFeed(opts: {
  antes?: string | null;
  userId?: string | null;
  limite?: number;
}): Promise<PostFeed[]> {
  const { data, error } = await supabase.rpc('feed', {
    p_limite: opts.limite ?? PAGINA_FEED,
    p_antes: opts.antes ?? null,
    p_user_id: opts.userId ?? null,
  });
  if (error) throw error;
  return (data as PostFeed[]) ?? [];
}

/** Publica fotos soltas no feed (opcionalmente ligadas a uma partida). */
export async function publicarFotos(opts: {
  userId: string;
  fotos: FotoLocal[];
  legenda?: string | null;
  matchId?: string | null;
}): Promise<string> {
  const caminhos = opts.fotos.length > 0 ? await enviarFotos(opts.userId, opts.fotos) : [];
  const { data, error } = await supabase.rpc('publicar_post', {
    p_legenda: opts.legenda?.trim() || null,
    p_fotos: caminhos,
    p_match_id: opts.matchId ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Acrescenta fotos a um post que já existe. */
export async function adicionarFotos(postId: string, userId: string, fotos: FotoLocal[]): Promise<string[]> {
  const caminhos = await enviarFotos(userId, fotos);
  const { data, error } = await supabase.rpc('adicionar_fotos_post', {
    p_post_id: postId,
    p_fotos: caminhos,
  });
  if (error) throw error;
  return (data as string[]) ?? [];
}

/** Curte ou descurte um post. */
export async function curtirPost(postId: string, curtir: boolean): Promise<void> {
  const { error } = await supabase.rpc('curtir_post', { p_post_id: postId, p_curtir: curtir });
  if (error) throw error;
}

/** Comentários de um post, do mais antigo para o mais novo. */
export async function comentariosDoPost(postId: string): Promise<ComentarioPost[]> {
  const { data, error } = await supabase.rpc('comentarios_post', { p_post_id: postId });
  if (error) throw error;
  return (data as ComentarioPost[]) ?? [];
}

/** Comenta num post e devolve a lista já atualizada. */
export async function comentarNoPost(postId: string, texto: string): Promise<ComentarioPost[]> {
  const { error } = await supabase.rpc('comentar_post', { p_post_id: postId, p_texto: texto });
  if (error) throw error;
  return comentariosDoPost(postId);
}

/** Apaga um post (só o autor consegue — a RPC valida). */
export async function excluirPost(postId: string): Promise<void> {
  const { error } = await supabase.rpc('excluir_post', { p_post_id: postId });
  if (error) throw error;
}

/** Posts ligados a uma partida (o do resultado e as publicações de fotos). */
export async function postsDaPartida(matchId: string): Promise<PostDaPartida[]> {
  const { data } = await supabase
    .from('posts')
    .select('id, tipo, user_id, fotos, legenda, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  return (data ?? []) as PostDaPartida[];
}

/**
 * Fotos tiradas depois do jogo. Elas entram no post do resultado quando ele já
 * existe (assim ficam junto do placar no feed); se o placar ainda não foi
 * confirmado, viram uma publicação ligada à partida.
 */
export async function adicionarFotosNaPartida(
  matchId: string,
  userId: string,
  fotos: FotoLocal[],
): Promise<void> {
  const posts = await postsDaPartida(matchId);
  const alvo =
    posts.find((p) => p.tipo === 'resultado' && p.fotos.length + fotos.length <= MAX_FOTOS) ??
    posts.find((p) => p.user_id === userId && p.fotos.length + fotos.length <= MAX_FOTOS);

  if (alvo) {
    await adicionarFotos(alvo.id, userId, fotos);
    return;
  }
  await publicarFotos({ userId, fotos, matchId });
}
