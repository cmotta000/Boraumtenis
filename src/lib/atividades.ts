'use client';

/**
 * Tracking de atividade — a parte que o navegador alcança.
 *
 * Aqui mora a lógica do cronômetro e do GPS; a tela só desenha o que este
 * arquivo devolve. A regra que organiza tudo: **o cronômetro nunca depende do
 * GPS**. Permissão negada, navegador sem geolocation, sinal que não pega —
 * em qualquer um desses casos o tempo continua correndo e a pessoa consegue
 * registrar o jogo. O que se perde é o trajeto, e só.
 *
 * HealthKit e Health Connect não entram: os dois só falam com app nativo, e
 * este projeto é web desde 12/09/2026.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Um ponto do trajeto, como sai do `watchPosition`. */
export type PontoGps = { lat: number; lng: number; precisao: number; t: number };

/** O que o GPS está fazendo agora — a tela precisa dizer isso em português. */
export type EstadoGps = 'desligado' | 'procurando' | 'ok' | 'negado' | 'indisponivel' | 'sem-sinal';

export type EstadoCronometro = 'parado' | 'gravando' | 'pausado' | 'encerrado';

/**
 * Pior precisão que ainda aceitamos, em metros. Acima disso o ponto entra
 * como um pulo de quarteirão: o traçado vira rabisco e a distância mente
 * para cima. Numa quadra de tênis, 50 m já é generoso.
 */
const PRECISAO_MAXIMA_M = 50;

/**
 * `enableHighAccuracy` porque o deslocamento dentro de uma quadra é curto;
 * `maximumAge` de 5 s para não reaproveitar fix velho como se fosse novo; e
 * `timeout` de 15 s, que é quando desistimos e avisamos que não há sinal.
 */
const OPCOES_GPS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000,
};

const RAIO_TERRA_M = 6_371_000;

const rad = (g: number) => (g * Math.PI) / 180;

/** Distância entre dois pontos, em metros (Haversine). */
export function distanciaEntre(a: PontoGps, b: PontoGps): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Comprimento do trajeto, em metros. É só uma ESTIMATIVA para a tela mostrar
 * ao vivo — quem vale no fim é o `ST_Length` do banco, que mede sobre o
 * elipsoide e não sobre uma esfera perfeita.
 */
export function distanciaDaRota(pontos: PontoGps[]): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) total += distanciaEntre(pontos[i - 1], pontos[i]);
  return Math.round(total);
}

/**
 * Duração em texto: "1h 23min", "45min", "40s".
 *
 * Mora aqui e não em `datas.ts` de propósito: aquele arquivo formata
 * INSTANTES (que horas é, faz quanto tempo), e isto é uma DURAÇÃO. Misturar
 * os dois faria `datas.ts` ter duas gramáticas na mesma gaveta.
 */
export function formatarDuracao(segundos: number | null): string {
  const s = Math.max(0, Math.round(segundos ?? 0));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  if (h > 0) return min > 0 ? `${h}h ${min}min` : `${h}h`;
  if (min > 0) return `${min}min`;
  return `${s}s`;
}

/** Cronômetro na tela: "1:23:45" enquanto corre, com os segundos à mostra. */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const dois = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const resto = `${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}`;
  return h > 0 ? `${h}:${resto}` : resto;
}

