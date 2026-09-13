'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Avatar, Btn, Chips, CourtLine, Pagina, Segmented, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { GolpePreferido, MaoDominante } from '@/lib/database.types';
import { escolherFotoDePerfil, removerFotoDePerfil, trocarFotoDePerfil } from '@/lib/fotos';
import { capturarLocalizacao } from '@/lib/location';
import {
  carregarPrivacidade,
  OPCOES_FOTOS,
  OPCOES_PERFIL,
  PADRAO,
  salvarPrivacidade,
  SEMPRE_PROTEGIDO,
  type Privacidade,
  type Visibilidade,
} from '@/lib/privacidade';
import { supabase } from '@/lib/supabase';

import estilos from './editar-perfil.module.css';

const MAOS: { label: string; value: MaoDominante }[] = [
  { label: 'Destro', value: 'destro' },
  { label: 'Canhoto', value: 'canhoto' },
  { label: 'Ambidestro', value: 'ambidestro' },
];

const GOLPES: { label: string; value: GolpePreferido }[] = [
  { label: 'Forehand', value: 'forehand' },
  { label: 'Backhand', value: 'backhand' },
  { label: 'Saque', value: 'saque' },
  { label: 'Voleio', value: 'voleio' },
  { label: 'Smash', value: 'smash' },
];

