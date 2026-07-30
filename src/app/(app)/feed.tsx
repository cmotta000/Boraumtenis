import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GaleriaFotos } from '@/components/galeria';
import { Compositor } from '@/components/publicar';
import { Avatar, Placar } from '@/components/ui';
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
import { colors, elev, font, radius } from '@/theme/tokens';

export default function Feed() {
  const { perfil, userId } = useMeuPerfil();
  const [posts, setPosts] = useState<PostFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  async function onRefresh() {
    setRefreshing(true);
    setAcabou(false);
    await carregar();
    setRefreshing(false);
  }

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
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clay} />}>
      <View style={styles.container}>
        {userId && (
          <View style={{ marginBottom: 16 }}>
            <Compositor
              userId={userId}
              nome={perfil?.nome}
              avatar={perfil?.avatar_url}
              onPublicado={() => carregar()}
            />
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.clay} style={{ marginTop: 40 }} />
        ) : posts.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="camera" size={22} color={colors.inkSoft} />
            <Text style={styles.emptyTitle}>Nada por aqui ainda</Text>
            <Text style={styles.emptyText}>
              Publique as fotos do seu último jogo — e todo resultado confirmado também vira um post aqui, com
              placar e pontos.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onExcluido={() => removerDaLista(p.id)} />
            ))}

            {!acabou && (
              <Pressable
                onPress={maisAntigos}
                disabled={carregandoMais}
                style={({ hovered }: any) => [styles.mais, hovered && { opacity: 0.8 }]}>
                <Text style={styles.maisText}>{carregandoMais ? 'Carregando…' : 'Ver posts mais antigos'}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
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

  async function comentar() {
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
    <View style={styles.post}>
      {/* Cabeçalho: quem publicou */}
      <View style={styles.postHead}>
        <Avatar nome={post.autor_nome} foto={post.autor_avatar} size={44} />
        <View style={{ flex: 1 }}>
          {ehResultado ? (
            <Text style={styles.postNome}>
              {venceu} <Text style={styles.postVerbo}>venceu</Text> {perdeu}
            </Text>
          ) : (
            <Text style={styles.postNome}>{post.autor_nome}</Text>
          )}
          <Text style={styles.postMeta}>
            {ehResultado
              ? `${post.local_texto ?? 'Partida de tênis'} · ${quando(post.data_hora ?? post.created_at)}`
              : [post.local_texto, publicadoEm].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {post.posso_editar && (
          <Pressable
            onPress={apagar}
            disabled={excluindo}
            accessibilityLabel="Excluir publicação"
            style={({ hovered }: any) => [styles.excluir, hovered && { opacity: 0.6 }]}>
            <Feather name={excluindo ? 'more-horizontal' : 'trash-2'} size={15} color={colors.inkSoft} />
          </Pressable>
        )}
      </View>

      {/* Placar (só em posts de resultado) */}
      {ehResultado && (
        <View style={{ marginTop: 14 }}>
          <Placar
            vencedores={post.vencedores}
            perdedores={post.perdedores}
            sets={post.sets ?? []}
            pontos={post.pontos}
          />
        </View>
      )}

      {post.legenda ? <Text style={styles.legenda}>{post.legenda}</Text> : null}

      <GaleriaFotos fotos={post.fotos} />

      {/* Ações */}
      <View style={styles.acoes}>
        <Pressable
          onPress={alternarCurtida}
          accessibilityRole="button"
          accessibilityLabel={curti ? 'Remover curtida' : 'Curtir'}
          style={({ hovered }: any) => [styles.acao, hovered && { opacity: 0.7 }]}>
          <Feather name="heart" size={16} color={curti ? colors.clay : colors.inkSoft} />
          <Text style={[styles.acaoText, curti && { color: colors.clay, fontWeight: '600' }]}>{curtidas}</Text>
        </Pressable>
        <Pressable
          onPress={abrirComentarios}
          accessibilityRole="button"
          accessibilityLabel="Ver comentários"
          style={({ hovered }: any) => [styles.acao, hovered && { opacity: 0.7 }]}>
          <Feather name="message-circle" size={16} color={colors.inkSoft} />
          <Text style={styles.acaoText}>{total}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {post.match_id && (
          <Pressable
            onPress={() => router.push(`/partida/${post.match_id}` as never)}
            accessibilityRole="link"
            style={({ hovered }: any) => [styles.verPartidaBox, hovered && { opacity: 0.7 }]}>
            <Text style={styles.verPartida}>Ver partida</Text>
            <Feather name="arrow-right" size={14} color={colors.clay} />
          </Pressable>
        )}
      </View>

      {ehResultado && souVencedor && (
        <Text style={styles.suaVitoria}>Sua vitória · {post.pontos} pontos na temporada</Text>
      )}

      {/* Comentários */}
      {abertos && (
        <View style={styles.comentarios}>
          {comentarios.map((c) => (
            <View key={c.id} style={styles.comentario}>
              <Avatar nome={c.nome} foto={c.avatar} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={styles.comentarioNome}>
                  {c.nome} <Text style={styles.comentarioTempo}>· {faz(c.created_at)}</Text>
                </Text>
                <Text style={styles.comentarioTexto}>{c.texto}</Text>
              </View>
            </View>
          ))}
          <View style={styles.comentarInput}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder={ehResultado ? 'Comente esse jogo…' : 'Deixe um comentário…'}
              placeholderTextColor={colors.inkSoft}
              maxLength={500}
              style={styles.comentarCampo}
              onSubmitEditing={comentar}
              returnKeyType="send"
            />
            <Pressable
              onPress={comentar}
              disabled={!texto.trim() || enviando}
              style={({ hovered }: any) => [
                styles.comentarBtn,
                (!texto.trim() || enviando) && { opacity: 0.4 },
                hovered && { opacity: 0.9 },
              ]}>
              <Text style={styles.comentarBtnText}>↑</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  scroll: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 48 },
  container: { width: '100%', maxWidth: 720 },
  empty: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
  },
  emptyTitle: { fontFamily: font.display, fontWeight: '600', fontSize: 18, color: colors.ink, marginTop: 12 },
  emptyText: {
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 420,
  },
  post: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 18,
    ...elev.card,
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  postNome: { fontFamily: font.body, fontWeight: '600', fontSize: 15, color: colors.ink, lineHeight: 21 },
  postVerbo: { fontWeight: '400', color: colors.inkSoft },
  postMeta: { fontFamily: font.body, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  excluir: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  legenda: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: colors.ink, marginTop: 14 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 16 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  acaoText: { fontFamily: font.mono, fontSize: 12.5, color: colors.inkSoft },
  verPartidaBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verPartida: { fontFamily: font.body, fontWeight: '600', fontSize: 13, color: colors.clay },
  suaVitoria: { fontFamily: font.body, fontSize: 12.5, color: colors.ok, fontWeight: '500', marginTop: 12 },
  comentarios: { marginTop: 16, gap: 12, borderTopWidth: 1, borderTopColor: colors.net, paddingTop: 14 },
  comentario: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  comentarioNome: { fontFamily: font.body, fontWeight: '600', fontSize: 13, color: colors.ink },
  comentarioTempo: { fontFamily: font.mono, fontSize: 10.5, fontWeight: '400', color: colors.inkSoft },
  comentarioTexto: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 2 },
  comentarInput: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  comentarCampo: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.net,
    paddingHorizontal: 12,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  comentarBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.court,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comentarBtnText: { color: colors.courtText, fontSize: 17, fontWeight: '600', marginTop: -2 },
  mais: {
    alignSelf: 'center',
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.net,
    backgroundColor: colors.card,
  },
  maisText: { fontFamily: font.body, fontWeight: '600', fontSize: 13.5, color: colors.ink },
});
