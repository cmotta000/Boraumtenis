'use client';

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Fotos de partidas e publicações do feed. */
export const BUCKET_FOTOS = 'partidas';
/** Fotos de perfil. */
export const BUCKET_AVATARES = 'avatares';

export const MAX_FOTOS = 6;

/** O que o bucket aceita — o mesmo `allowed_mime_types` configurado no Storage. */
const TIPOS_ACEITOS = 'image/jpeg,image/png,image/webp,image/heic';

export type FotoLocal = {
  /** URL de objeto, só para o preview antes do envio. Solte com `descartarPreview`. */
  uri: string;
  bytes: Uint8Array;
  mime: string;
};

/**
 * Abre o seletor de arquivos do navegador e devolve as fotos escolhidas.
 *
 * Precisa ser chamado a partir de um clique do usuário — o navegador só abre o
 * seletor durante o gesto. Resolve com lista vazia se a pessoa cancelar.
 */
export async function escolherFotos(restantes: number): Promise<FotoLocal[]> {
  if (restantes <= 0) return [];
  const arquivos = await abrirSeletor(restantes > 1);
  return Promise.all(arquivos.slice(0, restantes).map(lerArquivo));
}

/** Escolhe uma única foto para o perfil. O enquadramento circular faz o corte. */
export async function escolherFotoDePerfil(): Promise<FotoLocal | null> {
  const [arquivo] = await abrirSeletor(false);
  return arquivo ? lerArquivo(arquivo) : null;
}

/** Libera a URL de objeto de um preview que não vai mais ser mostrado. */
export function descartarPreview(foto: FotoLocal | null | undefined): void {
  if (foto?.uri.startsWith('blob:')) URL.revokeObjectURL(foto.uri);
}

/**
 * Envia as fotos para o Storage e devolve os caminhos gravados.
 * Cada usuário só pode escrever dentro da pasta com o próprio id (RLS).
 */
