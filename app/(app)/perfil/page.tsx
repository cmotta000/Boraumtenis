'use client';

import { Camera, LogOut, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { GradeFotos } from '@/components/galeria';
import { Avatar, Btn, CourtLine, Pagina, Secao, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { GolpePreferido, MaoDominante } from '@/lib/database.types';
import { escolherFotoDePerfil, trocarFotoDePerfil } from '@/lib/fotos';
import { carregarFeed } from '@/lib/posts';
import { supabase } from '@/lib/supabase';

import estilos from './perfil.module.css';

type Perfil = {
  nome: string;
  avatar_url: string | null;
  cidade: string | null;
  uf: string | null;
  pontos: number;
  vitorias: number;
  derrotas: number;
  mao_dominante: MaoDominante | null;
  idade: number | null;
  altura_cm: number | null;
  anos_jogando: number | null;
  golpe_preferido: GolpePreferido | null;
};

const MAO_LABEL: Record<MaoDominante, string> = {
  destro: 'Destro',
  canhoto: 'Canhoto',
  ambidestro: 'Ambidestro',
};
const GOLPE_LABEL: Record<GolpePreferido, string> = {
  forehand: 'Forehand',
  backhand: 'Backhand',
  saque: 'Saque',
  voleio: 'Voleio',
  smash: 'Smash',
};

/** Quantas fotos do jogador mostramos na galeria do perfil. */
const FOTOS_NA_GALERIA = 12;

export default function PerfilScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id;

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [trocandoFoto, setTrocandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('profiles')
      .select(
        'nome, avatar_url, cidade, uf, pontos, vitorias, derrotas, mao_dominante, idade, altura_cm, anos_jogando, golpe_preferido',
      )
      .eq('id', uid)
      .single();
    setPerfil(data as Perfil);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Galeria: as fotos dos posts do jogador, das mais novas para as mais antigas.
  useEffect(() => {
    if (!uid) return;
    carregarFeed({ userId: uid, limite: 20 })
      .then((posts) => setFotos(posts.flatMap((p) => p.fotos).slice(0, FOTOS_NA_GALERIA)))
      .catch(() => setFotos([]));
  }, [uid]);

  async function trocarFoto() {
    if (!uid) return;
    setErroFoto(null);
    try {
      const foto = await escolherFotoDePerfil();
      if (!foto) return;
      setTrocandoFoto(true);
      const caminho = await trocarFotoDePerfil(uid, foto, perfil?.avatar_url ?? null);
      setPerfil((p) => (p ? { ...p, avatar_url: caminho } : p));
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : 'Não foi possível trocar a foto.');
    } finally {
      setTrocandoFoto(false);
    }
  }

  async function sair() {
    setSaindo(true);
    await supabase.auth.signOut();
    router.replace('/');
  }

  const detalhes = perfil
    ? [
        { label: 'Mão dominante', value: perfil.mao_dominante ? MAO_LABEL[perfil.mao_dominante] : null },
        { label: 'Idade', value: perfil.idade != null ? `${perfil.idade} anos` : null },
        { label: 'Altura', value: perfil.altura_cm != null ? `${perfil.altura_cm} cm` : null },
        {
          label: 'Golpe preferido',
          value: perfil.golpe_preferido ? GOLPE_LABEL[perfil.golpe_preferido] : null,
        },
      ]
    : [];

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
      <div className={estilos.head}>
        <button
          type="button"
          onClick={trocarFoto}
          disabled={trocandoFoto}
          aria-label="Trocar foto de perfil"
          className={estilos.avatarBox}>
          <Avatar nome={perfil?.nome} foto={perfil?.avatar_url} size={78} />
          <span className={estilos.camera}>
            {trocandoFoto ? <Spinner size={14} /> : <Camera size={13} aria-hidden />}
          </span>
        </button>
        <div className={estilos.identidade}>
          <h2 className={estilos.nome}>{perfil?.nome}</h2>
          <p className={estilos.email}>{session?.user.email}</p>
          <button type="button" onClick={trocarFoto} disabled={trocandoFoto} className={estilos.trocarFoto}>
            {perfil?.avatar_url ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
          </button>
        </div>
      </div>
      {erroFoto && <p className={estilos.erro}>{erroFoto}</p>}

      <div className={estilos.stats}>
        <Stat label="Pontos" value={String(perfil?.pontos ?? 0)} destaque />
        <Stat label="Vitórias" value={String(perfil?.vitorias ?? 0)} />
        <Stat label="Derrotas" value={String(perfil?.derrotas ?? 0)} />
      </div>
      <div className={`${estilos.stats} ${estilos.statsSegunda}`}>
        <Stat
          label="Experiência"
          value={
            perfil?.anos_jogando != null
              ? `${perfil.anos_jogando} ${perfil.anos_jogando === 1 ? 'ano' : 'anos'}`
              : 'a definir'
          }
        />
        <Stat
          label="Cidade"
          value={perfil?.cidade ? `${perfil.cidade}${perfil.uf ? '/' + perfil.uf : ''}` : 'a definir'}
        />
      </div>

      <CourtLine className={estilos.divisor} />

      <Secao>Características</Secao>
      <div className={estilos.detailCard}>
        {detalhes.map((d) => (
          <div key={d.label} className={estilos.detailRow}>
            <span className={estilos.detailLabel}>{d.label}</span>
            <span className={`${estilos.detailValue} ${d.value ? '' : estilos.detailEmpty}`}>
              {d.value ?? 'a definir'}
            </span>
          </div>
        ))}
      </div>

      <CourtLine className={estilos.divisor} />

      <div className={estilos.galeriaHead}>
        <Secao className={estilos.semMargem}>Suas fotos</Secao>
        <Link href="/feed" className={estilos.verFeed}>
          Ver no feed
        </Link>
      </div>
      {fotos.length > 0 ? (
        <GradeFotos fotos={fotos} />
      ) : (
        <p className={estilos.semFotos}>
          Você ainda não publicou fotos. Depois do próximo jogo, publique os melhores momentos no feed.
        </p>
      )}

      <div className={estilos.acoes}>
        <Link href="/editar-perfil" className={estilos.linkBotao}>
          <Pencil size={16} aria-hidden />
          Editar perfil
        </Link>
        <Btn
          label={saindo ? 'Saindo…' : 'Sair da conta'}
          variant="outline"
          icone={LogOut}
          onClick={sair}
          loading={saindo}
        />
      </div>
    </Pagina>
  );
}

/** Números ganham a fonte mono (tabular); texto fica na fonte de leitura. */
const ehNumero = (v: string) => /^[\d.,%+\-–—\s]+$/.test(v);

function Stat({ label, value, destaque }: { label: string; value: string; destaque?: boolean }) {
  return (
    <div className={`${estilos.stat} ${destaque ? estilos.statDestaque : ''}`}>
      <p className={estilos.statLabel}>{label}</p>
      <p className={`${estilos.statValue} ${ehNumero(value) ? '' : estilos.statValueTexto}`}>{value}</p>
    </div>
  );
}
