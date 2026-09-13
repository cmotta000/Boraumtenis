import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { buscarLocais, reverseGeocode } from './geocode.ts';

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

/** Troca o fetch global e registra as URLs chamadas. */
function stubFetch(payload: unknown, ok = true) {
  const chamadas: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    chamadas.push(String(url));
    return { ok, json: async () => payload } as Response;
  }) as typeof fetch;
  return chamadas;
}

describe('buscarLocais', () => {
  it('não chama a rede com menos de 3 caracteres', async () => {
    const chamadas = stubFetch({ features: [] });
    assert.deepEqual(await buscarLocais('ib'), []);
    assert.deepEqual(await buscarLocais('  a  '), []);
    assert.equal(chamadas.length, 0, 'não deve bater na API de geocoding à toa');
  });

  it('monta nome e descrição a partir das propriedades do Photon', async () => {
    stubFetch({
      features: [
        {
          geometry: { coordinates: [-46.6555, -23.5874] },
          properties: {
            name: 'Ginásio do Ibirapuera',
            district: 'Vila Mariana',
            city: 'São Paulo',
            state: 'São Paulo',
          },
        },
      ],
    });
    const [local] = await buscarLocais('ibirapuera');
    assert.equal(local.nome, 'Ginásio do Ibirapuera');
    assert.equal(local.descricao, 'Vila Mariana, São Paulo/SP');
    assert.equal(local.lat, -23.5874);
    assert.equal(local.lng, -46.6555);
  });

  it('inverte a ordem do GeoJSON: coordinates vem [lng, lat]', async () => {
    stubFetch({
      features: [{ geometry: { coordinates: [-47.9292, -15.7801] }, properties: { name: 'Brasília' } }],
    });
    const [local] = await buscarLocais('brasilia');
    // Trocar essa ordem joga a partida no hemisfério errado.
    assert.ok(local.lat < 0 && local.lat > -34, `lat fora do Brasil: ${local.lat}`);
    assert.equal(local.lng, -47.9292);
  });

  it('descarta resultados sem coordenada numérica', async () => {
    stubFetch({
      features: [
        { geometry: { coordinates: [] }, properties: { name: 'Sem coords' } },
        { geometry: null, properties: { name: 'Sem geometria' } },
        { geometry: { coordinates: [-46.6, -23.5] }, properties: { name: 'Bom' } },
      ],
    });
    const locais = await buscarLocais('teste');
    assert.equal(locais.length, 1);
    assert.equal(locais[0].nome, 'Bom');
  });

  it('cai no logradouro quando não há nome do lugar', async () => {
    stubFetch({
      features: [
        {
          geometry: { coordinates: [-46.6, -23.5] },
          properties: { street: 'Rua Vergueiro', housenumber: '1000', city: 'São Paulo' },
        },
      ],
    });
    const [local] = await buscarLocais('vergueiro');
    assert.equal(local.nome, 'Rua Vergueiro, 1000');
  });

  it('envia o viés de localização quando recebe um ponto', async () => {
    const chamadas = stubFetch({ features: [] });
    await buscarLocais('quadra', { lat: -15.78, lng: -47.92 });
    assert.match(chamadas[0], /lat=-15\.78/u);
    assert.match(chamadas[0], /lon=-47\.92/u);
  });

  it('propaga erro quando a API responde falha', async () => {
    stubFetch({}, false);
    await assert.rejects(() => buscarLocais('qualquer'), /Falha na busca de endereço/u);
  });
});

describe('reverseGeocode', () => {
  it('resolve nome e descrição a partir do endereço do Nominatim', async () => {
    stubFetch({
      name: 'Arena BRB Mané Garrincha',
      address: { suburb: 'Asa Norte', city: 'Brasília', state: 'Distrito Federal' },
    });
    const local = await reverseGeocode(-15.7835, -47.8992);
    assert.equal(local.nome, 'Arena BRB Mané Garrincha');
    assert.equal(local.descricao, 'Asa Norte, Brasília/DF');
    // As coordenadas pedidas voltam intactas — são elas que vão pro banco.
    assert.equal(local.lat, -15.7835);
    assert.equal(local.lng, -47.8992);
  });

  it('usa um rótulo genérico quando o endereço vem vazio', async () => {
    stubFetch({ address: {} });
    const local = await reverseGeocode(0, 0);
    assert.equal(local.nome, 'Local selecionado');
  });

  it('propaga erro quando a API responde falha', async () => {
    stubFetch({}, false);
    await assert.rejects(() => reverseGeocode(0, 0), /Falha ao localizar o endereço/u);
  });
});