export async function enviarFotos(
  userId: string,
  fotos: FotoLocal[],
  bucket: string = BUCKET_FOTOS,
): Promise<string[]> {
  const caminhos: string[] = [];

  for (const [i, foto] of fotos.entries()) {
    const ext = foto.mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const caminho = `${userId}/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(caminho, foto.bytes, { contentType: foto.mime, upsert: false });
    if (error) throw new Error('Não foi possível enviar a foto. Tente de novo.');
    caminhos.push(caminho);
  }

  return caminhos;
}

/**
 * Troca a foto de perfil: sobe a nova, grava no perfil e apaga a anterior.
 * Devolve o caminho novo. O arquivo antigo é removido só depois de gravar —
 * se a limpeza falhar, o perfil já está correto.
 */
export async function trocarFotoDePerfil(
  userId: string,
  foto: FotoLocal,
  anterior: string | null,
): Promise<string> {
  const [caminho] = await enviarFotos(userId, [foto], BUCKET_AVATARES);

  const { error } = await supabase.from('profiles').update({ avatar_url: caminho }).eq('id', userId);
  if (error) throw new Error('Não foi possível salvar a foto de perfil.');

  if (anterior && !ehUrlExterna(anterior)) {
    await supabase.storage.from(BUCKET_AVATARES).remove([anterior]);
  }
  return caminho;
}

/** Remove a foto de perfil (volta para as iniciais). */
export async function removerFotoDePerfil(userId: string, atual: string | null): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw new Error('Não foi possível remover a foto de perfil.');
  if (atual && !ehUrlExterna(atual)) {
    await supabase.storage.from(BUCKET_AVATARES).remove([atual]);
  }
}

/**
 * ── URLs assinadas ───────────────────────────────────────────────────────────
 *
 * Os buckets são privados: a URL de uma foto é assinada na hora e vale uma
 * hora. Como o feed e a galeria pedem dezenas de fotos por vez, guardamos as
 * assinaturas em memória, renovamos só perto de expirar e assinamos em lote.
 */

type Assinatura = { url: string; expiraEm: number };

/** Validade pedida ao Storage, em segundos. */
const VALIDADE = 3600;
/** Renova com folga: uma foto que abre agora não pode expirar no meio do scroll. */
const MARGEM_MS = 10 * 60 * 1000;

const cache = new Map<string, Assinatura>();
/** Assinaturas em voo, para dez avatares da mesma pessoa não virarem dez requisições. */
const emVoo = new Map<string, Promise<string | null>>();

const chave = (bucket: string, caminho: string) => `${bucket}/${caminho}`;

function doCache(bucket: string, caminho: string): string | null {
  const guardada = cache.get(chave(bucket, caminho));
  if (guardada && guardada.expiraEm - MARGEM_MS > Date.now()) return guardada.url;
  return null;
}

function guardar(bucket: string, caminho: string, url: string) {
  cache.set(chave(bucket, caminho), { url, expiraEm: Date.now() + VALIDADE * 1000 });
}

/** Assina um lote de caminhos do mesmo bucket, pulando o que já está em cache. */
async function assinarLote(bucket: string, caminhos: string[]): Promise<void> {
  const faltando = [...new Set(caminhos.filter((c) => c && !doCache(bucket, c)))];
  if (faltando.length === 0) return;

  const { data } = await supabase.storage.from(bucket).createSignedUrls(faltando, VALIDADE);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) guardar(bucket, item.path, item.signedUrl);
  }
}

/** URL assinada de um caminho. Devolve null quando a privacidade do dono barra. */
export async function urlAssinada(caminho: string, bucket: string = BUCKET_FOTOS): Promise<string | null> {
  const guardada = doCache(bucket, caminho);
  if (guardada) return guardada;

  const k = chave(bucket, caminho);
  const jaPedida = emVoo.get(k);
  if (jaPedida) return jaPedida;

  const pedido = supabase.storage
    .from(bucket)
    .createSignedUrl(caminho, VALIDADE)
    .then(({ data }) => {
      if (!data?.signedUrl) return null;
      guardar(bucket, caminho, data.signedUrl);
      return data.signedUrl;
    })
    .catch(() => null)
    .finally(() => emVoo.delete(k));

  emVoo.set(k, pedido);
  return pedido;
}

/**
 * Adianta as assinaturas de uma página do feed ou da galeria, num pedido só.
 * Falha em silêncio: quem não conseguir assinar cai no caminho individual.
 */
export function prefetchFotos(caminhos: string[], bucket: string = BUCKET_FOTOS): void {
  assinarLote(bucket, caminhos).catch(() => {});
}

/**
 * URL de uma foto para usar no `src` de uma imagem. `null` enquanto a
 * assinatura não volta — ou para sempre, se o dono não deixa você ver.
 */
export function useFotoUrl(
  caminho: string | null | undefined,
  bucket: string = BUCKET_FOTOS,
): string | null {
  // URL pronta (avatar do login social) não passa pelo Storage.
  const externa = caminho && ehUrlExterna(caminho) ? caminho : null;
  const [url, setUrl] = useState<string | null>(
    externa ?? (caminho ? doCache(bucket, caminho) : null),
  );

  useEffect(() => {
    if (!caminho || externa) {
      setUrl(externa);
      return;
    }
    const guardada = doCache(bucket, caminho);
    if (guardada) {
      setUrl(guardada);
      return;
    }

    let vivo = true;
    urlAssinada(caminho, bucket).then((u) => {
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [caminho, bucket, externa]);

  return url;
}

/** Atalho para a foto de perfil, que mora no outro bucket. */
export function useAvatarUrl(caminho: string | null | undefined): string | null {
  return useFotoUrl(caminho, BUCKET_AVATARES);
}

export const ehUrlExterna = (s: string) => /^https?:\/\//i.test(s);

/**
 * Abre o seletor de arquivos e espera a escolha.
 *
 * O `<input>` fica fora do documento de propósito: ninguém o vê e ele some com
 * a promessa. O evento `cancel` existe nos navegadores atuais; sem ele a
 * promessa simplesmente nunca resolveria, então tratamos os dois casos.
 */
function abrirSeletor(multiplo: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = TIPOS_ACEITOS;
    input.multiple = multiplo;

    const encerrar = (arquivos: File[]) => {
      input.remove();
      resolve(arquivos);
    };

    input.addEventListener('change', () => encerrar(Array.from(input.files ?? [])), { once: true });
    input.addEventListener('cancel', () => encerrar([]), { once: true });
    input.click();
  });
}

/** Lê os bytes do arquivo e monta a URL do preview. */
async function lerArquivo(arquivo: File): Promise<FotoLocal> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  return {
    uri: URL.createObjectURL(arquivo),
    bytes,
    mime: arquivo.type || 'image/jpeg',
  };
}
