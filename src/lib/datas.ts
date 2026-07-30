// Helpers de data/hora em pt-BR, sem dependências externas.

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const doisDig = (n: number) => String(n).padStart(2, '0');

/** "hoje, 19:00" · "amanhã, 08:30" · "qua 30/07, 19:00" */
export function quando(iso: string): string {
  const d = new Date(iso);
  const hora = `${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;
  const hoje = new Date();
  const base = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((base(d) - base(hoje)) / 86_400_000);
  if (dias === 0) return `hoje, ${hora}`;
  if (dias === 1) return `amanhã, ${hora}`;
  return `${DIAS[d.getDay()]} ${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}, ${hora}`;
}

/** Rótulo curto de um dia, para chips: "Hoje", "Amanhã", "qua 30". */
export function rotuloDia(d: Date, offset: number): string {
  if (offset === 0) return 'Hoje';
  if (offset === 1) return 'Amanhã';
  return `${DIAS[d.getDay()]} ${d.getDate()}`;
}

/** Data por extenso curta: "30 jul". */
export function dataCurta(d: Date): string {
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** Próximos `n` dias a partir de hoje (00:00 local). */
export function proximosDias(n: number): Date[] {
  const hoje = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    return d;
  });
}

/** Grade de horários "HH:MM" de `inicio`h a `fim`h em passos de `passo` min. */
export function gradeHorarios(inicio = 6, fim = 22, passo = 30): string[] {
  const out: string[] = [];
  for (let h = inicio; h <= fim; h++) {
    for (let m = 0; m < 60; m += passo) {
      if (h === fim && m > 0) break;
      out.push(`${doisDig(h)}:${doisDig(m)}`);
    }
  }
  return out;
}

/** Combina um dia (Date local) + "HH:MM" num ISO string. */
export function combinar(dia: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m, 0, 0).toISOString();
}

/** Tempo relativo curto para notificações: "agora", "5 min", "2 h", "3 d". */
export function faz(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}
