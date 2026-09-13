'use client';

import { ArrowRight, Camera, Heart, MessageCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { GaleriaFotos } from '@/components/galeria';
import { Compositor } from '@/components/publicar';
import { Avatar, Pagina, Placar, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { faz, quando } from '@/lib/datas';
import { useMeuPerfil } from '@/lib/perfil';
import {
  carregarFeed,
  comentariosDoPost,
  comentarNoPost,
  curtirPost,
  excluirPost,
  PAGINA_FEED,
  type ComentarioPost,
  type PostFeed,
} from '@/lib/posts';

import estilos from './feed.module.css';

export default function Feed() {
  const { perfil, userId } = useMeuPerfil();
  const [posts, setPosts] = useState<PostFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [acabou, setAcabou] = useState(false);

  const carregar = useCallback(async (antes?: string) => {
    const novos = await carregarFeed({ antes });
    setAcabou(novos.length < PAGINA_FEED);
    setPosts((prev) => (antes ? [...prev, ...novos] : novos));
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function maisAntigos() {
    const ultimo = posts[posts.length - 1];
    if (!ultimo) return;
    setCarregandoMais(true);
    await carregar(ultimo.created_at);
    setCarregandoMais(false);
  }

  function removerDaLista(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <Pagina estreita>
      {userId && (
        <div className={estilos.compositor}>
          <Compositor
            userId={userId}
            nome={perfil?.nome}
            avatar={perfil?.avatar_url}
            onPublicado={() => carregar()}
          />
        </div>
      )}

      {loading ? (
        <div className={estilos.carregando}>
          <Spinner size={24} />
        </div>
      ) : posts.length === 0 ? (
        <div className={estilos.empty}>
          <Camera size={22} aria-hidden />
          <p className={estilos.emptyTitle}>Nada por aqui ainda</p>
          <p className={estilos.emptyText}>
            Publique as fotos do seu último jogo — e todo resultado confirmado também vira um post aqui, com
            placar e pontos.
          </p>
        </div>
      ) : (
        <div className={estilos.lista}>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onExcluido={() => removerDaLista(p.id)} />
          ))}

          {!acabou && (
            <button type="button" onClick={maisAntigos} disabled={carregandoMais} className={estilos.mais}>
              {carregandoMais ? 'Carregando…' : 'Ver posts mais antigos'}
            </button>
          )}
        </div>
      )}
    </Pagina>
  );
}

/**
 * Card do feed. Dois formatos, mesmo esqueleto: um resultado de partida (com
 * placar e pontos) ou uma publicação de fotos.
 */
function PostCard({ post, onExcluido }: { post: PostFeed; onExcluido?: () => void }) {
  const { session } = useAuth();
  const router = useRouter();
  const me = session?.user.id;

  const [curti, setCurti] = useState(post.eu_curti);
  const [curtidas, setCurtidas] = useState(post.curtidas);
  const [abertos, setAbertos] = useState(false);
  const [comentarios, setComentarios] = useState<ComentarioPost[]>([]);
  const [total, setTotal] = useState(post.comentarios);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const ehResultado = post.post_tipo === 'resultado';
  const idade = faz(post.created_at);
  const publicadoEm = idade === 'agora' ? 'agora mesmo' : `há ${idade}`;
  const venceu = post.vencedores.map((v) => v.nome).join(' e ');
  const perdeu = post.perdedores.map((v) => v.nome).join(' e ');
  const souVencedor = post.vencedores.some((v) => v.id === me);

  async function alternarCurtida() {
    const novo = !curti;
    setCurti(novo);
    setCurtidas((n) => n + (novo ? 1 : -1));
    try {
      await curtirPost(post.id, novo);
    } catch {
      setCurti(!novo);
      setCurtidas((n) => n + (novo ? -1 : 1));
    }
  }

  async function abrirComentarios() {
    setAbertos((v) => !v);
    if (comentarios.length === 0) {
      try {
        setComentarios(await comentariosDoPost(post.id));
      } catch {
        /* silencioso: a lista continua fechada e o usuário pode tentar de novo */
      }
    }
  }

  async function comentar(e?: React.FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      setComentarios(await comentarNoPost(post.id, t));
      setTexto('');
      setTotal((n) => n + 1);
    } catch {
      /* mantém o texto no campo para o usuário tentar de novo */
    } finally {
      setEnviando(false);
    }
  }

  async function apagar() {
    setExcluindo(true);
    try {
      await excluirPost(post.id);
      onExcluido?.();
    } catch {
      setExcluindo(false);
    }
  }

  return (
    <article className={estilos.post}>
      {/* Cabeçalho: quem publicou */}
      <div className={estilos.postHead}>
        <Avatar nome={post.autor_nome} foto={post.autor_avatar} size={44} />
        <div className={estilos.postIdentidade}>
          {ehResultado ? (
            <p className={estilos.postNome}>
              {venceu} <span className={estilos.postVerbo}>venceu</span> {perdeu}
            </p>
          ) : (
            <p className={estilos.postNome}>{post.autor_nome}</p>
          )}
          <p className={estilos.postMeta}>
            {ehResultado
              ? `${post.local_texto ?? 'Partida de tênis'} · ${quando(post.data_hora ?? post.created_at)}`
              : [post.local_texto, publicadoEm].filter(Boolean).join(' · ')}
          </p>
        </div>
        {post.posso_editar && (
          <button
            type="button"
            onClick={apagar}
            disabled={excluindo}
            aria-label="Excluir publicação"
            className={estilos.excluir}>
            {excluindo ? <MoreHorizontal size={15} aria-hidden /> : <Trash2 size={15} aria-hidden />}
          </button>
        )}
      </div>

      {/* Placar (só em posts de resultado) */}
      {ehResultado && (
        <div className={estilos.placar}>
          <Placar
            vencedores={post.vencedores}
            perdedores={post.perdedores}
            sets={post.sets ?? []}
            pontos={post.pontos}
          />
        </div>
      )}

      {post.legenda ? <p className={estilos.legenda}>{post.legenda}</p> : null}

      <GaleriaFotos fotos={post.fotos} />

      {/* Ações */}
      <div className={estilos.acoes}>
        <button
          type="button"
          onClick={alternarCurtida}
          aria-label={curti ? 'Remover curtida' : 'Curtir'}
          aria-pressed={curti}
          className={`${estilos.acao} ${curti ? estilos.acaoCurtida : ''}`}>
          <Heart size={16} aria-hidden fill={curti ? 'currentColor' : 'none'} />
          {curtidas}
        </button>
        <button
          type="button"
          onClick={abrirComentarios}
          aria-expanded={abertos}
          aria-label="Ver comentários"
          className={estilos.acao}>
          <MessageCircle size={16} aria-hidden />
          {total}
        </button>
        <span className={estilos.espaco} />
        {post.match_id && (
          <button
            type="button"
            onClick={() => router.push(`/partida/${post.match_id}`)}
            className={estilos.verPartidaBox}>
            Ver partida
            <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </div>

      {ehResultado && souVencedor && (
        <p className={estilos.suaVitoria}>Sua vitória · {post.pontos} pontos na temporada</p>
      )}

      {/* Comentários */}
      {abertos && (
        <div className={estilos.comentarios}>
          {comentarios.map((c) => (
            <div key={c.id} className={estilos.comentario}>
              <Avatar nome={c.nome} foto={c.avatar} size={30} />
              <div className={estilos.comentarioCorpo}>
                <p className={estilos.comentarioNome}>
                  {c.nome} <span className={estilos.comentarioTempo}>· {faz(c.created_at)}</span>
                </p>
                <p className={estilos.comentarioTexto}>{c.texto}</p>
              </div>
            </div>
          ))}
          <form onSubmit={comentar} className={estilos.comentarInput}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={ehResultado ? 'Comente esse jogo…' : 'Deixe um comentário…'}
              maxLength={500}
              aria-label="Escrever comentário"
              className={estilos.comentarCampo}
            />
            <button
              type="submit"
              disabled={!texto.trim() || enviando}
              aria-label="Enviar comentário"
              className={estilos.comentarBtn}>
              ↑
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
