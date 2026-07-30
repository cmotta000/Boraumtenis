import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

/** Fotos de partidas e publicações do feed. */
export const BUCKET_FOTOS = 'partidas';
/** Fotos de perfil. */
export const BUCKET_AVATARES = 'avatares';

export const MAX_FOTOS = 6;

export type FotoLocal = {
  /** URI local, só para o preview antes do envio. */
  uri: string;
  base64: string;
  mime: string;
};

/**
 * Abre a galeria e devolve as fotos escolhidas (com os bytes em base64).
 *
 * Precisa ser chamado a partir de um toque do usuário — na web o navegador só
 * abre o seletor de arquivos depois de uma interação.
 */
export async function escolherFotos(restantes: number): Promise<FotoLocal[]> {
  if (restantes <= 0) return [];

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: restantes > 1,
    selectionLimit: restantes,
    quality: 0.6,
    base64: true,
  });
  if (res.canceled || !res.assets) return [];

  return res.assets
    .filter((a) => !!a.base64)
    .slice(0, restantes)
    .map((a) => ({
      uri: a.uri,
      base64: a.base64!,
      mime: a.mimeType ?? 'image/jpeg',
    }));
}

/**
 * Escolhe uma única foto para o perfil. `allowsEditing` recorta no celular
 * (não existe na web — lá o corte fica por conta do enquadramento circular).
 */
export async function escolherFotoDePerfil(): Promise<FotoLocal | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });
  const a = res.canceled ? null : res.assets?.[0];
  if (!a?.base64) return null;
  return { uri: a.uri, base64: a.base64, mime: a.mimeType ?? 'image/jpeg' };
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
      .upload(caminho, bytesDeBase64(foto.base64), { contentType: foto.mime, upsert: false });
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

/** URL pública de uma foto já enviada (o bucket é de leitura aberta). */
export function urlDaFoto(caminho: string): string {
  return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl;
}

/**
 * URL da foto de perfil. Aceita tanto um caminho do nosso bucket quanto uma
 * URL pronta (o avatar que vem do login social, por exemplo).
 */
export function urlDoAvatar(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  if (ehUrlExterna(caminho)) return caminho;
  return supabase.storage.from(BUCKET_AVATARES).getPublicUrl(caminho).data.publicUrl;
}

const ehUrlExterna = (s: string) => /^https?:\/\//i.test(s);

/**
 * base64 → bytes. Fazemos na mão para o mesmo código valer na web e no
 * nativo, sem depender de `Blob`/`FileReader` (instáveis no React Native).
 */
function bytesDeBase64(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
