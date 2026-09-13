'use client';

import { Crosshair, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { MiniMap } from '@/components/mini-map';
import { Btn, CourtLine, Pagina, ScreenHeader, Segmented, Spinner } from '@/components/ui';
import { combinar, dataCurta, gradeHorarios, proximosDias, rotuloDia } from '@/lib/datas';
import type { MatchTipo } from '@/lib/database.types';
import { buscarLocais, reverseGeocode, type Local } from '@/lib/geocode';
import { capturarLocalizacao } from '@/lib/location';
import { supabase } from '@/lib/supabase';

import estilos from './criar-partida.module.css';

const TIPOS: { label: string; value: MatchTipo }[] = [
  { label: 'Simples (1x1)', value: 'simples' },
  { label: 'Duplas (2x2)', value: 'duplas' },
];

const HORARIOS = gradeHorarios(6, 22, 30);

export default function CriarPartida() {
  const router = useRouter();
  const dias = useMemo(() => proximosDias(14), []);

  const [local, setLocal] = useState('');
  const [descricaoLocal, setDescricaoLocal] = useState<string | null>(null);
  const [tipo, setTipo] = useState<MatchTipo>('simples');
  const [diaIdx, setDiaIdx] = useState(0);
  const [hora, setHora] = useState<string | null>(null);
  const [vagas, setVagas] = useState(2);
  const [obs, setObs] = useState('');

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const [sugestoes, setSugestoes] = useState<Local[]>([]);
  const [buscando, setBuscando] = useState(false);
  const selecionouRef = useRef(false);

  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Busca de endereço com autocomplete (debounce), enviesada pela posição atual.
  useEffect(() => {
    if (selecionouRef.current) {
      selecionouRef.current = false;
      return;
    }
    const termo = local.trim();
    if (termo.length < 3) {
      setSugestoes([]);
      setBuscando(false);
      return;
    }
    const ctrl = new AbortController();
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const res = await buscarLocais(termo, coords ?? undefined, ctrl.signal);
        setSugestoes(res);
      } catch {
        // ignora (abort ou rede)
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [local, coords]);

  function escolherLocal(l: Local) {
    selecionouRef.current = true;
    setLocal(l.nome);
    setDescricaoLocal(l.descricao || null);
    setCoords({ lat: l.lat, lng: l.lng });
    setSugestoes([]);
    setGeoMsg(null);
  }

  function escolherTipo(t: MatchTipo) {
    setTipo(t);
    setVagas(t === 'duplas' ? 4 : 2);
  }

  async function usarGps() {
    setGeoBusy(true);
    setGeoMsg(null);
    try {
      const loc = await capturarLocalizacao();
      setCoords({ lat: loc.lat, lng: loc.lng });
      setSugestoes([]);
      try {
        const end = await reverseGeocode(loc.lat, loc.lng);
        selecionouRef.current = true; // evita reabrir a busca ao preencher o nome
        setLocal(end.nome);
        setDescricaoLocal(end.descricao || null);
        setGeoMsg('Estou aqui — ajuste o nome do local se quiser.');
      } catch {
        setGeoMsg('Localização capturada. Dê um nome ao local acima.');
      }
    } catch (e) {
      setGeoMsg(e instanceof Error ? e.message : 'Não foi possível obter a localização.');
    } finally {
      setGeoBusy(false);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!local.trim()) return setErro('Diga onde vai ser a partida (nome da quadra/local).');
    if (!hora) return setErro('Escolha um horário.');
    if (!coords) return setErro('Toque em “Usar minha localização” para marcar onde é a partida.');

    const data_hora = combinar(dias[diaIdx], hora);
    if (new Date(data_hora).getTime() <= Date.now()) {
      return setErro('Esse horário já passou. Escolha outro.');
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('criar_partida', {
        p_local_texto: local.trim(),
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_data_hora: data_hora,
        p_tipo: tipo,
        p_vagas_total: vagas,
        p_observacoes: obs.trim() || null,
      });
      if (error) throw error;
      router.replace(`/partida/${data as string}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a partida. Tente de novo.');
      setBusy(false);
    }
  }

  return (
    <Pagina>
      <ScreenHeader title="Criar partida" fallback="/partidas" />
      <p className={estilos.lede}>
        Abra um jogo e deixe a galera do seu nível pedir pra entrar. Você confirma quem joga.
      </p>
      <CourtLine className={estilos.divisor} />

      <form onSubmit={criar}>
        <Grupo label="Onde vai ser?">
          <div className={estilos.searchRow}>
            <input
              value={local}
              onChange={(e) => {
                setLocal(e.target.value);
                setCoords(null);
                setDescricaoLocal(null);
              }}
              placeholder="Busque a quadra, o parque, o endereço…"
              aria-label="Local da partida"
              className={estilos.input}
            />
            <button
              type="button"
              onClick={usarGps}
              disabled={geoBusy}
              aria-label="Usar minha localização"
              className={estilos.gpsMini}>
              {geoBusy ? <Spinner size={17} /> : <Crosshair size={17} aria-hidden />}
            </button>
          </div>

          {buscando && <p className={estilos.searchHint}>Buscando…</p>}
          {sugestoes.length > 0 && (
            <div className={estilos.suggestBox}>
              {sugestoes.map((s, i) => (
                <button
                  key={`${s.lat},${s.lng},${i}`}
                  type="button"
                  onClick={() => escolherLocal(s)}
                  className={estilos.suggestRow}>
                  <MapPin size={15} aria-hidden />
                  <span className={estilos.suggestCorpo}>
                    <span className={estilos.suggestNome} style={{ display: 'block' }}>
                      {s.nome}
                    </span>
                    {!!s.descricao && (
                      <span className={estilos.suggestDesc} style={{ display: 'block' }}>
                        {s.descricao}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          {geoMsg && <p className={estilos.geoMsg}>{geoMsg}</p>}

          {coords && (
            <div className={estilos.mapa}>
              <MiniMap lat={coords.lat} lng={coords.lng} />
              <p className={estilos.confirmRow}>
                <span className={estilos.confirmPin} aria-hidden>
                  ✓
                </span>
                <span className={estilos.confirmText}>
                  {local}
                  {descricaoLocal ? ` · ${descricaoLocal}` : ''}
                </span>
              </p>
            </div>
          )}
        </Grupo>

        <Grupo label="Tipo de jogo">
          <div className={estilos.escolhaCurta}>
            <Segmented options={TIPOS} value={tipo} onChange={escolherTipo} label="Tipo de jogo" />
          </div>
        </Grupo>

        <Grupo label="Dia">
          <div className={estilos.hRow}>
            {dias.map((d, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === diaIdx}
                onClick={() => setDiaIdx(i)}
                className={estilos.dayChip}>
                <span className={estilos.dayChipTop}>{rotuloDia(d, i)}</span>
                <span className={estilos.dayChipSub}>{dataCurta(d)}</span>
              </button>
            ))}
          </div>
        </Grupo>

        <Grupo label="Horário">
          <div className={estilos.hRow}>
            {HORARIOS.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={h === hora}
                onClick={() => setHora(h)}
                className={estilos.timeChip}>
                {h}
              </button>
            ))}
          </div>
        </Grupo>

        <Grupo label="Vagas (contando você)">
          <div className={estilos.escolhaEstreita}>
            <Segmented
              options={[
                { label: '2', value: '2' },
                { label: '3', value: '3' },
                { label: '4', value: '4' },
              ]}
              value={String(vagas)}
              onChange={(v) => setVagas(Number(v))}
              label="Número de vagas"
            />
          </div>
        </Grupo>

        <Grupo label="Observações (opcional)">
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Nível, se leva bolas, valor da quadra rachado…"
            aria-label="Observações"
            className={`${estilos.input} ${estilos.textarea}`}
          />
        </Grupo>

        {erro && <p className={estilos.erro}>{erro}</p>}

        <Btn type="submit" label="Publicar partida" loading={busy} full className={estilos.publicar} />
      </form>
    </Pagina>
  );
}

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className={estilos.grupo}>
      <legend className={estilos.label}>{label}</legend>
      {children}
    </fieldset>
  );
}