/** Distância em texto curto: "820 m" ou "1,4 km". */
export function formatarDistancia(metros: number | null): string | null {
  if (metros === null || metros === undefined) return null;
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

/** O formato que `registrar_atividade(p_rota)` espera. */
export function rotaParaJson(pontos: PontoGps[]): { lat: number; lng: number }[] | null {
  if (pontos.length < 2) return null;
  return pontos.map((p) => ({ lat: p.lat, lng: p.lng }));
}

/** Traduz o erro do navegador para um dos nossos estados. */
function estadoDoErro(codigo: number): EstadoGps {
  if (codigo === 1) return 'negado'; // PERMISSION_DENIED
  if (codigo === 3) return 'sem-sinal'; // TIMEOUT
  return 'sem-sinal'; // POSITION_UNAVAILABLE
}

export type Cronometro = {
  estado: EstadoCronometro;
  /** Segundos de jogo, sem contar o que passou em pausa. */
  decorrido: number;
  inicio: Date | null;
  fim: Date | null;
  pontos: PontoGps[];
  gps: EstadoGps;
  /** Quantos fixes o GPS entregou e foram descartados por imprecisão. */
  descartados: number;
  iniciar: () => void;
  pausar: () => void;
  retomar: () => void;
  encerrar: () => void;
  reiniciar: () => void;
};

export function useCronometro(): Cronometro {
  const [estado, setEstado] = useState<EstadoCronometro>('parado');
  const [decorrido, setDecorrido] = useState(0);
  const [inicio, setInicio] = useState<Date | null>(null);
  const [fim, setFim] = useState<Date | null>(null);
  const [pontos, setPontos] = useState<PontoGps[]>([]);
  const [gps, setGps] = useState<EstadoGps>('desligado');
  const [descartados, setDescartados] = useState(0);

  // O tempo é calculado a partir de timestamps, não somando +1 por tique: se
  // a aba dormir (celular no bolso, tela apagada), o `setInterval` atrasa,
  // mas a conta por diferença de relógio continua certa.
  const acumuladoRef = useRef(0);
  const trechoRef = useRef<number | null>(null);

  const iniciar = useCallback(() => {
    acumuladoRef.current = 0;
    trechoRef.current = Date.now();
    setInicio(new Date());
    setFim(null);
    setPontos([]);
    setDescartados(0);
    setDecorrido(0);
    setEstado('gravando');
  }, []);

  /** Fecha o trecho em curso e devolve o total acumulado, em milissegundos. */
  const fecharTrecho = useCallback(() => {
    if (trechoRef.current !== null) acumuladoRef.current += Date.now() - trechoRef.current;
    trechoRef.current = null;
    return acumuladoRef.current;
  }, []);

  const pausar = useCallback(() => {
    if (estado !== 'gravando') return;
    setDecorrido(Math.round(fecharTrecho() / 1000));
    setEstado('pausado');
  }, [estado, fecharTrecho]);

  const retomar = useCallback(() => {
    if (estado !== 'pausado') return;
    trechoRef.current = Date.now();
    setEstado('gravando');
  }, [estado]);

  const encerrar = useCallback(() => {
    if (estado === 'parado' || estado === 'encerrado') return;
    setDecorrido(Math.round(fecharTrecho() / 1000));
    setFim(new Date());
    setEstado('encerrado');
  }, [estado, fecharTrecho]);

  const reiniciar = useCallback(() => {
    acumuladoRef.current = 0;
    trechoRef.current = null;
    setEstado('parado');
    setDecorrido(0);
    setInicio(null);
    setFim(null);
    setPontos([]);
    setDescartados(0);
    setGps('desligado');
  }, []);

  // Relógio.
  useEffect(() => {
    if (estado !== 'gravando') return;
    const id = window.setInterval(() => {
      const emCurso = trechoRef.current === null ? 0 : Date.now() - trechoRef.current;
      setDecorrido(Math.round((acumuladoRef.current + emCurso) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [estado]);

  // GPS. Só fica ligado enquanto grava — pausou, desliga; saiu da tela,
  // desliga. Um `watchPosition` esquecido drena a bateria do celular da
  // pessoa depois que ela já fechou o app.
  useEffect(() => {
    if (estado !== 'gravando') {
      setGps((atual) => (atual === 'ok' || atual === 'procurando' ? 'desligado' : atual));
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGps('indisponivel');
      return;
    }

    setGps((atual) => (atual === 'negado' || atual === 'indisponivel' ? atual : 'procurando'));

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        // Fix ruim não entra no traçado, mas prova que o GPS está vivo.
        if (Number.isFinite(accuracy) && accuracy > PRECISAO_MAXIMA_M) {
          setDescartados((n) => n + 1);
          setGps('ok');
          return;
        }

        setGps('ok');
        setPontos((atuais) => [
          ...atuais,
          { lat: latitude, lng: longitude, precisao: accuracy ?? 0, t: pos.timestamp },
        ]);
      },
      (erro) => setGps(estadoDoErro(erro.code)),
      OPCOES_GPS,
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [estado]);

  return {
    estado,
    decorrido,
    inicio,
    fim,
    pontos,
    gps,
    descartados,
    iniciar,
    pausar,
    retomar,
    encerrar,
    reiniciar,
  };
}

/** O aviso honesto que a tela mostra para cada estado do GPS. */
export const AVISO_GPS: Record<EstadoGps, string | null> = {
  desligado: null,
  procurando: 'Procurando sinal de GPS…',
  ok: null,
  negado: 'Sem permissão de localização — só o cronômetro. O tempo conta igual.',
  indisponivel: 'Este navegador não tem GPS — só o cronômetro. O tempo conta igual.',
  'sem-sinal': 'GPS sem sinal aqui — só o cronômetro. O tempo conta igual.',
};
