import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CourtLine, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { faz } from '@/lib/datas';
import { apresentar, destino, grupoDoDia, marcarLidas, type Notificacao } from '@/lib/notificacoes';
import { supabase } from '@/lib/supabase';
import { colors, font, maxW, radius } from '@/theme/tokens';

export default function Notificacoes() {
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id;
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, tipo, payload_json, lida, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    setItens((data ?? []) as Notificacao[]);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Chegou notificação nova enquanto a tela está aberta: entra na lista.
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`notif-lista-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => setItens((prev) => [payload.new as Notificacao, ...prev]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid]);

  const naoLidas = itens.filter((n) => !n.lida).length;

  // Agrupa por "Hoje / Ontem / Esta semana / data", preservando a ordem.
  const grupos = useMemo(() => {
    const out: { titulo: string; itens: Notificacao[] }[] = [];
    for (const n of itens) {
      const titulo = grupoDoDia(n.created_at);
      const ultimo = out[out.length - 1];
      if (ultimo?.titulo === titulo) ultimo.itens.push(n);
      else out.push({ titulo, itens: [n] });
    }
    return out;
  }, [itens]);

  async function abrir(n: Notificacao) {
    if (!n.lida) {
      setItens((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      marcarLidas([n.id]);
    }
    const rota = destino(n);
    if (rota) router.push(rota as never);
  }

  async function lerTudo() {
    setItens((prev) => prev.map((n) => ({ ...n, lida: true })));
    await marcarLidas();
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.scroll}>
      <View style={[styles.container, { maxWidth: maxW }]}>
        <ScreenHeader title="Notificações" fallback="/inicio" />

        {naoLidas > 0 && (
          <Pressable onPress={lerTudo} style={({ hovered }: any) => [styles.lerTudo, hovered && { opacity: 0.75 }]}>
            <Text style={styles.lerTudoText}>Marcar todas como lidas ({naoLidas})</Text>
          </Pressable>
        )}

        <CourtLine color={colors.net} style={{ marginVertical: 18 }} />

        {loading ? (
          <ActivityIndicator color={colors.clay} style={{ marginTop: 30 }} />
        ) : itens.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell" size={22} color={colors.inkSoft} />
            <Text style={styles.emptyTitle}>Tudo em dia</Text>
            <Text style={styles.emptyText}>
              Solicitações, confirmações, mensagens do chat e lembretes das suas partidas aparecem aqui.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 22 }}>
            {grupos.map((g) => (
              <View key={g.titulo} style={{ gap: 10 }}>
                <Text style={styles.grupo}>{g.titulo.toUpperCase()}</Text>
                {g.itens.map((n) => {
                  const { icone, texto } = apresentar(n);
                  const clicavel = !!destino(n);
                  return (
                    <Pressable
                      key={n.id}
                      onPress={() => abrir(n)}
                      style={({ hovered }: any) => [
                        styles.row,
                        !n.lida && styles.rowUnread,
                        hovered && clicavel && { opacity: 0.9 },
                      ]}>
                      <View style={styles.rowIcon}>
                        <Feather name={icone} size={16} color={n.lida ? colors.inkSoft : colors.clay} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowText, !n.lida && { fontWeight: '600' }]}>{texto}</Text>
                        <Text style={styles.rowTime}>{faz(n.created_at)}</Text>
                      </View>
                      {!n.lida && <View style={styles.dot} />}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  scroll: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 48 },
  container: { width: '100%' },
  lerTudo: { alignSelf: 'flex-start', marginTop: 14 },
  lerTudoText: { fontFamily: font.body, fontWeight: '600', fontSize: 13, color: colors.clay },
  grupo: { fontFamily: font.mono, fontSize: 10.5, letterSpacing: 1.4, color: colors.inkSoft },
  empty: { alignItems: 'center', padding: 30 },
  emptyTitle: { fontFamily: font.display, fontWeight: '600', fontSize: 18, color: colors.ink, marginTop: 12 },
  emptyText: {
    fontFamily: font.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 400,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.net,
    padding: 14,
  },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: colors.clay },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.chalk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: colors.ink },
  rowTime: { fontFamily: font.mono, fontSize: 11, color: colors.inkSoft, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.clay },
});
