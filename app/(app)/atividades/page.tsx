'use client';

import { Lock, MapPin, Pause, Play, Square, Timer } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { Btn, Card, CourtLine, Pagina, Pill, Secao, Spinner } from '@/components/ui';
import {
  AVISO_GPS,
  distanciaDaRota,
  formatarDistancia,
  formatarDuracao,
  relogio,
  rotaParaJson,
  useCronometro,
} from '@/lib/atividades';
import { useAuth } from '@/lib/auth';
import { quando } from '@/lib/datas';
import type { AtividadeFonte, Database, Esforco, Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import estilos from './atividades.module.css';

type Atividade = Database['public']['Functions']['minhas_atividades']['Returns'][number];
type PartidaOpcao = { id: string; data_hora: string; local_texto: string | null };

const TOM_ESFORCO: Record<Esforco, 'muted' | 'clay' | 'ball'> = {
  leve: 'muted',
  moderado: 'clay',
  intenso: 'ball',
};

/** Converte o valor de um `<input type="datetime-local">` em ISO, ou null. */
function isoDoInput(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** O inverso: um instante vira o formato que o input entende (hora local). */
function inputDoIso(d: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** Quantos pontos tem o GeoJSON do trajeto (para dizer que existe trajeto). */
function pontosDoGeoJson(rota: Json | null): number {
  if (!rota || typeof rota !== 'object' || Array.isArray(rota)) return 0;
  const coords = (rota as { coordinates?: unknown }).coordinates;
  return Array.isArray(coords) ? coords.length : 0;
}

export default function AtividadesPage() {
  return (
    <Suspense
      fallback={
        <Pagina>
          <div className={estilos.carregando}>
            <Spinner size={24} />
          </div>
        </Pagina>
      }>
      <Atividades />
    </Suspense>
  );
}

function Atividades() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const partidaDaUrl = useSearchParams().get('partida');

  const cron = useCronometro();

  const [historico, setHistorico] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [partidas, setPartidas] = useState<PartidaOpcao[]>([]);

  // Formulário de confirmação (aberto ao encerrar, ou pelo registro manual).
  const [confirmando, setConfirmando] = useState<'cronometro' | 'manual' | null>(null);
  const [matchId, setMatchId] = useState<string>('');
  const [inicioManual, setInicioManual] = useState('');
  const [fimManual, setFimManual] = useState('');
  const [fcMedia, setFcMedia] = useState('');
  const [fcMax, setFcMax] = useState('');
  const [compartilhar, setCompartilhar] = useState(false); // opt-in: nasce desligado
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const carregarHistorico = useCallback(async () => {
    const { data } = await supabase.rpc('minhas_atividades', { p_limite: 30 });
    setHistorico(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  // As partidas que o jogador pode vincular: as que ele criou e as que ele
  // confirmou presença. É a mesma régua que `registrar_atividade` aplica no
  // banco — aqui é só para não oferecer opção que vai dar erro depois.
  useEffect(() => {
    if (!uid) return;
    let vivo = true;

    (async () => {
      const [{ data: vinculos }, { data: criadas }] = await Promise.all([
        supabase.from('match_players').select('match_id').eq('user_id', uid).eq('status', 'confirmado'),
        supabase
          .from('matches')
          .select('id, data_hora, local_texto')
          .eq('criador_id', uid)
          .order('data_hora', { ascending: false })
          .limit(30),
      ]);

      const ids = (vinculos ?? []).map((v) => v.match_id);
      const { data: participadas } = ids.length
        ? await supabase
            .from('matches')
            .select('id, data_hora, local_texto')
            .in('id', ids)
            .order('data_hora', { ascending: false })
            .limit(30)
        : { data: [] as PartidaOpcao[] };

      if (!vivo) return;

      const todas = new Map<string, PartidaOpcao>();
      for (const m of [...(criadas ?? []), ...(participadas ?? [])]) todas.set(m.id, m);

      // Atividade é sobre jogo que já aconteceu: partida futura não entra.
      const agora = Date.now();
      setPartidas(
        [...todas.values()]
          .filter((m) => new Date(m.data_hora).getTime() <= agora)
          .sort((a, b) => b.data_hora.localeCompare(a.data_hora))
          .slice(0, 20),
      );
    })();

    return () => {
      vivo = false;
    };
  }, [uid]);

  // Veio da tela da partida com `?partida=`: já abre no registro manual com
  // a partida escolhida — o jogo daquela tela já terminou, cronometrar não
  // faz sentido.
  useEffect(() => {
    if (!partidaDaUrl || confirmando) return;
    setMatchId(partidaDaUrl);
    abrirManual();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na chegada pela URL
  }, [partidaDaUrl]);

  const distanciaAoVivo = useMemo(() => distanciaDaRota(cron.pontos), [cron.pontos]);

  function abrirManual() {
    const agora = new Date();
    const duasHorasAtras = new Date(agora.getTime() - 2 * 60 * 60 * 1000);
    setInicioManual(inputDoIso(duasHorasAtras));
    setFimManual(inputDoIso(agora));
    setErro(null);
    setSalvo(false);
    setConfirmando('manual');
  }

  function encerrarCronometro() {
    cron.encerrar();
    setErro(null);
    setSalvo(false);
    setConfirmando('cronometro');
  }

  function cancelarConfirmacao() {
    setConfirmando(null);
    setMatchId('');
    setFcMedia('');
    setFcMax('');
    setCompartilhar(false);
    setErro(null);
    cron.reiniciar();
  }

  async function salvar() {
    setErro(null);

    const doCronometro = confirmando === 'cronometro';
    const inicio = doCronometro ? (cron.inicio?.toISOString() ?? null) : isoDoInput(inicioManual);
    const fim = doCronometro ? (cron.fim?.toISOString() ?? null) : isoDoInput(fimManual);

    if (!inicio) {
      setErro('Diga pelo menos a que horas o jogo começou.');
      return;
    }
    if (fim && new Date(fim) < new Date(inicio)) {
      setErro('O fim não pode ser antes do começo.');
      return;
    }

    const rota = doCronometro ? rotaParaJson(cron.pontos) : null;
    // Com trajeto gravado é `gps_web`; sem trajeto, o que temos é o que a
    // pessoa contou — e isso é `manual`, tenha vindo do cronômetro ou não.
    const fonte: AtividadeFonte = rota ? 'gps_web' : 'manual';
    const numero = (v: string) => {
      const n = Number(v);
      return v.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };

    setSalvando(true);
    const { error } = await supabase.rpc('registrar_atividade', {
      p_match_id: matchId || null,
      p_fonte: fonte,
      p_inicio: inicio,
      p_fim: fim,
      p_distancia_m: rota ? distanciaAoVivo : null,
      p_rota: rota as Json | null,
      p_fc_media: numero(fcMedia),
      p_fc_max: numero(fcMax),
      p_compartilhar: compartilhar,
    });
    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    cancelarConfirmacao();
    setSalvo(true);
    carregarHistorico();
  }

  const gravando = cron.estado === 'gravando' || cron.estado === 'pausado';
  const avisoGps = AVISO_GPS[cron.gps];

  return (
    <Pagina>
      {/* (a) GRAVAR */}
      {confirmando ? (
        <Card className={estilos.cartao}>
          <h2 className={estilos.tituloCartao}>Antes de salvar</h2>

          {confirmando === 'cronometro' ? (
            <p className={estilos.resumo}>
              <strong className={estilos.resumoForte}>{formatarDuracao(cron.decorrido)}</strong>
              {rotaParaJson(cron.pontos)
                ? ` · ${formatarDistancia(distanciaAoVivo)} de trajeto`
                : ' · sem trajeto (só o cronômetro)'}
            </p>
          ) : (
            <div className={estilos.campos}>
              <label className={estilos.campo}>
                <span className={estilos.rotulo}>Começou</span>
                <input
                  type="datetime-local"
                  value={inicioManual}
                  onChange={(e) => setInicioManual(e.target.value)}
                  className={estilos.input}
                />
              </label>
              <label className={estilos.campo}>
                <span className={estilos.rotulo}>Terminou</span>
                <input
                  type="datetime-local"
                  value={fimManual}
                  onChange={(e) => setFimManual(e.target.value)}
                  className={estilos.input}
                />
              </label>
            </div>
          )}

          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Foi numa partida? (opcional)</span>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className={estilos.input}>
              <option value="">Treino avulso</option>
              {partidas.map((m) => (
                <option key={m.id} value={m.id}>
                  {quando(m.data_hora)}
                  {m.local_texto ? ` · ${m.local_texto}` : ''}
                </option>
              ))}
            </select>
          </label>

          <div className={estilos.campos}>
            <label className={estilos.campo}>
              <span className={estilos.rotulo}>FC média (opcional)</span>
              <input
                type="number"
                inputMode="numeric"
                min={30}
                max={240}
                placeholder="—"
                value={fcMedia}
                onChange={(e) => setFcMedia(e.target.value)}
                className={estilos.input}
              />
            </label>
            <label className={estilos.campo}>
              <span className={estilos.rotulo}>FC máxima (opcional)</span>
              <input
                type="number"
                inputMode="numeric"
                min={30}
                max={240}
                placeholder="—"
                value={fcMax}
                onChange={(e) => setFcMax(e.target.value)}
                className={estilos.input}
              />
            </label>
          </div>
          <p className={estilos.dica}>
            Batimento só serve para calcular o seu esforço. Ele nunca aparece para outra pessoa,
            mesmo se você compartilhar a atividade.
          </p>

          {/* O opt-in. Nasce desligado e diz exatamente o que acontece ao ligar. */}
          <div className={estilos.switchLinha}>
            <button
              type="button"
              role="switch"
              aria-checked={compartilhar}
              onClick={() => setCompartilhar((v) => !v)}
              className={`${estilos.switch} ${compartilhar ? estilos.switchLigado : ''}`}>
              <span className={estilos.switchBolinha} />
            </button>
            <div className={estilos.switchTextos}>
              <span className={estilos.switchLabel}>Mostrar no meu perfil para outras pessoas</span>
              <span className={estilos.switchDica}>
                Ligado, quem pode ver seu perfil vê a data, a duração e o esforço desta atividade.
                O trajeto e o batimento continuam só seus. Desligado, ela é sua e de mais ninguém.
              </span>
            </div>
          </div>

          {erro && <p className={estilos.erro}>{erro}</p>}

          <div className={estilos.acoes}>
            <Btn label="Descartar" variant="outline" onClick={cancelarConfirmacao} />
            <Btn label="Salvar atividade" onClick={salvar} loading={salvando} />
          </div>
        </Card>
      ) : gravando ? (
        <Card className={estilos.cartaoGravando}>
          <p className={estilos.cronometro}>{relogio(cron.decorrido)}</p>
          <p className={estilos.estadoGravacao}>
            {cron.estado === 'pausado' ? 'Pausado' : 'Gravando'}
          </p>

          <div className={estilos.medidas}>
            <div className={estilos.medida}>
              <span className={estilos.medidaValor}>
                {formatarDistancia(distanciaAoVivo) ?? '—'}
              </span>
              <span className={estilos.medidaRotulo}>distância</span>
            </div>
            <div className={estilos.medida}>
              <span className={estilos.medidaValor}>{cron.pontos.length}</span>
              <span className={estilos.medidaRotulo}>pontos de GPS</span>
            </div>
          </div>

          {avisoGps && <p className={estilos.avisoGps}>{avisoGps}</p>}

          <div className={estilos.acoes}>
            {cron.estado === 'gravando' ? (
              <Btn label="Pausar" variant="outline" icone={Pause} onClick={cron.pausar} />
            ) : (
              <Btn label="Retomar" variant="outline" icone={Play} onClick={cron.retomar} />
            )}
            <Btn label="Encerrar" icone={Square} onClick={encerrarCronometro} />
          </div>
        </Card>
      ) : (
        <Card className={estilos.cartao}>
          <h2 className={estilos.tituloCartao}>Quanto você jogou hoje?</h2>
          <p className={estilos.subtitulo}>
            Deixe o cronômetro correndo durante o jogo. Se o navegador tiver GPS, o trajeto dentro
            da quadra vem junto — e se não tiver, o tempo conta do mesmo jeito.
          </p>
          <Btn label="Começar a jogar" icone={Timer} full onClick={cron.iniciar} />
          <button type="button" onClick={abrirManual} className={estilos.linkSecundario}>
            Já joguei — registrar na mão
          </button>
          {salvo && <p className={estilos.salvo}>Atividade salva.</p>}
        </Card>
      )}

      {/* (b) HISTÓRICO */}
      <Secao className={estilos.secao}>Seu histórico</Secao>
      <CourtLine className={estilos.divisor} />

      {carregando ? (
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      ) : historico.length === 0 ? (
        <p className={estilos.vazio}>
          Nada registrado ainda. O primeiro jogo cronometrado abre a sua série — e é a série que
          fica interessante, não o número de hoje.
        </p>
      ) : (
        <ul className={estilos.lista}>
          {historico.map((a) => {
            const pontosRota = pontosDoGeoJson(a.rota);
            return (
              <li key={a.id} className={estilos.item}>
                <div className={estilos.itemTopo}>
                  <span className={estilos.itemData}>{quando(a.inicio)}</span>
                  {a.esforco && <Pill label={a.esforco} tone={TOM_ESFORCO[a.esforco]} />}
                  {!a.compartilhar_no_feed && (
                    <Lock
                      size={13}
                      aria-label="Atividade privada"
                      className={estilos.cadeado}
                    />
                  )}
                </div>

                <div className={estilos.itemNumeros}>
                  <span className={estilos.itemDuracao}>{formatarDuracao(a.duracao_s)}</span>
                  {a.distancia_m !== null && (
                    <span className={estilos.itemMedida}>{formatarDistancia(a.distancia_m)}</span>
                  )}
                  {a.fc_media !== null && (
                    <span className={estilos.itemMedida}>{a.fc_media} bpm</span>
                  )}
                  {pontosRota >= 2 && (
                    <span className={estilos.itemTrajeto}>
                      <MapPin size={12} aria-hidden />
                      trajeto gravado
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Pagina>
  );
}