export default function EditarPerfil() {
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoErro, setFotoErro] = useState<string | null>(null);
  const [mao, setMao] = useState<MaoDominante | null>(null);
  const [idade, setIdade] = useState('');
  const [altura, setAltura] = useState('');
  const [anos, setAnos] = useState('');
  const [golpe, setGolpe] = useState<GolpePreferido | null>(null);

  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const [privacidade, setPrivacidade] = useState<Privacidade>(PADRAO);
  const [privSalva, setPrivSalva] = useState(false);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    supabase
      .from('profiles')
      .select('nome, avatar_url, mao_dominante, idade, altura_cm, anos_jogando, golpe_preferido, cidade, uf')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (data) {
          setNome(data.nome ?? '');
          setAvatar(data.avatar_url ?? null);
          setMao(data.mao_dominante ?? null);
          setIdade(data.idade != null ? String(data.idade) : '');
          setAltura(data.altura_cm != null ? String(data.altura_cm) : '');
          setAnos(data.anos_jogando != null ? String(data.anos_jogando) : '');
          setGolpe(data.golpe_preferido ?? null);
          setCidade(data.cidade ?? '');
          setUf(data.uf ?? '');
        }
        setLoading(false);
      });
    carregarPrivacidade(uid).then(setPrivacidade);
  }, [session?.user.id]);

  /**
   * A privacidade é salva na hora, como a foto: é uma preferência de conta, e
   * esperar o "Salvar perfil" faria parecer que a escolha já valeu quando não
   * valeu.
   */
  async function mudarPrivacidade(campo: keyof Privacidade, valor: Visibilidade) {
    const uid = session?.user.id;
    if (!uid) return;
    const anterior = privacidade;
    const nova = { ...privacidade, [campo]: valor };
    setPrivacidade(nova);
    setPrivSalva(false);
    try {
      await salvarPrivacidade(uid, nova);
      setPrivSalva(true);
    } catch (e) {
      setPrivacidade(anterior);
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a privacidade.');
    }
  }

  /** A foto de perfil é salva na hora, não junto com o resto do formulário. */
  async function trocarFoto() {
    const uid = session?.user.id;
    if (!uid) return;
    setFotoErro(null);
    try {
      const foto = await escolherFotoDePerfil();
      if (!foto) return;
      setFotoBusy(true);
      setAvatar(await trocarFotoDePerfil(uid, foto, avatar));
    } catch (e) {
      setFotoErro(e instanceof Error ? e.message : 'Não foi possível trocar a foto.');
    } finally {
      setFotoBusy(false);
    }
  }

  async function removerFoto() {
    const uid = session?.user.id;
    if (!uid || !avatar) return;
    setFotoErro(null);
    setFotoBusy(true);
    try {
      await removerFotoDePerfil(uid, avatar);
      setAvatar(null);
    } catch (e) {
      setFotoErro(e instanceof Error ? e.message : 'Não foi possível remover a foto.');
    } finally {
      setFotoBusy(false);
    }
  }

  async function usarGps() {
    setGeoBusy(true);
    setGeoMsg(null);
    try {
      const loc = await capturarLocalizacao();
      setCoords({ lat: loc.lat, lng: loc.lng });
      if (loc.cidade) setCidade(loc.cidade);
      if (loc.uf) setUf(loc.uf);
      setGeoMsg(
        loc.cidade
          ? `${loc.cidade}${loc.uf ? '/' + loc.uf : ''} — localização capturada.`
          : 'Coordenadas capturadas. Confirme a cidade/UF abaixo.',
      );
    } catch (e) {
      setGeoMsg(e instanceof Error ? e.message : 'Não foi possível obter a localização.');
    } finally {
      setGeoBusy(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const uid = session?.user.id;
    if (!uid) return;

    if (!nome.trim()) {
      setErro('Informe seu nome.');
      return;
    }
    const nIdade = parseNum(idade);
    const nAltura = parseNum(altura);
    const nAnos = parseNum(anos);
    if (nIdade != null && (nIdade < 10 || nIdade > 100)) return setErro('Idade deve ficar entre 10 e 100.');
    if (nAltura != null && (nAltura < 100 || nAltura > 250))
      return setErro('Altura (cm) deve ficar entre 100 e 250.');
    if (nAnos != null && (nAnos < 0 || nAnos > 90)) return setErro('Anos jogando deve ficar entre 0 e 90.');

    setBusy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          mao_dominante: mao,
          idade: nIdade,
          altura_cm: nAltura,
          anos_jogando: nAnos,
          golpe_preferido: golpe,
          cidade: cidade.trim() || null,
          uf: uf.trim().toUpperCase() || null,
        })
        .eq('id', uid);
      if (error) throw error;

      if (coords) {
        const { error: e2 } = await supabase.rpc('definir_minha_localizacao', {
          lat: coords.lat,
          lng: coords.lng,
        });
        if (e2) throw e2;
      }
      router.replace('/perfil');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Pagina>
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <p className={estilos.eyebrow}>SEU PERFIL DE JOGADOR</p>
      <h2 className={estilos.title}>Como você joga?</h2>
      <p className={estilos.lede}>
        Essas informações ajudam a te parear com gente do seu nível e da sua região.
      </p>
      <CourtLine className={estilos.divisor} />

      <Grupo label="Foto de perfil">
        <div className={estilos.fotoLinha}>
          <button
            type="button"
            onClick={trocarFoto}
            disabled={fotoBusy}
            aria-label="Escolher foto de perfil"
            className={estilos.fotoBox}>
            <Avatar nome={nome} foto={avatar} size={72} />
            {fotoBusy && (
              <span className={estilos.fotoCarregando}>
                <Spinner />
              </span>
            )}
          </button>
          <div className={estilos.fotoTextos}>
            <button type="button" onClick={trocarFoto} disabled={fotoBusy} className={estilos.fotoAcao}>
              {avatar ? 'Trocar foto' : 'Escolher uma foto'}
            </button>
            {avatar && (
              <button type="button" onClick={removerFoto} disabled={fotoBusy} className={estilos.fotoRemover}>
                Remover foto
              </button>
            )}
            <p className={estilos.fotoDica}>Ela aparece nas partidas, no feed e no ranking.</p>
          </div>
        </div>
        {fotoErro && <p className={estilos.erro}>{fotoErro}</p>}
      </Grupo>

      <form onSubmit={salvar}>
        <Grupo label="Nome">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como te chamam na quadra"
            aria-label="Nome"
            autoComplete="name"
            className={estilos.input}
          />
        </Grupo>

        <Grupo label="Mão dominante">
          <Segmented options={MAOS} value={mao} onChange={setMao} label="Mão dominante" />
        </Grupo>

        <div className={estilos.row}>
          <Grupo label="Idade" className={estilos.flex1}>
            <input
              value={idade}
              onChange={(e) => setIdade(soDigitos(e.target.value))}
              placeholder="anos"
              inputMode="numeric"
              maxLength={3}
              aria-label="Idade"
              className={estilos.input}
            />
          </Grupo>
          <Grupo label="Altura (cm)" className={estilos.flex1}>
            <input
              value={altura}
              onChange={(e) => setAltura(soDigitos(e.target.value))}
              placeholder="ex: 178"
              inputMode="numeric"
              maxLength={3}
              aria-label="Altura em centímetros"
              className={estilos.input}
            />
          </Grupo>
        </div>

        <Grupo label="Nível — há quantos anos você joga?">
          <input
            value={anos}
            onChange={(e) => setAnos(soDigitos(e.target.value))}
            placeholder="ex: 3"
            inputMode="numeric"
            maxLength={2}
            aria-label="Anos jogando"
            className={estilos.input}
          />
        </Grupo>

        <Grupo label="Golpe preferido (seu mais forte)">
          <Chips options={GOLPES} value={golpe} onChange={setGolpe} label="Golpe preferido" />
        </Grupo>

        <CourtLine className={estilos.divisor} />
        <p className={estilos.eyebrow}>PRIVACIDADE</p>
        <p className={estilos.lede}>
          Você decide quem vê o quê. A regra vale no app inteiro — ranking, feed e partidas.
        </p>

        <Grupo label="Quem pode ver meu perfil">
          <Radios
            nome="visibilidade_perfil"
            opcoes={OPCOES_PERFIL}
            valor={privacidade.visibilidade_perfil}
            onChange={(v) => mudarPrivacidade('visibilidade_perfil', v)}
          />
        </Grupo>

        <Grupo label="Quem pode ver minhas fotos">
          <Radios
            nome="visibilidade_fotos"
            opcoes={OPCOES_FOTOS}
            valor={privacidade.visibilidade_fotos}
            onChange={(v) => mudarPrivacidade('visibilidade_fotos', v)}
          />
        </Grupo>

        <p className={estilos.privNota}>{SEMPRE_PROTEGIDO}</p>
        {privSalva && <p className={estilos.privSalvo}>Privacidade atualizada.</p>}

        <CourtLine className={estilos.divisor} />
        <p className={estilos.eyebrow}>LOCALIZAÇÃO</p>
        <p className={estilos.lede}>
          Usamos sua localização só para achar partidas num raio próximo. Ela fica privada.
        </p>

        <button type="button" onClick={usarGps} disabled={geoBusy} className={estilos.gps}>
          {geoBusy ? <Spinner /> : 'Usar minha localização'}
        </button>
        {geoMsg && <p className={estilos.geoMsg}>{geoMsg}</p>}

        <div className={`${estilos.row} ${estilos.rowLocal}`}>
          <Grupo label="Cidade" className={estilos.flex2}>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="ex: São Paulo"
              aria-label="Cidade"
              className={estilos.input}
            />
          </Grupo>
          <Grupo label="UF" className={estilos.flex1}>
            <input
              value={uf}
              onChange={(e) => setUf(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
              placeholder="SP"
              maxLength={2}
              aria-label="Unidade federativa"
              className={estilos.input}
            />
          </Grupo>
        </div>

        {erro && <p className={estilos.erro}>{erro}</p>}

        <Btn type="submit" label="Salvar perfil" loading={busy} full className={estilos.salvar} />
      </form>

      <Link href="/perfil" className={estilos.cancel}>
        Cancelar
      </Link>
    </Pagina>
  );
}

function Grupo({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={[estilos.grupo, className ?? ''].filter(Boolean).join(' ')}>
      <legend className={estilos.label}>{label}</legend>
      {children}
    </fieldset>
  );
}

/** Escolha única com a explicação junto: o rótulo sozinho não diz o que muda. */
function Radios({
  nome,
  opcoes,
  valor,
  onChange,
}: {
  nome: string;
  opcoes: { value: Visibilidade; label: string; explicacao: string }[];
  valor: Visibilidade;
  onChange: (v: Visibilidade) => void;
}) {
  return (
    <div className={estilos.privRadios}>
      {opcoes.map((o) => (
        <label key={o.value} className={estilos.privOpcao}>
          <input
            type="radio"
            name={nome}
            value={o.value}
            checked={valor === o.value}
            onChange={() => onChange(o.value)}
          />
          <span className={estilos.privTextos}>
            <span className={estilos.privLabel}>{o.label}</span>
            <span className={estilos.privExplicacao}>{o.explicacao}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

const soDigitos = (s: string) => s.replace(/[^0-9]/g, '');

function parseNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}
