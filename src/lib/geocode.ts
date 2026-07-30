// Geocodificação via OpenStreetMap — sem API key.
// Busca com autocomplete: Photon (komoot). Reverse (GPS→endereço): Nominatim.
// Ambos são gratuitos; uso leve, respeitando as políticas públicas.

export type Local = {
  nome: string; // linha principal, ex.: "Ginásio do Ibirapuera"
  descricao: string; // linha secundária, ex.: "Vila Mariana, São Paulo/SP"
  lat: number;
  lng: number;
};

const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

// Sigla de UF a partir do nome do estado (Photon/Nominatim devolvem por extenso).
const UF: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapá: 'AP', amazonas: 'AM', bahia: 'BA', ceará: 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', goiás: 'GO', maranhão: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', pará: 'PA',
  paraíba: 'PB', paraná: 'PR', pernambuco: 'PE', piauí: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondônia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'são paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

function siglaUf(estado?: string | null): string | null {
  if (!estado) return null;
  return UF[estado.trim().toLowerCase()] ?? null;
}

function montarDescricao(p: Record<string, any>): string {
  const uf = siglaUf(p.state);
  const cidade = p.city || p.town || p.village || p.county || null;
  const partes = [p.district || p.suburb || null, cidade ? `${cidade}${uf ? '/' + uf : ''}` : uf].filter(
    Boolean,
  );
  return partes.join(', ');
}

/**
 * Busca lugares/endereços por texto (autocomplete). `bias` opcional enviesa
 * os resultados para perto de um ponto (a localização do usuário).
 */
export async function buscarLocais(
  q: string,
  bias?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<Local[]> {
  const termo = q.trim();
  if (termo.length < 3) return [];
  // Photon só aceita lang default/de/en/fr — omitimos e usamos os nomes locais.
  const params = new URLSearchParams({ q: termo, limit: '6' });
  if (bias) {
    params.set('lat', String(bias.lat));
    params.set('lon', String(bias.lng));
  }
  const res = await fetch(`${PHOTON}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error('Falha na busca de endereço.');
  const json = await res.json();

  return (json.features ?? [])
    .map((f: any): Local | null => {
      const [lng, lat] = f.geometry?.coordinates ?? [];
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      const p = f.properties ?? {};
      const rua = [p.street, p.housenumber].filter(Boolean).join(', ');
      const nome = p.name || rua || p.city || 'Local';
      return { nome, descricao: montarDescricao(p), lat, lng };
    })
    .filter((x: Local | null): x is Local => x !== null);
}

/** Converte coordenadas (GPS) num endereço legível. */
export async function reverseGeocode(lat: number, lng: number): Promise<Local> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    'accept-language': 'pt',
    zoom: '17',
  });
  const res = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Falha ao localizar o endereço.');
  const json = await res.json();
  const a = json.address ?? {};
  const uf = siglaUf(a.state);
  const cidade = a.city || a.town || a.village || a.municipality || null;
  const nome =
    json.name ||
    a.leisure ||
    a.amenity ||
    [a.road, a.house_number].filter(Boolean).join(', ') ||
    a.suburb ||
    cidade ||
    'Local selecionado';
  const descricao = [a.suburb || a.neighbourhood || null, cidade ? `${cidade}${uf ? '/' + uf : ''}` : uf]
    .filter(Boolean)
    .join(', ');
  return { nome, descricao, lat, lng };
}
