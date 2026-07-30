import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MiniMap } from '@/components/mini-map';
import { Btn, CourtLine, ScreenHeader, Segmented } from '@/components/ui';
import { combinar, dataCurta, gradeHorarios, proximosDias, rotuloDia } from '@/lib/datas';
import type { MatchTipo } from '@/lib/database.types';
import { buscarLocais, reverseGeocode, type Local } from '@/lib/geocode';
import { capturarLocalizacao } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import { colors, font, maxW, radius } from '@/theme/tokens';

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
    } catch (e: any) {
      setGeoMsg(e?.message ?? 'Não foi possível obter a localização.');
    } finally {
      setGeoBusy(false);
    }
  }

  async function criar() {
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
      router.replace(`/partida/${data as string}` as never);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível criar a partida. Tente de novo.');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.container, { maxWidth: maxW }]}>
          <ScreenHeader title="Criar partida" fallback="/partidas" />
          <Text style={styles.lede}>
            Abra um jogo e deixe a galera do seu nível pedir pra entrar. Você confirma quem joga.
          </Text>
          <CourtLine color={colors.net} style={{ marginVertical: 20 }} />

          <Group label="Onde vai ser?">
            <View style={styles.searchRow}>
              <TextInput
                value={local}
                onChangeText={(t) => {
                  setLocal(t);
                  setCoords(null);
                  setDescricaoLocal(null);
                }}
                placeholder="Busque a quadra, o parque, o endereço…"
                placeholderTextColor={colors.inkSoft}
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable
                onPress={usarGps}
                disabled={geoBusy}
                style={({ hovered, pressed }: any) => [
                  styles.gpsMini,
                  (hovered || pressed) && { opacity: 0.9 },
                  geoBusy && { opacity: 0.6 },
                ]}>
                {geoBusy ? (
                  <ActivityIndicator color={colors.card} size="small" />
                ) : (
                  <Feather name="crosshair" size={17} color={colors.card} />
                )}
              </Pressable>
            </View>

            {buscando && <Text style={styles.searchHint}>Buscando…</Text>}
            {sugestoes.length > 0 && (
              <View style={styles.suggestBox}>
                {sugestoes.map((s, i) => (
                  <Pressable
                    key={`${s.lat},${s.lng},${i}`}
                    onPress={() => escolherLocal(s)}
                    style={({ hovered }: any) => [
                      styles.suggestRow,
                      i > 0 && styles.suggestDivider,
                      hovered && { backgroundColor: colors.chalk },
                    ]}>
                    <Feather name="map-pin" size={15} color={colors.inkSoft} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestNome} numberOfLines={1}>
                        {s.nome}
                      </Text>
                      {!!s.descricao && (
                        <Text style={styles.suggestDesc} numberOfLines={1}>
                          {s.descricao}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            {geoMsg && <Text style={styles.geoMsg}>{geoMsg}</Text>}

            {coords && (
              <View style={{ marginTop: 12 }}>
                <MiniMap lat={coords.lat} lng={coords.lng} />
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmPin}>✓</Text>
                  <Text style={styles.confirmText} numberOfLines={2}>
                    {local}
                    {descricaoLocal ? ` · ${descricaoLocal}` : ''}
                  </Text>
                </View>
              </View>
            )}
          </Group>

          <Group label="Tipo de jogo">
            <View style={styles.escolhaCurta}>
              <Segmented options={TIPOS} value={tipo} onChange={escolherTipo} />
            </View>
          </Group>

          <Group label="Dia">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {dias.map((d, i) => {
                const active = i === diaIdx;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setDiaIdx(i)}
                    style={[styles.dayChip, active && styles.chipActive]}>
                    <Text style={[styles.dayChipTop, active && styles.chipTextActive]}>
                      {rotuloDia(d, i)}
                    </Text>
                    <Text style={[styles.dayChipSub, active && styles.chipTextActive]}>{dataCurta(d)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Group>

          <Group label="Horário">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {HORARIOS.map((h) => {
                const active = h === hora;
                return (
                  <Pressable
                    key={h}
                    onPress={() => setHora(h)}
                    style={[styles.timeChip, active && styles.chipActive]}>
                    <Text style={[styles.timeChipText, active && styles.chipTextActive]}>{h}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Group>

          <Group label="Vagas (contando você)">
            <View style={styles.escolhaEstreita}>
              <Segmented
                options={[
                  { label: '2', value: '2' },
                  { label: '3', value: '3' },
                  { label: '4', value: '4' },
                ]}
                value={String(vagas)}
                onChange={(v) => setVagas(Number(v))}
              />
            </View>
          </Group>

          <Group label="Observações (opcional)">
            <TextInput
              value={obs}
              onChangeText={setObs}
              placeholder="Nível, se leva bolas, valor da quadra rachado…"
              placeholderTextColor={colors.inkSoft}
              multiline
              style={[styles.input, styles.textarea]}
            />
          </Group>

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Btn label="Publicar partida" onPress={criar} loading={busy} full style={{ marginTop: 22 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  scroll: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 56 },
  container: { width: '100%' },
  lede: { color: colors.inkSoft, fontFamily: font.body, fontSize: 14.5, lineHeight: 21, marginTop: 12 },
  escolhaCurta: { maxWidth: 420 },
  escolhaEstreita: { maxWidth: 240 },
  label: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.inkSoft,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.net,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  textarea: { height: 96, textAlignVertical: 'top' },
  hRow: { gap: 9, paddingVertical: 2, paddingRight: 8 },
  dayChip: {
    minWidth: 66,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.net,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  dayChipTop: { fontFamily: font.body, fontWeight: '700', fontSize: 14, color: colors.ink },
  dayChipSub: { fontFamily: font.mono, fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  timeChip: {
    paddingHorizontal: 15,
    height: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.net,
    backgroundColor: '#fff',
  },
  timeChipText: { fontFamily: font.mono, fontWeight: '700', fontSize: 15, color: colors.ink },
  chipActive: { backgroundColor: colors.clay, borderColor: colors.clay },
  chipTextActive: { color: colors.chalk },
  // busca de local
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  gpsMini: {
    width: 50,
    borderRadius: radius.sm,
    backgroundColor: colors.clay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsMiniText: { fontSize: 20 },
  searchHint: { color: colors.inkSoft, fontFamily: font.mono, fontSize: 12, marginTop: 8 },
  suggestBox: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.net,
    overflow: 'hidden',
  },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  suggestDivider: { borderTopWidth: 1, borderTopColor: colors.net },
  suggestPin: { fontSize: 16 },
  suggestNome: { fontFamily: font.body, fontWeight: '700', fontSize: 15, color: colors.ink },
  suggestDesc: { fontFamily: font.body, fontSize: 13, color: colors.inkSoft, marginTop: 1 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  confirmPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ok,
    color: '#fff',
    fontFamily: font.body,
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmText: { flex: 1, fontFamily: font.body, fontWeight: '600', fontSize: 14, color: colors.ink },
  geoMsg: { color: colors.inkSoft, fontFamily: font.body, fontSize: 14, marginTop: 10 },
  erro: { color: colors.danger, fontFamily: font.body, fontSize: 14, marginTop: 16 },
});
