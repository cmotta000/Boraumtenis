import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { reverseGeocode } from '@/lib/geocode';
import { supabase } from '@/lib/supabase';

export type LocalCapturado = {
  lat: number;
  lng: number;
  cidade: string | null;
  uf: string | null;
};

/** De onde saiu o ponto usado na busca por raio. */
export type FonteOrigem = 'gps' | 'perfil' | 'padrao';

export type Origem = {
  lat: number;
  lng: number;
  fonte: FonteOrigem;
  /** Texto curto pra mostrar ao usuário de onde veio o ponto. */
  rotulo: string;
};

/** Centro de São Paulo — só quando não há GPS nem localização no perfil. */
const PADRAO = { lat: -23.5505, lng: -46.6333 };

/**
 * Captura a posição atual (GPS/navegador) e resolve cidade/UF.
 *
 * Em nativo usamos o geocoder do sistema; na web ele não existe, então caímos
 * no Nominatim (mesmo serviço usado na busca de endereços). Assim a cidade
 * também é preenchida no navegador, que é onde o app roda hoje.
 */
export async function capturarLocalizacao(): Promise<LocalCapturado> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permissão de localização negada. Você pode digitar a cidade manualmente.');
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  let cidade: string | null = null;
  let uf: string | null = null;

  if (Platform.OS !== 'web') {
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (addr) {
        cidade = addr.city ?? addr.subregion ?? null;
        uf = normalizarUf(addr.region);
      }
    } catch {
      // cai no geocoder web abaixo
    }
  }

  if (!cidade) {
    try {
      const local = await reverseGeocode(lat, lng);
      // `descricao` vem como "Bairro, Cidade/UF" — a última parte é o que queremos.
      const ultima = local.descricao.split(',').pop()?.trim() ?? '';
      const [c, u] = ultima.split('/');
      cidade = c?.trim() || null;
      uf = normalizarUf(u?.trim() ?? null);
    } catch {
      // silencioso — ficamos só com as coordenadas
    }
  }

  return { lat, lng, cidade, uf };
}

/** Grava o ponto no perfil (usado como origem quando não há GPS na próxima visita). */
export async function salvarLocalizacaoNoPerfil(lat: number, lng: number): Promise<void> {
  await supabase.rpc('definir_minha_localizacao', { lat, lng });
}

/**
 * Ponto de origem para a busca por raio, na ordem: GPS → perfil → padrão.
 *
 * Por padrão NÃO abre o diálogo de permissão: se o usuário já autorizou, o GPS
 * é usado; senão caímos direto no que está salvo no perfil. Passe
 * `pedirPermissao` quando a ação partir de um toque explícito ("usar minha
 * localização"), que é o único momento em que o navegador aceita o pedido.
 */
export async function origemDeBusca(pedirPermissao = false): Promise<Origem> {
  try {
    const atual = await Location.getForegroundPermissionsAsync();
    const permitido =
      atual.status === 'granted' ||
      (pedirPermissao && (await Location.requestForegroundPermissionsAsync()).status === 'granted');

    if (permitido) {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = pos.coords;
      // Guarda pro próximo acesso funcionar mesmo sem GPS.
      salvarLocalizacaoNoPerfil(lat, lng).catch(() => {});
      return { lat, lng, fonte: 'gps', rotulo: 'sua localização agora' };
    }
  } catch {
    // sem GPS — segue para o perfil
  }

  try {
    const { data } = await supabase.rpc('minha_localizacao');
    const salvo = data?.[0];
    if (salvo) {
      const onde = salvo.cidade ? `${salvo.cidade}${salvo.uf ? '/' + salvo.uf : ''}` : 'seu perfil';
      return { lat: salvo.lat, lng: salvo.lng, fonte: 'perfil', rotulo: `${onde} · do seu perfil` };
    }
  } catch {
    // sem perfil salvo — segue para o padrão
  }

  return { ...PADRAO, fonte: 'padrao', rotulo: 'São Paulo · localização aproximada' };
}

const UFS: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapá: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceará: 'CE',
  'distrito federal': 'DF',
  'espírito santo': 'ES',
  goiás: 'GO',
  maranhão: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  pará: 'PA',
  paraíba: 'PB',
  paraná: 'PR',
  pernambuco: 'PE',
  piauí: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondônia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'são paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

/** Converte o nome do estado (vindo do geocoder) na sigla de 2 letras. */
function normalizarUf(region: string | null): string | null {
  if (!region) return null;
  const limpo = region.trim();
  if (limpo.length === 2) return limpo.toUpperCase();
  return UFS[limpo.toLowerCase()] ?? null;
}
