import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { combinar, dataCurta, faz, gradeHorarios, proximosDias, quando, rotuloDia } from './datas.ts';

/** Hoje às HH:MM no fuso local — as funções todas trabalham em horário local. */
function hojeAs(h: number, m = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
}

function maisDias(n: number, h = 9): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h, 0, 0, 0);
}

describe('quando', () => {
  it('diz "hoje" com a hora zero-padded', () => {
    assert.equal(quando(hojeAs(9, 5).toISOString()), 'hoje, 09:05');
  });

  it('diz "amanhã" para o dia seguinte', () => {
    assert.equal(quando(maisDias(1, 19).toISOString()), 'amanhã, 19:00');
  });

  it('usa dia da semana + data para datas mais distantes', () => {
    const d = maisDias(5, 8);
    const esperado = `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()]} ${String(
      d.getDate(),
    ).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, 08:00`;
    assert.equal(quando(d.toISOString()), esperado);
  });

  it('trata o passado como data distante, não como "hoje"', () => {
    // Uma partida de ontem não pode aparecer como "hoje" no feed.
    const ontem = maisDias(-1, 20);
    assert.match(quando(ontem.toISOString()), /^\w+ \d{2}\/\d{2}, 20:00$/u);
  });
});

describe('rotuloDia', () => {
  it('prioriza Hoje/Amanhã pelo offset', () => {
    assert.equal(rotuloDia(hojeAs(0), 0), 'Hoje');
    assert.equal(rotuloDia(maisDias(1), 1), 'Amanhã');
  });

  it('cai no dia da semana a partir do terceiro dia', () => {
    const d = maisDias(3);
    assert.equal(rotuloDia(d, 3), `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()]} ${d.getDate()}`);
  });
});

describe('dataCurta', () => {
  it('formata dia + mês abreviado', () => {
    assert.equal(dataCurta(new Date(2026, 6, 30)), '30 jul');
    assert.equal(dataCurta(new Date(2026, 0, 1)), '1 jan');
    assert.equal(dataCurta(new Date(2026, 11, 31)), '31 dez');
  });
});

describe('proximosDias', () => {
  it('devolve n dias consecutivos começando hoje à meia-noite', () => {
    const dias = proximosDias(7);
    assert.equal(dias.length, 7);
    assert.equal(dias[0].getHours(), 0);
    assert.equal(dias[0].getDate(), new Date().getDate());
    for (let i = 1; i < dias.length; i++) {
      const delta = dias[i].getTime() - dias[i - 1].getTime();
      // 23h/25h nos dias de virada de horário de verão; nunca 0 nem negativo.
      assert.ok(delta >= 23 * 3600_000 && delta <= 25 * 3600_000, `salto inesperado: ${delta}ms`);
    }
  });

  it('atravessa a virada de mês sem repetir dia', () => {
    const dias = proximosDias(40);
    const unicos = new Set(dias.map((d) => d.toDateString()));
    assert.equal(unicos.size, 40);
  });
});

describe('gradeHorarios', () => {
  it('vai de 06:00 a 22:00 de meia em meia hora, sem passar do fim', () => {
    const g = gradeHorarios();
    assert.equal(g[0], '06:00');
    assert.equal(g.at(-1), '22:00');
    assert.equal(g.length, 33);
    assert.ok(!g.includes('22:30'), 'não pode gerar horário além do fim');
  });

  it('respeita um passo diferente', () => {
    const g = gradeHorarios(8, 10, 15);
    assert.deepEqual(g, ['08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00']);
  });
});

describe('combinar', () => {
  it('junta dia + hora local preservando a hora escolhida', () => {
    const dia = new Date(2026, 6, 30);
    const iso = combinar(dia, '19:30');
    const volta = new Date(iso);
    assert.equal(volta.getHours(), 19);
    assert.equal(volta.getMinutes(), 30);
    assert.equal(volta.getDate(), 30);
    assert.equal(volta.getSeconds(), 0);
    assert.equal(volta.getMilliseconds(), 0);
  });

  it('produz um ISO em UTC (o servidor guarda timestamptz)', () => {
    assert.match(combinar(new Date(2026, 6, 30), '08:00'), /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/u);
  });

  it('rejeita hora malformada em vez de gravar data inválida', () => {
    // Sem validação, `new Date(..., NaN, NaN).toISOString()` estoura RangeError
    // em runtime — no meio do fluxo de criar partida.
    assert.throws(() => combinar(new Date(2026, 6, 30), 'agora'), RangeError);
  });
});

describe('faz', () => {
  it('mostra "agora" abaixo de um minuto', () => {
    assert.equal(faz(new Date(Date.now() - 30_000).toISOString()), 'agora');
  });

  it('escala para min / h / d', () => {
    assert.equal(faz(new Date(Date.now() - 5 * 60_000).toISOString()), '5 min');
    assert.equal(faz(new Date(Date.now() - 2 * 3600_000).toISOString()), '2 h');
    assert.equal(faz(new Date(Date.now() - 3 * 86_400_000).toISOString()), '3 d');
  });

  it('não mostra tempo negativo para relógio adiantado', () => {
    assert.equal(faz(new Date(Date.now() + 60_000).toISOString()), 'agora');
  });
});
