import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { Avatar, Btn, Chips, CourtLine, Segmented } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { GolpePreferido, MaoDominante } from '@/lib/database.types';
import { escolherFotoDePerfil, removerFotoDePerfil, trocarFotoDePerfil } from '@/lib/fotos';
import { capturarLocalizacao } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import { colors, font, maxW, radius } from '@/theme/tokens';

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
  }, [session?.user.id]);

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
    } catch (e: any) {
      setFotoErro(e?.message ?? 'Não foi possível trocar a foto.');
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
    } catch (e: any) {
      setFotoErro(e?.message ?? 'Não foi possível remover a foto.');
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
    } catch (e: any) {
      setGeoMsg(e?.message ?? 'Não foi possível obter a localização.');
    } finally {
      setGeoBusy(false);
    }
  }

  async function salvar() {
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
    if (nAltura != null && (nAltura < 100 || nAltura > 250)) return setErro('Altura (cm) deve ficar entre 100 e 250.');
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
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível salvar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.container, { maxWidth: maxW }]}>
          <Text style={styles.eyebrow}>SEU PERFIL DE JOGADOR</Text>
          <Text style={styles.title}>Como você joga?</Text>
          <Text style={styles.lede}>
            Essas informações ajudam a te parear com gente do seu nível e da sua região.
          </Text>
          <CourtLine color={colors.net} style={{ marginVertical: 22 }} />

          <Group label="Foto de perfil">
            <View style={styles.fotoLinha}>
              <Pressable
                onPress={trocarFoto}
                disabled={fotoBusy}
                accessibilityLabel="Escolher foto de perfil"
                style={({ hovered }: any) => [styles.fotoBox, hovered && { opacity: 0.9 }]}>
                <Avatar nome={nome} foto={avatar} size={72} />
                {fotoBusy && (
                  <View style={styles.fotoCarregando}>
                    <ActivityIndicator color={colors.chalk} />
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1, gap: 8 }}>
                <Pressable onPress={trocarFoto} disabled={fotoBusy}>
                  <Text style={styles.fotoAcao}>{avatar ? 'Trocar foto' : 'Escolher uma foto'}</Text>
                </Pressable>
                {avatar && (
                  <Pressable onPress={removerFoto} disabled={fotoBusy}>
                    <Text style={styles.fotoRemover}>Remover foto</Text>
                  </Pressable>
                )}
                <Text style={styles.fotoDica}>Ela aparece nas partidas, no feed e no ranking.</Text>
              </View>
            </View>
            {fotoErro && <Text style={styles.erro}>{fotoErro}</Text>}
          </Group>

          <Group label="Nome">
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder="Como te chamam na quadra"
              placeholderTextColor={colors.inkSoft}
              style={styles.input}
            />
          </Group>

          <Group label="Mão dominante">
            <Segmented options={MAOS} value={mao} onChange={setMao} />
          </Group>

          <View style={styles.row}>
            <Group label="Idade" style={{ flex: 1 }}>
              <TextInput
                value={idade}
                onChangeText={(t) => setIdade(soDigitos(t))}
                placeholder="anos"
                placeholderTextColor={colors.inkSoft}
                keyboardType="number-pad"
                maxLength={3}
                style={styles.input}
              />
            </Group>
            <Group label="Altura (cm)" style={{ flex: 1 }}>
              <TextInput
                value={altura}
                onChangeText={(t) => setAltura(soDigitos(t))}
                placeholder="ex: 178"
                placeholderTextColor={colors.inkSoft}
                keyboardType="number-pad"
                maxLength={3}
                style={styles.input}
              />
            </Group>
          </View>

          <Group label="Nível — há quantos anos você joga?">
            <TextInput
              value={anos}
              onChangeText={(t) => setAnos(soDigitos(t))}
              placeholder="ex: 3"
              placeholderTextColor={colors.inkSoft}
              keyboardType="number-pad"
              maxLength={2}
              style={styles.input}
            />
          </Group>

          <Group label="Golpe preferido (seu mais forte)">
            <Chips options={GOLPES} value={golpe} onChange={setGolpe} />
          </Group>

          <CourtLine color={colors.net} style={{ marginVertical: 22 }} />
          <Text style={styles.eyebrow}>LOCALIZAÇÃO</Text>
          <Text style={styles.lede}>
            Usamos sua localização só para achar partidas num raio próximo. Ela fica privada.
          </Text>

          <Pressable
            onPress={usarGps}
            disabled={geoBusy}
            style={({ hovered, pressed }: any) => [
              styles.gps,
              (hovered || pressed) && { opacity: 0.9 },
              geoBusy && { opacity: 0.6 },
            ]}>
            {geoBusy ? (
              <ActivityIndicator color={colors.chalk} />
            ) : (
              <Text style={styles.gpsText}>Usar minha localização</Text>
            )}
          </Pressable>
          {geoMsg && <Text style={styles.geoMsg}>{geoMsg}</Text>}

          <View style={[styles.row, { marginTop: 14 }]}>
            <Group label="Cidade" style={{ flex: 2 }}>
              <TextInput
                value={cidade}
                onChangeText={setCidade}
                placeholder="ex: São Paulo"
                placeholderTextColor={colors.inkSoft}
                style={styles.input}
              />
            </Group>
            <Group label="UF" style={{ flex: 1 }}>
              <TextInput
                value={uf}
                onChangeText={(t) => setUf(t.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                placeholder="SP"
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="characters"
                maxLength={2}
                style={styles.input}
              />
            </Group>
          </View>

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Btn label="Salvar perfil" onPress={salvar} loading={busy} full style={{ marginTop: 24 }} />
          <Link href="/perfil" style={styles.cancel}>
            Cancelar
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Group({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const soDigitos = (s: string) => s.replace(/[^0-9]/g, '');
function parseNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.chalk },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { alignItems: 'center', padding: 22, paddingTop: 34, paddingBottom: 48 },
  container: { width: '100%' },
  eyebrow: { color: colors.clay, fontFamily: font.mono, fontSize: 12, letterSpacing: 1.5, marginBottom: 8 },
  title: { color: colors.ink, fontFamily: font.display, fontWeight: '800', fontSize: 32 },
  lede: { color: colors.inkSoft, fontFamily: font.body, fontSize: 15, lineHeight: 22, marginTop: 6 },
  row: { flexDirection: 'row', gap: 12 },
  label: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.inkSoft,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    height: 50,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.net,
    paddingHorizontal: 14,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  fotoLinha: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  fotoBox: { width: 72, height: 72 },
  fotoCarregando: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 36,
    backgroundColor: 'rgba(36,22,17,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoAcao: { fontFamily: font.body, fontWeight: '700', fontSize: 14.5, color: colors.clay },
  fotoRemover: { fontFamily: font.body, fontSize: 13.5, color: colors.inkSoft },
  fotoDica: { fontFamily: font.body, fontSize: 13, color: colors.inkSoft },
  gps: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.clay,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  gpsText: { color: colors.chalk, fontFamily: font.body, fontWeight: '700', fontSize: 15 },
  geoMsg: { color: colors.ok, fontFamily: font.body, fontSize: 14, marginTop: 10 },
  erro: { color: colors.danger, fontFamily: font.body, fontSize: 14, marginTop: 16 },
  cancel: { color: colors.inkSoft, fontFamily: font.body, fontSize: 14, textAlign: 'center', marginTop: 16 },
});
